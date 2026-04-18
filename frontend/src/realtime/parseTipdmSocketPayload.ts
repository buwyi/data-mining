import type { TipdmFlowSocketEvent } from './tipdmSocketTypes'

/** TipDM `dmserver.websocket.dto.WorkFlowMessage`（Fastjson 序列化：常见为枚举名，也可能为序数） */
const TIPDM_WF_CATEGORY = 'WORKFLOW'
const TIPDM_STATES = new Set(['INIT', 'RUNNING', 'COMPLETE', 'ERROR', 'ABORT'])
const TIPDM_TYPES = new Set(['WORKFLOW', 'NODE', 'LINK'])

/** 与 `com.tipdm.framework.dmserver.websocket.dto.Category` 声明顺序一致 */
const TIPDM_CATEGORY_ENUM_ORDER = ['WORKFLOW', 'MODEL'] as const
/** 与 `...core.scheduling.State` 声明顺序一致 */
const TIPDM_STATE_ENUM_ORDER = ['INIT', 'RUNNING', 'COMPLETE', 'ERROR', 'ABORT'] as const
/** 与 `...websocket.dto.Type` 声明顺序一致 */
const TIPDM_TYPE_ENUM_ORDER = ['WORKFLOW', 'NODE', 'LINK'] as const

function coerceTipdmEnumName(raw: unknown, orderedNames: readonly string[]): string | null {
  if (typeof raw === 'number' && Number.isInteger(raw) && raw >= 0 && raw < orderedNames.length) {
    return orderedNames[raw]!
  }
  if (typeof raw === 'string') {
    const u = raw.trim().toUpperCase()
    if ((orderedNames as readonly string[]).includes(u)) return u
  }
  return null
}

function tipdmStateToken(raw: unknown): string {
  return (
    coerceTipdmEnumName(raw, TIPDM_STATE_ENUM_ORDER) ??
    String(raw ?? '')
      .trim()
      .toUpperCase()
  )
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

/** Socket.IO 首参常为 JSON 字符串（见 TipDM `SocketServer.notifyWorkFlowExecStatus`） */
function unwrapSocketFirstArg(first: unknown): unknown {
  if (typeof first !== 'string') return first
  const t = first.trim()
  if (!t.startsWith('{') && !t.startsWith('[')) return first
  try {
    return JSON.parse(t) as unknown
  } catch {
    return first
  }
}

/**
 * TipDM：事件名为 `workFlowId`，负载为 `WorkFlowMessage` JSON。
 * - 整流程结束：`type=WORKFLOW` + `state=COMPLETE` 且无 `nodeId`
 * - 节点/连线执行中：`state=RUNNING` + `nodeId`（`type` 为 NODE 或 LINK）
 * - 节点失败：`state=ERROR` 或 `ABORT` + `nodeId`
 */
function parseTipdmWorkFlowMessagePayload(first: unknown): TipdmFlowSocketEvent | null {
  const raw = unwrapSocketFirstArg(first)
  const r = asRecord(raw)
  if (!r) return null

  const category =
    coerceTipdmEnumName(r.category, TIPDM_CATEGORY_ENUM_ORDER) ??
    String(r.category ?? '')
      .trim()
      .toUpperCase()
  if (category !== TIPDM_WF_CATEGORY) return null

  const state = tipdmStateToken(r.state)
  if (!TIPDM_STATES.has(state)) return null

  const typeResolved =
    coerceTipdmEnumName(r.type, TIPDM_TYPE_ENUM_ORDER) ??
    (TIPDM_TYPES.has(String(r.type ?? '').trim().toUpperCase())
      ? String(r.type ?? '').trim().toUpperCase()
      : 'NODE')
  const type = TIPDM_TYPES.has(typeResolved) ? typeResolved : 'NODE'
  const nodeIdRaw = r.nodeId
  const nodeId =
    typeof nodeIdRaw === 'string' && nodeIdRaw.length > 0
      ? nodeIdRaw
      : typeof nodeIdRaw === 'number' && Number.isFinite(nodeIdRaw)
        ? String(nodeIdRaw)
        : null

  if (type === 'WORKFLOW' && state === 'COMPLETE' && !nodeId) {
    return { kind: 'flow_done' }
  }

  if (state === 'RUNNING' && nodeId && (type === 'NODE' || type === 'LINK')) {
    return { kind: 'node_active', nodeId, nodeIndex: '' }
  }

  if ((state === 'ERROR' || state === 'ABORT') && nodeId) {
    return {
      kind: 'node_terminal',
      nodeId,
      nodeIndex: '',
      terminal: state === 'ABORT' ? 'skipped' : 'failed',
    }
  }

  /** 单节点/连线执行成功（Quartz `jobWasExecuted` 无异常时推送 COMPLETE + nodeId） */
  if (state === 'COMPLETE' && nodeId && (type === 'NODE' || type === 'LINK')) {
    return { kind: 'node_terminal', nodeId, nodeIndex: '', terminal: 'success' }
  }

  return null
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = obj[k]
    if (typeof v === 'string' && v.length > 0) return v
    if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  }
  return null
}

function pickOptionalProjectId(obj: Record<string, unknown>): number | undefined {
  const keys = ['documentId', 'projectId', 'document_id', 'project_id']
  for (const k of keys) {
    const v = obj[k]
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) return v
    if (typeof v === 'string' && /^\d+$/.test(v)) {
      const n = Number.parseInt(v, 10)
      if (n > 0) return n
    }
  }
  return undefined
}

/** 从事件体及其常见嵌套字段（data / payload / body）收集可解析对象 */
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

const FLOW_DONE_EVENT_SNIPPETS = [
  'flowend',
  'flow_end',
  'workflowend',
  'workflow_end',
  'executeend',
  'execute_end',
  'finishflow',
  'finish_flow',
  'flowstop',
  'flow_stop',
]

function eventNameSuggestsFlowDone(eventName: string): boolean {
  const n = eventName.toLowerCase()
  return FLOW_DONE_EVENT_SNIPPETS.some((s) => n.includes(s))
}

function payloadSuggestsFlowDone(first: unknown): boolean {
  const unwrapped = unwrapSocketFirstArg(first)
  for (const obj of collectFieldObjects(unwrapped)) {
    const cat =
      coerceTipdmEnumName(obj.category, TIPDM_CATEGORY_ENUM_ORDER) ??
      String(obj.category ?? '')
        .trim()
        .toUpperCase()
    const nodeId = obj.nodeId
    const hasNodeId =
      (typeof nodeId === 'string' && nodeId.length > 0) ||
      (typeof nodeId === 'number' && Number.isFinite(nodeId))
    const st = tipdmStateToken(obj.state ?? obj.status ?? obj.flowState)
    // TipDM 单节点完成也是 state=COMPLETE + nodeId，不得当作整流程结束
    if (cat === TIPDM_WF_CATEGORY && hasNodeId && st === 'COMPLETE') continue

    if (obj.finished === true || obj.flowFinished === true || obj.flowEnd === true) return true
    const stRaw = obj.state ?? obj.status ?? obj.flowState
    if (stRaw === 'FINISHED' || stRaw === 'END' || stRaw === 'STOPPED') return true
    if (stRaw === 'COMPLETE' && !(cat === TIPDM_WF_CATEGORY && hasNodeId)) return true
  }
  return false
}

function parseNodeActive(first: unknown): TipdmFlowSocketEvent | null {
  const unwrapped = unwrapSocketFirstArg(first)
  for (const obj of collectFieldObjects(unwrapped)) {
    const nodeId = pickString(obj, ['curNodeId', 'componentId', 'nodeId', 'component_id', 'node_id'])
    if (!nodeId) continue
    const nodeIndex = pickString(obj, ['curNodeIndex', 'nodeIndex', 'componentIndex', 'index']) ?? ''
    const projectId = pickOptionalProjectId(obj)
    return { kind: 'node_active', nodeId, nodeIndex, projectId }
  }
  if (typeof unwrapped === 'string' && /^\d+$/.test(unwrapped)) {
    return { kind: 'node_active', nodeId: unwrapped, nodeIndex: '' }
  }
  return null
}

const RUNNING_STATUS = new Set([
  'RUNNING',
  'ACTIVE',
  'EXECUTING',
  'STARTED',
  'IN_PROGRESS',
  'PROCESSING',
])

const FAILED_STATUS = new Set([
  'FAILED',
  'ERROR',
  'FAILURE',
  'ABORTED',
  'ABORT',
  'REJECTED',
  'EXCEPTION',
])

const SKIPPED_STATUS = new Set(['SKIPPED', 'SKIP', 'OMITTED', 'BYPASSED', 'BYPASS'])

const QUEUED_STATUS = new Set(['QUEUED', 'QUEUE', 'PENDING', 'WAITING'])

function normalizeStatusToken(v: unknown): string {
  const fromEnum = coerceTipdmEnumName(v, TIPDM_STATE_ENUM_ORDER)
  if (fromEnum) return fromEnum
  return String(v ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_')
}

/** 在能解析到节点 id 的前提下，根据负载或事件名识别失败/跳过/排队 */
function parseNodeTerminalFromPayload(eventName: string, first: unknown): TipdmFlowSocketEvent | null {
  const na = parseNodeActive(first)
  if (!na || na.kind !== 'node_active') return null

  for (const obj of collectFieldObjects(first)) {
    const raw = obj.status ?? obj.state ?? obj.runState ?? obj.stepState
    const u = normalizeStatusToken(raw)
    if (!u) continue
    if (RUNNING_STATUS.has(u)) return null
    if (FAILED_STATUS.has(u)) {
      return {
        kind: 'node_terminal',
        nodeId: na.nodeId,
        nodeIndex: na.nodeIndex,
        projectId: na.projectId,
        terminal: 'failed',
      }
    }
    if (SKIPPED_STATUS.has(u)) {
      return {
        kind: 'node_terminal',
        nodeId: na.nodeId,
        nodeIndex: na.nodeIndex,
        projectId: na.projectId,
        terminal: 'skipped',
      }
    }
    if (QUEUED_STATUS.has(u)) {
      return {
        kind: 'node_terminal',
        nodeId: na.nodeId,
        nodeIndex: na.nodeIndex,
        projectId: na.projectId,
        terminal: 'queued',
      }
    }
  }

  const en = eventName.toLowerCase()
  if (/(^|_)(node|step|component)_(fail|error|abort)|fail(ed)?_(node|step)|error_(node|step)/.test(en)) {
    return {
      kind: 'node_terminal',
      nodeId: na.nodeId,
      nodeIndex: na.nodeIndex,
      projectId: na.projectId,
      terminal: 'failed',
    }
  }
  if (/(^|_)(skip|skipped|omit|bypass)(_|ed|$)/.test(en)) {
    return {
      kind: 'node_terminal',
      nodeId: na.nodeId,
      nodeIndex: na.nodeIndex,
      projectId: na.projectId,
      terminal: 'skipped',
    }
  }
  if (/(queue|pending|waiting).*(node|step|component)|(node|step|component).*(queue|pending|waiting)/.test(en)) {
    return {
      kind: 'node_terminal',
      nodeId: na.nodeId,
      nodeIndex: na.nodeIndex,
      projectId: na.projectId,
      terminal: 'queued',
    }
  }
  return null
}

/**
 * 将 Socket.IO 事件名与首参解析为统一事件；无法识别时返回 null。
 * TipDM：流程事件名为 **workFlowId**（与 execute 返回一致），负载为 **WorkFlowMessage** JSON 字符串。
 */
export function parseTipdmSocketPayload(eventName: string, args: unknown[]): TipdmFlowSocketEvent | null {
  if (eventName === 'connect' || eventName === 'disconnect' || eventName === 'connect_error') {
    return null
  }
  const first = args[0]
  const fromTipdmWf = parseTipdmWorkFlowMessagePayload(first)
  if (fromTipdmWf) return fromTipdmWf

  if (eventNameSuggestsFlowDone(eventName) || payloadSuggestsFlowDone(first)) {
    return { kind: 'flow_done' }
  }
  const terminal = parseNodeTerminalFromPayload(eventName, first)
  if (terminal) return terminal
  return parseNodeActive(first)
}
