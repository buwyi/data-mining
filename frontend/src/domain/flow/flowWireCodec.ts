import type {
  FlowCanvasStyle,
  FlowLinkWire,
  FlowNodeWire,
  PersistedFlowDocument,
} from './flowWireTypes'
import type { DmFlowRunStatus, FlowRunSummaryPersist } from './flowWireTypes'

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

export const DEFAULT_STYLE_ON_EMPTY: FlowCanvasStyle = {
  width: 100,
  height: 120,
  isMini: false,
  curHeight: 0,
  curWidth: 0,
}

export function emptyPersistedFlowDocument(): PersistedFlowDocument {
  return {
    style: { ...DEFAULT_STYLE_ON_EMPTY },
    nodes: [],
    links: [],
  }
}

function parseStyle(raw: unknown, fallbackHeight: number): FlowCanvasStyle {
  if (!isRecord(raw)) {
    return { ...DEFAULT_STYLE_ON_EMPTY, height: fallbackHeight }
  }
  const width = typeof raw.width === 'number' ? raw.width : DEFAULT_STYLE_ON_EMPTY.width
  const height = typeof raw.height === 'number' ? raw.height : fallbackHeight
  const isMini = typeof raw.isMini === 'boolean' ? raw.isMini : DEFAULT_STYLE_ON_EMPTY.isMini
  const curHeight = typeof raw.curHeight === 'number' ? raw.curHeight : DEFAULT_STYLE_ON_EMPTY.curHeight
  const curWidth = typeof raw.curWidth === 'number' ? raw.curWidth : DEFAULT_STYLE_ON_EMPTY.curWidth
  return { width, height, isMini, curHeight, curWidth }
}

function parseLink(raw: unknown): FlowLinkWire {
  if (!isRecord(raw)) throw new Error('连线项不是对象')
  const id = raw.id
  const source = raw.source
  const target = raw.target
  const inputPortId = raw.inputPortId
  const outputPortId = raw.outputPortId
  if (typeof id !== 'string' || typeof source !== 'string' || typeof target !== 'string') {
    throw new Error('连线缺少 id/source/target')
  }
  if (typeof inputPortId !== 'string' || typeof outputPortId !== 'string') {
    throw new Error('连线缺少 inputPortId/outputPortId')
  }
  return {
    id,
    source,
    target,
    inputPortId,
    outputPortId,
    d: typeof raw.d === 'string' ? raw.d : undefined,
    runStyle: typeof raw.runStyle === 'string' ? raw.runStyle : undefined,
  }
}

function parseNodes(raw: unknown): FlowNodeWire[] {
  if (!Array.isArray(raw)) return []
  return raw.filter(isRecord) as FlowNodeWire[]
}

function parseLinks(raw: unknown): FlowLinkWire[] {
  if (!Array.isArray(raw)) return []
  return raw.map((item) => parseLink(item))
}

/**
 * 将接口返回的 `data.json` 字符串解析为文档模型。
 * 与旧版 `fillCurrentJson` 行为对齐：无 `style` 时画布高度默认 120。
 */
export function parseFlowDocumentFromApiJsonString(jsonStr: string | null | undefined): PersistedFlowDocument {
  if (jsonStr === null || jsonStr === undefined || jsonStr === '') {
    return emptyPersistedFlowDocument()
  }
  let root: unknown
  try {
    root = JSON.parse(jsonStr) as unknown
  } catch {
    throw new Error('工程 json 字段不是合法 JSON')
  }
  return parseFlowDocumentFromUnknown(root)
}

export function parseFlowDocumentFromUnknown(root: unknown): PersistedFlowDocument {
  if (!isRecord(root)) {
    throw new Error('工程 Flow 根节点应为对象')
  }
  const hasStyle = 'style' in root && root.style !== undefined
  const style = parseStyle(root.style, hasStyle ? DEFAULT_STYLE_ON_EMPTY.height : 120)
  const nodes = parseNodes(root.nodes)
  const links = parseLinks(root.links)
  const summary = Array.isArray(root.summary) ? root.summary : undefined
  const flowRun = parseFlowRunSummaryFields(root)
  return { style, nodes, links, summary, ...flowRun }
}

function parseFlowRunSummaryFields(root: Record<string, unknown>): FlowRunSummaryPersist {
  const st = root.dmLastFlowStatus
  const dmLastFlowStatus: DmFlowRunStatus | undefined =
    st === 'success' || st === 'failed' || st === 'aborted' ? st : undefined
  const at = root.dmLastFlowFinishedAt
  const dmLastFlowFinishedAt = typeof at === 'string' && at.length > 0 ? at : undefined
  const msg = root.dmLastFlowMessage
  const dmLastFlowMessage = typeof msg === 'string' && msg.length > 0 ? msg : undefined
  const out: FlowRunSummaryPersist = {}
  if (dmLastFlowStatus !== undefined) out.dmLastFlowStatus = dmLastFlowStatus
  if (dmLastFlowFinishedAt !== undefined) out.dmLastFlowFinishedAt = dmLastFlowFinishedAt
  if (dmLastFlowMessage !== undefined) out.dmLastFlowMessage = dmLastFlowMessage
  return out
}

/** 组装 POST `/api/project/{id}` 的 `content` 字段（style/nodes/links + 可选 `dmLastFlow*`） */
export function stringifyFlowForSave(
  payload: {
    style: FlowCanvasStyle
    nodes: FlowNodeWire[]
    links: FlowLinkWire[]
  } & FlowRunSummaryPersist,
): string {
  const base: Record<string, unknown> = {
    style: payload.style,
    nodes: payload.nodes,
    links: payload.links,
  }
  if (payload.dmLastFlowStatus !== undefined) base.dmLastFlowStatus = payload.dmLastFlowStatus
  if (payload.dmLastFlowFinishedAt !== undefined) base.dmLastFlowFinishedAt = payload.dmLastFlowFinishedAt
  if (payload.dmLastFlowMessage !== undefined) base.dmLastFlowMessage = payload.dmLastFlowMessage
  return JSON.stringify(base)
}
