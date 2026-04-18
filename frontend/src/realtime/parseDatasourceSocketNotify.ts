function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

function unwrapJsonStringArg(first: unknown): unknown {
  if (typeof first !== 'string') return first
  const t = first.trim()
  if (!t.startsWith('{') && !t.startsWith('[')) return first
  try {
    return JSON.parse(t) as unknown
  } catch {
    return first
  }
}

function collectFieldObjects(first: unknown): Record<string, unknown>[] {
  const r = asRecord(first)
  if (!r) return []
  const out: Record<string, unknown>[] = [r]
  for (const key of ['data', 'payload', 'body'] as const) {
    const inner = asRecord(r[key])
    if (inner) out.push(inner)
  }
  return out
}

function pickMessage(obj: Record<string, unknown>): string | null {
  for (const k of ['message', 'msg', 'text', 'info', 'description', 'detail'] as const) {
    const v = obj[k]
    if (typeof v === 'string' && v.trim().length > 0) return v.trim()
  }
  return null
}

/** 事件名需与数据源/表同步相关（含 TipDM `SocketServer.sendDataSyncResult` → `dataSyncResult`） */
function eventNameSuggestsDatasourceNotify(eventName: string): boolean {
  const n = eventName.toLowerCase()
  if (n === 'connect' || n === 'disconnect' || n === 'connect_error') return false
  if (n === 'datasyncresult') return true
  return (
    n.includes('datasource') ||
    n.includes('data_source') ||
    n.includes('datasource_sync') ||
    n.includes('source_sync') ||
    n.includes('table_sync') ||
    n.includes('sync_table') ||
    (n.includes('sync') && (n.includes('source') || n.includes('table')))
  )
}

/**
 * 从 Socket 事件解析数据源同步等提示文案；无法识别时返回 null。
 * 与流程进度解析独立，避免互相覆盖。
 */
export function parseDatasourceSocketNotify(eventName: string, args: unknown[]): string | null {
  if (!eventNameSuggestsDatasourceNotify(eventName)) return null
  const first = unwrapJsonStringArg(args[0])
  for (const obj of collectFieldObjects(first)) {
    const m = pickMessage(obj)
    if (m) return m
  }
  if (typeof first === 'string' && first.trim().length > 0) return first.trim()
  return `数据源相关事件：${eventName}`
}
