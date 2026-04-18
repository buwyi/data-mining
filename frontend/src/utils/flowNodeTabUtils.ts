import type { FlowNodeWire } from '../domain/flow'

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

/** 不可变更新 `tabs[tabIndex].elements[elIndex].value` */
export function setTabElementValue(
  wire: FlowNodeWire,
  tabIndex: number,
  elIndex: number,
  value: unknown,
): FlowNodeWire {
  const tabsRaw = wire.tabs
  if (!Array.isArray(tabsRaw)) return wire
  const tabs = [...tabsRaw]
  const rawTab = tabs[tabIndex]
  if (!isRecord(rawTab)) return wire
  const tab = { ...rawTab }
  const elementsRaw = tab.elements
  if (!Array.isArray(elementsRaw)) return wire
  const elements = [...elementsRaw]
  const rawEl = elements[elIndex]
  if (!isRecord(rawEl)) return wire
  elements[elIndex] = { ...rawEl, value }
  tab.elements = elements
  tabs[tabIndex] = tab
  return { ...wire, tabs }
}

/** 合并写入 tabs 下单个 element 的多个字段（如同时更新 `value` 与 `inputData`） */
export function setTabElementPatch(
  wire: FlowNodeWire,
  tabIndex: number,
  elIndex: number,
  patch: Record<string, unknown>,
): FlowNodeWire {
  const tabsRaw = wire.tabs
  if (!Array.isArray(tabsRaw)) return wire
  const tabs = [...tabsRaw]
  const rawTab = tabs[tabIndex]
  if (!isRecord(rawTab)) return wire
  const tab = { ...rawTab }
  const elementsRaw = tab.elements
  if (!Array.isArray(elementsRaw)) return wire
  const elements = [...elementsRaw]
  const rawEl = elements[elIndex]
  if (!isRecord(rawEl)) return wire
  elements[elIndex] = { ...rawEl, ...patch }
  tab.elements = elements
  tabs[tabIndex] = tab
  return { ...wire, tabs }
}

export function readElementVisible(el: Record<string, unknown>): boolean {
  if (el.visible === false) return false
  return true
}

export function readElementType(el: Record<string, unknown>): number {
  const t = el.elementType
  if (typeof t === 'number' && Number.isFinite(t)) return t
  return -1
}

export function readElementRequired(el: Record<string, unknown>): boolean {
  const r = el.required
  return r === true || r === 'true' || r === 1 || r === '1'
}

/** 与旧版常见布尔约定一致：`readOnly` / `disabled` 为真，或 `editable` 显式为假 */
export function readElementReadOnly(el: Record<string, unknown>): boolean {
  const ro = el.readOnly
  if (ro === true || ro === 'true' || ro === 1 || ro === '1') return true
  const dis = el.disabled
  if (dis === true || dis === 'true' || dis === 1 || dis === '1') return true
  const ed = el.editable
  if (ed === false || ed === 'false' || ed === 0 || ed === '0') return true
  const roEx = readBoolFromExtra(el, ['readOnly'])
  if (roEx === true) return true
  const disEx = readBoolFromExtra(el, ['disabled'])
  if (disEx === true) return true
  const edEx = readBoolFromExtra(el, ['editable'])
  if (edEx === false) return true
  return false
}

function readNumericFromRecord(src: Record<string, unknown>, keys: string[]): number | undefined {
  for (const k of keys) {
    const v = src[k]
    if (typeof v === 'number' && Number.isFinite(v)) return v
    if (typeof v === 'string' && v.trim() !== '') {
      const n = Number(v)
      if (Number.isFinite(n)) return n
    }
  }
  return undefined
}

/** 从元素上按候选键读取有限数字（兼容字符串数字；回退 `extra` 中与 `buildComponentPutBody` 一致） */
export function readElementNumericField(el: Record<string, unknown>, keys: string[]): number | undefined {
  const top = readNumericFromRecord(el, keys)
  if (top !== undefined) return top
  const ex = el.extra
  if (isRecord(ex)) return readNumericFromRecord(ex, keys)
  return undefined
}

/** `min` 或别名 `minimum`，用于 elementType=2 的 InputNumber */
export function readElementNumberMin(el: Record<string, unknown>): number | undefined {
  return readElementNumericField(el, ['min', 'minimum'])
}

export function readElementNumberMax(el: Record<string, unknown>): number | undefined {
  return readElementNumericField(el, ['max', 'maximum'])
}

export function readElementNumberStep(el: Record<string, unknown>): number | undefined {
  return readElementNumericField(el, ['step'])
}

/** 非空字符串视为正则；空或未配置表示不校验 */
export function readElementRexpPattern(el: Record<string, unknown>): string | null {
  const r = el.rexp
  if (typeof r !== 'string') return null
  const t = r.trim()
  return t.length > 0 ? t : null
}

/**
 * 对 **非空** 字符串按 `rexp` 校验；空串或未配置 `pattern` 视为通过。
 * @returns `ok` | `mismatch` | `invalid_pattern`（`RegExp` 构造失败）
 */
export function validateStringAgainstElementRexp(
  str: string,
  pattern: string | null,
): 'ok' | 'mismatch' | 'invalid_pattern' {
  if (!pattern || str === '') return 'ok'
  try {
    const re = new RegExp(pattern)
    return re.test(str) ? 'ok' : 'mismatch'
  } catch {
    return 'invalid_pattern'
  }
}

function readTruncatedIntFromRecord(
  src: Record<string, unknown>,
  keys: string[],
  min: number,
  max: number,
): number | undefined {
  for (const k of keys) {
    const v = src[k]
    if (typeof v === 'number' && Number.isFinite(v)) {
      const n = Math.trunc(v)
      if (n >= min && n <= max) return n
    }
    if (typeof v === 'string' && v.trim() !== '') {
      const n = Number.parseInt(v.trim(), 10)
      if (Number.isFinite(n) && n >= min && n <= max) return n
    }
  }
  return undefined
}

function readTruncatedIntInRange(
  el: Record<string, unknown>,
  keys: string[],
  min: number,
  max: number,
): number | undefined {
  const top = readTruncatedIntFromRecord(el, keys, min, max)
  if (top !== undefined) return top
  const ex = el.extra
  if (isRecord(ex)) return readTruncatedIntFromRecord(ex, keys, min, max)
  return undefined
}

/** 配置了 `rows` / `row` 时返回，否则 `undefined` */
export function readOptionalElementRows(el: Record<string, unknown>): number | undefined {
  return readTruncatedIntInRange(el, ['rows', 'row'], 1, 40)
}

/** TextArea 行数；未配置时用 `fallback` */
export function readElementTextAreaRows(el: Record<string, unknown>, fallback: number): number {
  return readOptionalElementRows(el) ?? fallback
}

/** `maxLength` / `maxlength`，用于 Input / TextArea */
export function readElementMaxLength(el: Record<string, unknown>): number | undefined {
  return readTruncatedIntInRange(el, ['maxLength', 'maxlength'], 1, 1_000_000)
}

function readBoolFromExtra(
  el: Record<string, unknown>,
  keys: string[],
): boolean | undefined {
  const ex = el.extra
  if (ex === null || typeof ex !== 'object' || Array.isArray(ex)) return undefined
  const o = ex as Record<string, unknown>
  for (const k of keys) {
    const v = o[k]
    if (v === true || v === 'true' || v === 1 || v === '1') return true
    if (v === false || v === 'false' || v === 0 || v === '0') return false
  }
  return undefined
}

/** 下拉是否允许清空；仅 `allowClear` 显式为假时关闭 */
export function readElementAllowClear(el: Record<string, unknown>): boolean {
  const a = el.allowClear
  if (a === false || a === 'false' || a === 0 || a === '0') return false
  const fromEx = readBoolFromExtra(el, ['allowClear'])
  if (fromEx === false) return false
  return true
}

/**
 * 下拉是否可搜索：`showSearch` / `filterable` 显式优先；显式假则关闭；
 * 未配置时选项数 ≥ `autoThreshold` 则开启（默认 10）。
 */
export function readElementSelectShowSearch(
  el: Record<string, unknown>,
  optionCount: number,
  autoThreshold = 10,
): boolean {
  const v = el.showSearch ?? el.filterable
  if (v === false || v === 'false' || v === 0 || v === '0') return false
  if (v === true || v === 'true' || v === 1 || v === '1') return true
  const fromEx = readBoolFromExtra(el, ['showSearch', 'filterable'])
  if (fromEx === false) return false
  if (fromEx === true) return true
  return optionCount >= autoThreshold
}

/** 组件编辑弹窗：下拉搜索三态 — 未显式配置 / 强制开 / 强制关 */
export type ElementSelectSearchFormMode = 'default' | 'on' | 'off'

export function readElementSelectSearchFormMode(el: Record<string, unknown>): ElementSelectSearchFormMode {
  const v = el.showSearch ?? el.filterable
  if (v === true || v === 'true' || v === 1 || v === '1') return 'on'
  if (v === false || v === 'false' || v === 0 || v === '0') return 'off'
  const fromEx = readBoolFromExtra(el, ['showSearch', 'filterable'])
  if (fromEx === true) return 'on'
  if (fromEx === false) return 'off'
  return 'default'
}
