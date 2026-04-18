/**
 * 将节点「查看数据」接口返回的多种 JSON 形态归一为表格可用的行列表。
 * 兼容：顶层数组、{ rows }、Spring Page 风格 { content, totalElements }、
 * fetchProjectNodeOutputData 包装后的 { content, totalElements, size, number } 等。
 */

export type TabularPreviewModel = {
  rows: Record<string, unknown>[]
  /** 服务端总条数（可能大于当前 rows 长度） */
  totalElements?: number
  pageSize?: number
  currentPage?: number
}

function asNonNegInt(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v) && v >= 0) return Math.floor(v)
  if (typeof v === 'string' && /^\d+$/.test(v)) return Number.parseInt(v, 10)
  return undefined
}

function isPlainObjectRow(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

/** 从若干行中汇总列名（避免首行缺列） */
function collectColumnKeys(rows: Record<string, unknown>[]): string[] {
  const keys = new Set<string>()
  const sample = rows.slice(0, 50)
  for (const r of sample) {
    for (const k of Object.keys(r)) keys.add(k)
  }
  return [...keys]
}

/**
 * 若无法识别为表格数据则返回 `null`，由调用方回退为 JSON 文本等。
 */
export function extractTabularPreview(data: unknown): TabularPreviewModel | null {
  if (data === null || data === undefined) {
    return null
  }

  // 顶层：对象数组
  if (Array.isArray(data)) {
    if (data.length === 0) return { rows: [] }
    if (isPlainObjectRow(data[0])) {
      return { rows: data as Record<string, unknown>[] }
    }
    // 原始类型数组 → 单列
    return {
      rows: data.map((v, i) => ({ '#': i + 1, value: v })),
    }
  }

  if (typeof data !== 'object') return null

  const o = data as Record<string, unknown>

  const totalElements =
    asNonNegInt(o.totalElements) ??
    asNonNegInt(o.total) ??
    asNonNegInt((o as { page?: { totalElements?: unknown } }).page?.totalElements)
  const pageSize =
    asNonNegInt(o.size) ?? asNonNegInt(o.pageSize) ?? asNonNegInt((o as { page?: { size?: unknown } }).page?.size)
  /** Spring `number` 为从 0 开始的页码 */
  const pageIndex = asNonNegInt(o.number) ?? asNonNegInt((o as { page?: { number?: unknown } }).page?.number)
  const currentPage =
    pageIndex !== undefined
      ? pageIndex + 1
      : asNonNegInt(o.pageNum) ?? asNonNegInt(o.current)

  // Spring Page：content
  if (Array.isArray(o.content)) {
    const content = o.content
    if (content.length === 0) return { rows: [], totalElements: totalElements ?? 0, pageSize, currentPage }
    if (isPlainObjectRow(content[0])) {
      return {
        rows: content as Record<string, unknown>[],
        totalElements,
        pageSize,
        currentPage,
      }
    }
  }

  // { rows: [...] }
  if (Array.isArray(o.rows)) {
    const rows = o.rows
    if (rows.length === 0) return { rows: [], totalElements, pageSize, currentPage }
    if (isPlainObjectRow(rows[0])) {
      return {
        rows: rows as Record<string, unknown>[],
        totalElements,
        pageSize,
        currentPage,
      }
    }
  }

  // { data: { content | rows } }
  if (isPlainObjectRow(o.data)) {
    const inner = extractTabularPreview(o.data)
    if (inner) return inner
  }

  return null
}

export { collectColumnKeys }
