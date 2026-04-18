/** 将 `GET /api/widget/list` 行转为 elementType 下拉的数字选项（字段名宽松） */
export function buildWidgetElementTypeOptions(
  rows: Record<string, unknown>[],
): { value: number; label: string }[] {
  const seen = new Set<number>()
  const out: { value: number; label: string }[] = []

  for (const row of rows) {
    const id = pickNumericField(row, ['id', 'type', 'elementType', 'code', 'widgetId'])
    if (id === null || seen.has(id)) continue
    seen.add(id)
    const label =
      pickStringField(row, ['name', 'label', 'title', 'text', 'description']) ?? `类型 ${id}`
    out.push({ value: id, label: `${id} · ${label}` })
  }

  out.sort((a, b) => a.value - b.value)
  return out
}

function pickNumericField(obj: Record<string, unknown>, keys: string[]): number | null {
  for (const k of keys) {
    const v = obj[k]
    if (typeof v === 'number' && Number.isFinite(v)) return Math.trunc(v)
    if (typeof v === 'string' && /^\d+$/.test(v)) {
      const n = Number.parseInt(v, 10)
      if (Number.isFinite(n)) return n
    }
  }
  return null
}

function pickStringField(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = obj[k]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return null
}
