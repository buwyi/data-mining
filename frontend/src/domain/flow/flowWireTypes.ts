/**
 * Flow「线格式」类型：与磁盘/接口中的 JSON 一致（POST `content` 字段）。
 * 阶段 3 接入 React Flow 时，可在此之上增加 RF 专用视图模型，并通过 adapter 与本层互转。
 */

export type FlowCanvasStyle = {
  width: number
  height: number
  isMini: boolean
  curHeight: number
  curWidth: number
}

/** 后端连线对象（与旧版 Vue 中 links 项一致） */
export type FlowLinkWire = {
  id: string
  source: string
  target: string
  inputPortId: string
  outputPortId: string
  d?: string
  runStyle?: string
}

/**
 * 节点在磁盘上的结构非常复杂（tabs、inputs、outputs…），阶段 2 先按「不透明数组」持有，
 * 与旧版 `flowData.nodes` 对齐；后续可对常用字段逐步收紧类型。
 */
export type FlowNodeWire = Record<string, unknown>

/** 最近一次整流程运行结果（持久化在工程 JSON 根级） */
export type DmFlowRunStatus = 'success' | 'failed' | 'aborted'

export type FlowRunSummaryPersist = {
  dmLastFlowStatus?: DmFlowRunStatus
  dmLastFlowFinishedAt?: string
  dmLastFlowMessage?: string
}

/**
 * 解析工程 `data.json` 后的文档（可含服务端附加的 `summary`，保存时通常只写 style/nodes/links）。
 * `dmLastFlow*` 为本站扩展：记录最近一次整流程运行结果，便于再次打开工程时识别。
 */
export type PersistedFlowDocument = {
  style: FlowCanvasStyle
  nodes: FlowNodeWire[]
  links: FlowLinkWire[]
  summary?: unknown[]
} & FlowRunSummaryPersist
