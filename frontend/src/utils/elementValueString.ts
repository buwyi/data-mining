/** 表单展示用：把 element.value 转成可编辑字符串 */
export function stringifyElementValueForForm(v: unknown): string {
  if (v === undefined || v === null) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  try {
    return JSON.stringify(v, null, 2)
  } catch {
    return String(v)
  }
}

/** 保存回写：尽量还原为 string / number / JSON */
export function parseElementValueFromForm(s: string): unknown {
  const t = s.trim()
  if (!t) return ''
  if ((t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']'))) {
    try {
      return JSON.parse(t) as unknown
    } catch {
      return s
    }
  }
  if (t === 'true') return true
  if (t === 'false') return false
  const n = Number(t)
  if (t !== '' && Number.isFinite(n) && String(n) === t) return n
  return s
}

/** `tabs[].elements[].extra` 表单展示 */
export function stringifyExtraForForm(extra: unknown): string {
  if (extra === undefined || extra === null) return ''
  if (typeof extra === 'object' && !Array.isArray(extra)) {
    try {
      return JSON.stringify(extra, null, 2)
    } catch {
      return '{}'
    }
  }
  return ''
}

/** 解析为对象；空串视为 `{}` */
export function parseExtraFromForm(s: string): Record<string, unknown> {
  const t = s.trim()
  if (!t) return {}
  let v: unknown
  try {
    v = JSON.parse(t) as unknown
  } catch {
    throw new Error('extra 不是合法 JSON')
  }
  if (v === null || typeof v !== 'object' || Array.isArray(v)) {
    throw new Error('extra 须为 JSON 对象 { … }')
  }
  return v as Record<string, unknown>
}
