/**
 * 从首行对象键名中按 `preferred` 顺序取列，再补齐其余键，用于动态表格列。
 */
export function pickTableDisplayKeys(
  rows: Record<string, unknown>[],
  preferred: readonly string[],
  maxColumns = 10,
): string[] {
  if (rows.length === 0) return []
  const keys = Object.keys(rows[0])
  const head = preferred.filter((k) => keys.includes(k))
  const rest = keys.filter((k) => !preferred.includes(k))
  return [...head, ...rest].slice(0, maxColumns)
}

/** 与 TipDM `Widget`（`name` / `codeName` / `description`）及前端宽松解析一致 */
export const WIDGET_LIST_TABLE_PREFERRED_KEYS = [
  'id',
  'name',
  'codeName',
  'code',
  'description',
  'label',
  'className',
  'title',
  'type',
  'text',
  'elementType',
  'widgetId',
] as const

/** `GET /api/algorithm/list` 常为 Map 序列化或键值行 */
export const ALGORITHM_LIST_TABLE_PREFERRED_KEYS = [
  'key',
  'value',
  'id',
  'name',
  'label',
  'title',
  'description',
  'path',
  'className',
  'type',
] as const
