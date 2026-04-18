export type ShareableSelectOption = {
  label: string
  value: number
}

/** 将 `GET /token/info` → `shareable` 转为下拉选项（结构以后端为准） */
export function parseShareableToOptions(shareable: unknown[] | undefined): ShareableSelectOption[] {
  if (!Array.isArray(shareable) || shareable.length === 0) return []
  const out: ShareableSelectOption[] = []
  for (const item of shareable) {
    if (typeof item === 'number' && Number.isFinite(item)) {
      out.push({ label: `用户 ${item}`, value: item })
      continue
    }
    if (item != null && typeof item === 'object' && !Array.isArray(item)) {
      const o = item as Record<string, unknown>
      const rawId = o.id ?? o.userId ?? o.user_id
      const id = typeof rawId === 'number' ? rawId : Number.parseInt(String(rawId), 10)
      if (!Number.isFinite(id)) continue
      const name =
        (typeof o.name === 'string' && o.name.trim()) ||
        (typeof o.username === 'string' && o.username.trim()) ||
        (typeof o.loginName === 'string' && o.loginName.trim()) ||
        ''
      out.push({ label: name ? `${name}（${id}）` : `用户 ${id}`, value: id })
    }
  }
  return out
}
