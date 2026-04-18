/** 将 `GET /api/algorithm/list` 行归一为 AutoComplete / Select 选项（优先完整 Java 类名） */
export function buildAlgorithmAutoCompleteOptions(
  rows: Record<string, unknown>[],
): { value: string; label: string }[] {
  const seen = new Set<string>()
  const out: { value: string; label: string }[] = []

  for (const row of rows) {
    const value = pickAlgorithmValue(row)
    if (!value || seen.has(value)) continue
    seen.add(value)
    const short =
      (typeof row.name === 'string' && row.name.trim()) ||
      (typeof row.label === 'string' && row.label.trim()) ||
      value.split('.').pop() ||
      value
    const tail = value.length > 56 ? `${value.slice(0, 53)}…` : value
    out.push({
      value,
      label: `${short} — ${tail}`,
    })
  }
  return out
}

function pickAlgorithmValue(row: Record<string, unknown>): string | null {
  const fqKeys = ['className', 'targetAlgorithm', 'fullName', 'qualifiedName', 'algorithmClass', 'implClass']
  for (const k of fqKeys) {
    const v = row[k]
    if (typeof v === 'string' && v.includes('.') && v.trim().length > 2) return v.trim()
  }
  for (const k of ['name', 'label', 'code', 'text', 'title', 'id'] as const) {
    const v = row[k]
    if (typeof v === 'string' && v.trim()) return v.trim()
    if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  }
  return null
}
