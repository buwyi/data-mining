import type { ComponentDefinitionDto } from '../types/component'

/**
 * 将 `GET /api/component/{id}` 得到的定义整理为 `PUT` 请求体，与 TipDM
 * `com.tipdm.framework.controller.dmserver.dto.Component` 字段对齐：
 * - 顶层使用 **`engine`**（`R` | `PYTHON`），而非嵌套 `extra.engine`（GET 响应里引擎常在 `extra` 中）。
 * - 去掉仅用于前端/序列化噪声的字段（如根级 `extra`），避免误导后端。
 * - 将元素上非 DTO 字段（`readOnly`、`allowClear`、`description` 等）折叠进 `extra` 字符串表，便于往返。
 */

const TIPDM_ENGINES = new Set(['R', 'PYTHON'])

function normalizeTipdmEngine(v: unknown): 'R' | 'PYTHON' | undefined {
  const s = String(v ?? '')
    .trim()
    .toUpperCase()
  if (TIPDM_ENGINES.has(s)) return s as 'R' | 'PYTHON'
  return undefined
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

function mergeStringExtra(base: Record<string, string>, key: string, val: unknown): void {
  if (val === undefined || val === null) return
  if (typeof val === 'string') {
    base[key] = val
    return
  }
  if (typeof val === 'boolean' || typeof val === 'number') {
    base[key] = String(val)
    return
  }
  try {
    base[key] = JSON.stringify(val)
  } catch {
    base[key] = String(val)
  }
}

/** 与 `dto.Element` 一致的可序列化字段 + 可选 `id`（供 JPA merge） */
export function sanitizeComponentElementForPut(el: Record<string, unknown>): Record<string, unknown> {
  const extra: Record<string, string> = {}
  const prev = el.extra
  if (prev !== null && typeof prev === 'object' && !Array.isArray(prev)) {
    for (const [k, v] of Object.entries(prev as Record<string, unknown>)) {
      mergeStringExtra(extra, k, v)
    }
  }
  if ('description' in el) mergeStringExtra(extra, 'description', el.description)

  const foldKeys = ['min', 'max', 'step', 'rows', 'maxLength'] as const
  for (const k of foldKeys) {
    if (!(k in el)) continue
    mergeStringExtra(extra, k, el[k])
  }

  const out: Record<string, unknown> = {}
  const copyKeys = [
    'name',
    'label',
    'elementType',
    'defaultValue',
    'value',
    'placeholder',
    'toolTip',
    'sequence',
    'options',
    'rexp',
    'readOnly',
    'disabled',
    'editable',
    'allowClear',
    'showSearch',
  ] as const
  for (const k of copyKeys) {
    if (el[k] !== undefined) out[k] = el[k]
  }
  if (el.required !== undefined) out.required = el.required
  if (el.visible !== undefined) out.visible = el.visible

  const id = el.id
  if (typeof id === 'number' && Number.isFinite(id)) out.id = id

  if (Object.keys(extra).length > 0) out.extra = extra
  return out
}

function sanitizeTabForPut(tab: Record<string, unknown>): Record<string, unknown> {
  const tabName = typeof tab.tabName === 'string' ? tab.tabName : ''
  const elementsRaw = tab.elements
  const elements: Record<string, unknown>[] = []
  if (Array.isArray(elementsRaw)) {
    for (const e of elementsRaw) {
      const r = asRecord(e)
      if (!r) continue
      elements.push(sanitizeComponentElementForPut(r))
    }
  }
  const out: Record<string, unknown> = { tabName, elements }
  const tid = tab.id
  if (typeof tid === 'number' && Number.isFinite(tid)) out.id = tid
  return out
}

function sanitizeIoRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  const keys = [
    'key',
    'type',
    'cat',
    'description',
    'canPreview',
    'access',
    'columns',
    'preViewMode',
  ] as const
  for (const k of keys) {
    if (row[k] !== undefined) out[k] = row[k]
  }
  const id = row.id
  if (typeof id === 'number' && Number.isFinite(id)) out.id = id
  return out
}

function sanitizeIoList(raw: unknown): Record<string, unknown>[] {
  if (!Array.isArray(raw)) return []
  const out: Record<string, unknown>[] = []
  for (const x of raw) {
    const r = asRecord(x)
    if (!r) continue
    out.push(sanitizeIoRow(r))
  }
  return out
}

function sanitizeScript(raw: unknown): Record<string, string> | undefined {
  if (raw === null || raw === undefined) return undefined
  if (typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const o = raw as Record<string, unknown>
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(o)) {
    if (typeof v === 'string') out[k] = v
    else if (v !== undefined && v !== null) out[k] = String(v)
  }
  return Object.keys(out).length > 0 ? out : undefined
}

/**
 * 构建 `PUT /api/component/{id}` 的 JSON 体（白名单字段，与 TipDM DTO 一致）。
 */
export function buildComponentPutBody(def: ComponentDefinitionDto): Record<string, unknown> {
  const d = def as Record<string, unknown>
  const body: Record<string, unknown> = {}

  if (typeof def.name === 'string') body.name = def.name
  if (typeof def.targetAlgorithm === 'string') body.targetAlgorithm = def.targetAlgorithm
  if (typeof def.description === 'string') body.description = def.description
  if (typeof def.iconPath === 'string') body.iconPath = def.iconPath

  const parentId = def.parentId
  if (typeof parentId === 'number' && Number.isFinite(parentId)) body.parentId = parentId

  const minIn = def.minimumInput
  if (typeof minIn === 'number' && Number.isFinite(minIn)) body.minimumInput = minIn

  if (typeof def.allowViewSource === 'boolean') body.allowViewSource = def.allowViewSource
  if (typeof def.hasReport === 'boolean') body.hasReport = def.hasReport
  if (typeof def.enabled === 'boolean') body.enabled = def.enabled

  const pmml = def.supportPMML
  if (typeof pmml === 'boolean') body.supportPMML = pmml
  else if (typeof d.isSupportPMML === 'boolean') body.supportPMML = d.isSupportPMML

  const engRoot = normalizeTipdmEngine(d.engine)
  const extraRec = asRecord(def.extra)
  const engFromExtra = normalizeTipdmEngine(extraRec?.engine)
  const engine = engRoot ?? engFromExtra
  if (engine) body.engine = engine

  const script = sanitizeScript(def.script)
  if (script) body.script = script

  body.inputs = sanitizeIoList(def.inputs)
  body.outputs = sanitizeIoList(def.outputs)

  const tabsRaw = def.tabs
  if (Array.isArray(tabsRaw)) {
    body.tabs = tabsRaw.map((t) => {
      const r = asRecord(t)
      return r ? sanitizeTabForPut(r) : { tabName: '', elements: [] }
    })
  } else {
    body.tabs = []
  }

  return body
}
