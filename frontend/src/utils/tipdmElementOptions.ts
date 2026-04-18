/** 旧版 `TipSelectedSingle` / `TipRadio`：`"展示:值;展示:值"` */
export function parseTipdmOptionString(raw: unknown): { label: string; value: string }[] {
  if (typeof raw !== 'string' || !raw.trim()) return []
  return raw
    .split(';')
    .map((part) => {
      const idx = part.indexOf(':')
      if (idx < 0) {
        const t = part.trim()
        return t ? { label: t, value: t } : null
      }
      const label = part.slice(0, idx).trim()
      const value = part.slice(idx + 1).trim()
      return value ? { label: label || value, value } : null
    })
    .filter((x): x is { label: string; value: string } => x !== null)
}
