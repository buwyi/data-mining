function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

/** 网格列编辑类型（存 `tabs[].elements[].extra.gridColumnTypes`） */
export type GridColumnValueKind = 'text' | 'number'

/** 将后端/旧版杂项取值归一为网格列类型（无法识别则跳过该列） */
export function normalizeGridColumnTypeValue(v: unknown): GridColumnValueKind | undefined {
  if (typeof v !== 'string') return undefined
  const s = v.trim().toLowerCase()
  if (
    s === 'number' ||
    s === 'numeric' ||
    s === 'num' ||
    s === 'int' ||
    s === 'integer' ||
    s === 'long' ||
    s === 'double' ||
    s === 'float' ||
    s === 'decimal'
  ) {
    return 'number'
  }
  if (s === 'text' || s === 'string' || s === 'str' || s === 'varchar' || s === 'char') {
    return 'text'
  }
  return undefined
}

function readGridColumnTypesFromRecord(raw: unknown): Record<string, GridColumnValueKind> {
  if (!isRecord(raw)) return {}
  const out: Record<string, GridColumnValueKind> = {}
  for (const [k, v] of Object.entries(raw)) {
    const norm = normalizeGridColumnTypeValue(v)
    if (norm !== undefined) out[k] = norm
  }
  return out
}

/**
 * 读取列类型映射：`extra.gridColumnTypes` 优先；并与 `extra.columnTypes` 合并（后者仅补未出现的列）。
 * 与旧版/不同 DTO 命名对齐时减少丢配置。
 */
export function readGridColumnTypes(el: Record<string, unknown>): Record<string, GridColumnValueKind> {
  if (!isRecord(el.extra)) return {}
  const ex = el.extra
  const fromAlt = readGridColumnTypesFromRecord(ex.columnTypes)
  const fromPrimary = readGridColumnTypesFromRecord(ex.gridColumnTypes)
  return { ...fromAlt, ...fromPrimary }
}

/** 合并写入 `extra`（浅合并，保留其它 extra 字段） */
export function buildExtraPatchWithGridColumnTypes(
  el: Record<string, unknown>,
  types: Record<string, GridColumnValueKind>,
): Record<string, unknown> {
  const prev = isRecord(el.extra) ? { ...el.extra } : {}
  return { ...prev, gridColumnTypes: { ...types } }
}

/** 是否可用「对象数组」表格编辑（与旧版 inputData 网格对齐的首版判定） */
export function readGridRowsFromElement(el: Record<string, unknown>): Record<string, unknown>[] | null {
  const inputData = el.inputData
  if (Array.isArray(inputData)) {
    if (inputData.length === 0) return []
    if (inputData.every(isRecord)) return inputData
    return null
  }
  const val = el.value
  if (Array.isArray(val)) {
    if (val.length === 0) return []
    if (val.every(isRecord)) return val as Record<string, unknown>[]
  }
  return null
}

export function gridColumnKeys(rows: Record<string, unknown>[]): string[] {
  const s = new Set<string>()
  for (const r of rows) {
    for (const k of Object.keys(r)) s.add(k)
  }
  if (s.size === 0) return ['value']
  return [...s].sort()
}
