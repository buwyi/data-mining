import Papa from 'papaparse'
import { buildPreviewFromMatrix } from './csvPreviewShared'
import type { CsvDelimiterKey, ParseCsvPreviewResult } from './csvPreviewShared'

export type CsvPreviewWorkerParseMessage = {
  type: 'parse'
  id: number
  text: string
  delimiter: CsvDelimiterKey
  firstRowAsColumnName: boolean
  enableTypeInference: boolean
  maxRows: number
}

type CsvPreviewWorkerResultMessage = {
  type: 'result'
  id: number
  data: ParseCsvPreviewResult
}

type CsvPreviewWorkerErrorMessage = {
  type: 'error'
  id: number
  message: string
}

function delimiterChar(key: CsvDelimiterKey): string {
  return key === 'semicolon' ? ';' : ','
}

function toStringMatrix(data: unknown): string[][] {
  if (!Array.isArray(data)) return []
  return data
    .filter((row): row is unknown[] => Array.isArray(row))
    .map((row) => row.map((cell) => (cell == null ? '' : String(cell))))
}

self.onmessage = (event: MessageEvent<CsvPreviewWorkerParseMessage>) => {
  const msg = event.data
  if (msg.type !== 'parse') return

  try {
    const delim = delimiterChar(msg.delimiter)
    const parsed = Papa.parse<unknown[]>(msg.text, {
      delimiter: delim,
      header: false,
      skipEmptyLines: 'greedy',
      preview: msg.maxRows,
      dynamicTyping: false,
    })

    const quotesErr = parsed.errors.find((e) => e.type === 'Quotes')
    if (quotesErr) {
      throw new Error(quotesErr.message ?? '引号字段未闭合或格式错误')
    }

    const matrix = toStringMatrix(parsed.data)
    const result = buildPreviewFromMatrix(matrix, msg.firstRowAsColumnName, msg.enableTypeInference)
    const out: CsvPreviewWorkerResultMessage = { type: 'result', id: msg.id, data: result }
    self.postMessage(out)
  } catch (e) {
    const message = e instanceof Error ? e.message : '预览解析失败'
    const err: CsvPreviewWorkerErrorMessage = { type: 'error', id: msg.id, message }
    self.postMessage(err)
  }
}
