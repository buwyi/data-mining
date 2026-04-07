import Papa from 'papaparse'
import { buildPreviewFromMatrix } from './csvPreviewShared'
import type { CsvDelimiterKey, ParseCsvPreviewResult } from './csvPreviewShared'
import type { CsvPreviewWorkerParseMessage } from './csvPreview.worker'

export type { CsvDelimiterKey, ParseCsvPreviewResult } from './csvPreviewShared'

const PREVIEW_BYTES_ONLY = 10 * 1024
const PREVIEW_BYTES_PAGEABLE = 256 * 1024

function previewByteBudget(previewMode: string): number {
  return previewMode === 'PAGEABLE' ? PREVIEW_BYTES_PAGEABLE : PREVIEW_BYTES_ONLY
}

/** 表头一行 + 数据行数上限（交给 Papa `preview`） */
function maxParsedRows(previewMode: string): number {
  return previewMode === 'PAGEABLE' ? 501 : 101
}

function mapToTextDecoderLabel(encoding: string): string {
  const key = encoding.trim().toUpperCase().replace(/-/g, '')
  if (key === 'UTF8') return 'utf-8'
  if (key === 'GBK') return 'gbk'
  if (key === 'GB2312') return 'gbk'
  if (key === 'ASCII') return 'utf-8'
  return 'utf-8'
}

function textDecoderSupportedLabel(encoding: string): boolean {
  try {
    void new TextDecoder(mapToTextDecoderLabel(encoding))
    return true
  } catch {
    return false
  }
}

function readFileSliceWithFileReader(file: File, encoding: string, maxBytes: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const blob = file.slice(0, maxBytes)
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error ?? new Error('读取文件失败'))
    reader.readAsText(blob, encoding)
  })
}

/**
 * 读取文件前缀为文本：优先 TextDecoder（性能较好），不支持时回退 FileReader（兼容部分环境对 GBK/GB2312 的 label）。
 */
export async function readPreviewTextSlice(file: File, encoding: string, maxBytes: number): Promise<string> {
  const blob = file.slice(0, maxBytes)
  const buf = await blob.arrayBuffer()
  if (typeof TextDecoder !== 'undefined' && textDecoderSupportedLabel(encoding)) {
    const dec = new TextDecoder(mapToTextDecoderLabel(encoding), { fatal: false })
    return dec.decode(buf)
  }
  return readFileSliceWithFileReader(file, encoding, maxBytes)
}

function toStringMatrix(data: unknown): string[][] {
  if (!Array.isArray(data)) return []
  return data
    .filter((row): row is unknown[] => Array.isArray(row))
    .map((row) => row.map((cell) => (cell == null ? '' : String(cell))))
}

function parseWithPapaOnMainThread(
  text: string,
  delimiter: CsvDelimiterKey,
  maxRows: number,
  firstRowAsColumnName: boolean,
  enableTypeInference: boolean,
): ParseCsvPreviewResult {
  const delim = delimiter === 'semicolon' ? ';' : ','
  const parsed = Papa.parse<unknown[]>(text, {
    delimiter: delim,
    header: false,
    skipEmptyLines: 'greedy',
    preview: maxRows,
    dynamicTyping: false,
  })
  const quotesErr = parsed.errors.find((e) => e.type === 'Quotes')
  if (quotesErr) {
    throw new Error(quotesErr.message ?? '引号字段未闭合或格式错误')
  }
  const matrix = toStringMatrix(parsed.data)
  return buildPreviewFromMatrix(matrix, firstRowAsColumnName, enableTypeInference)
}

let workerRef: Worker | null = null
let seq = 0
const pending = new Map<
  number,
  { resolve: (v: ParseCsvPreviewResult) => void; reject: (e: Error) => void }
>()

function terminateWorker(): void {
  workerRef?.terminate()
  workerRef = null
}

function ensureWorker(): Worker {
  if (workerRef) return workerRef
  workerRef = new Worker(new URL('./csvPreview.worker.ts', import.meta.url), { type: 'module' })
  workerRef.onmessage = (e: MessageEvent) => {
    const msg = e.data as
      | { type: 'result'; id: number; data: ParseCsvPreviewResult }
      | { type: 'error'; id: number; message: string }
    const p = pending.get(msg.id)
    if (!p) return
    pending.delete(msg.id)
    if (msg.type === 'result') {
      p.resolve(msg.data)
      return
    }
    if (msg.type === 'error') {
      p.reject(new Error(msg.message))
      return
    }
    p.reject(new Error('未知 Worker 响应'))
  }
  workerRef.onerror = (ev) => {
    const err = new Error(ev.message ?? 'CSV 预览 Worker 异常')
    for (const [, pr] of pending) pr.reject(err)
    pending.clear()
    terminateWorker()
  }
  return workerRef
}

function runInWorker(payload: Omit<CsvPreviewWorkerParseMessage, 'type' | 'id'>): Promise<ParseCsvPreviewResult> {
  const id = ++seq
  const worker = ensureWorker()
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    const msg: CsvPreviewWorkerParseMessage = { type: 'parse', id, ...payload }
    worker.postMessage(msg)
  })
}

/**
 * 在 Web Worker 中用 Papa Parse 解析 CSV 预览；Worker 不可用时回退到主线程（小文件可接受）。
 */
export async function parseCsvPreviewSample(
  file: File,
  encoding: string,
  delimiter: CsvDelimiterKey,
  firstRowAsColumnName: boolean,
  enableTypeInference: boolean,
  previewMode = 'ONLY100',
): Promise<ParseCsvPreviewResult> {
  const maxBytes = previewByteBudget(previewMode)
  const maxRows = maxParsedRows(previewMode)
  const text = await readPreviewTextSlice(file, encoding, maxBytes)

  if (typeof Worker === 'undefined') {
    return parseWithPapaOnMainThread(text, delimiter, maxRows, firstRowAsColumnName, enableTypeInference)
  }

  return runInWorker({
    text,
    delimiter,
    firstRowAsColumnName,
    enableTypeInference,
    maxRows,
  })
}
