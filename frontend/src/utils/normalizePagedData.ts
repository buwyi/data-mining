export type PagedListResult = {
  rows: Record<string, unknown>[]
  total: number
}

function toNonNegInt(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : Number.parseInt(String(v), 10)
  if (!Number.isFinite(n) || n < 0) return fallback
  return Math.floor(n)
}

/**
 * 将 `ApiResult.data` 规范为 `{ rows, total }`。
 * 兼容 Spring `Page`（content + totalElements）、以及 list/records/data/rows + total 等常见形态。
 */
export function normalizePagedListData(raw: unknown): PagedListResult {
  if (raw == null) return { rows: [], total: 0 }
  if (Array.isArray(raw)) {
    return { rows: raw as Record<string, unknown>[], total: raw.length }
  }
  if (typeof raw !== 'object') return { rows: [], total: 0 }
  const o = raw as Record<string, unknown>

  const rowsFrom = (arr: unknown): Record<string, unknown>[] =>
    Array.isArray(arr) ? (arr as Record<string, unknown>[]) : []

  if (Array.isArray(o.content)) {
    const rows = rowsFrom(o.content)
    return {
      rows,
      total: toNonNegInt(o.totalElements ?? o.total, rows.length),
    }
  }
  if (Array.isArray(o.list)) {
    const rows = rowsFrom(o.list)
    return { rows, total: toNonNegInt(o.total ?? o.count ?? o.totalCount, rows.length) }
  }
  if (Array.isArray(o.records)) {
    const rows = rowsFrom(o.records)
    return { rows, total: toNonNegInt(o.total ?? o.totalCount, rows.length) }
  }
  if (Array.isArray(o.data)) {
    const rows = rowsFrom(o.data)
    return { rows, total: toNonNegInt(o.total ?? o.totalCount, rows.length) }
  }
  if (Array.isArray(o.rows)) {
    const rows = rowsFrom(o.rows)
    return { rows, total: toNonNegInt(o.total ?? o.rowCount, rows.length) }
  }
  return { rows: [], total: 0 }
}
