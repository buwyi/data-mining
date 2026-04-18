/** 节点 tabs 里 `value` 与表单字符串互转（支持 JSON 对象/数组，对齐旧版复杂控件存盘形态） */

export function wireElementValueToEditString(value: unknown): string {
  if (value === undefined || value === null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

/**
 * 将用户在文本框中的输入写回 `value`：空串 → ''；可 JSON 解析则存解析结果，否则原样字符串。
 */
export function parseWireElementCommit(raw: string): unknown {
  const t = raw.trim()
  if (t === '') return ''
  try {
    return JSON.parse(t) as unknown
  } catch {
    return raw
  }
}
