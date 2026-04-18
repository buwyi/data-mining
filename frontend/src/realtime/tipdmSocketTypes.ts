/** 画布上节点运行态高亮（含单次运行结束后的成功态） */
export type SocketRunVisualVariant = 'running' | 'success' | 'failed' | 'skipped' | 'queued'

/** 节点终态（不含「运行中」） */
export type SocketRunTerminalVariant = Exclude<SocketRunVisualVariant, 'running'>

/** 从全局 Socket 归一化后的流程事件（具体字段以后端为准，解析器做宽松兼容） */
export type TipdmFlowSocketEvent =
  | { kind: 'node_active'; nodeId: string; nodeIndex: string; projectId?: number }
  | {
      kind: 'node_terminal'
      nodeId: string
      nodeIndex: string
      projectId?: number
      terminal: SocketRunTerminalVariant
    }
  | { kind: 'flow_done' }
