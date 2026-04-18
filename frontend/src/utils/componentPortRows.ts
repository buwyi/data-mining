/** 深拷贝端口数组（inputs / outputs），过滤非对象项 */
export function clonePortRows(raw: unknown): Record<string, unknown>[] {
  if (!Array.isArray(raw)) return []
  try {
    const c = JSON.parse(JSON.stringify(raw)) as unknown[]
    return c.filter(
      (x): x is Record<string, unknown> => x !== null && typeof x === 'object' && !Array.isArray(x),
    )
  } catch {
    return []
  }
}
