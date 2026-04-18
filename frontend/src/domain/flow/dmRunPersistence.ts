import type { DmFlowRunStatus, FlowNodeWire, FlowRunSummaryPersist } from './flowWireTypes'

/** 与 TipDM 节点 JSON 并存的前端扩展字段（`dm` 前缀避免与后端字段冲突） */
export const DM_NODE_LAST_RUN_STATUS = 'dmLastRunStatus'
export const DM_NODE_LAST_RUN_AT = 'dmLastRunAt'

export type DmNodeRunStatus = 'success' | 'failed' | 'skipped'

export type { DmFlowRunStatus, FlowRunSummaryPersist }

export function readDmNodeLastRunStatus(wire: FlowNodeWire): DmNodeRunStatus | undefined {
  const v = wire[DM_NODE_LAST_RUN_STATUS]
  if (v === 'success' || v === 'failed' || v === 'skipped') return v
  return undefined
}

export function readDmNodeLastRunAt(wire: FlowNodeWire): string | undefined {
  const v = wire[DM_NODE_LAST_RUN_AT]
  return typeof v === 'string' && v.length > 0 ? v : undefined
}
