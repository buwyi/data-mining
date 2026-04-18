import type { FlowNodeWire } from '../domain/flow'
import { readWireDisplayName, readWireNodeId } from '../domain/flow/nodeWireHelpers'
import { tipdmCanvasNodeIdMatchesSocketJobId } from './tipdmSocketNodeIdMatch'

/**
 * 根据 Socket/调度侧的节点 id 在流程节点列表中解析用于展示的节点名称（`name`，缺省为 wire.id）。
 * 与画布上 `tipdmCanvasNodeIdMatchesSocketJobId` 规则一致。
 */
export function resolveFlowNodeDisplayNameByJobId(
  nodes: FlowNodeWire[],
  socketOrCanvasNodeId: string,
): string {
  const key = String(socketOrCanvasNodeId).trim()
  if (!key.length) return '—'
  for (const wire of nodes) {
    try {
      const wid = readWireNodeId(wire)
      if (wid === key || tipdmCanvasNodeIdMatchesSocketJobId(wid, key)) {
        return readWireDisplayName(wire)
      }
    } catch {
      /* 跳过异常 wire */
    }
  }
  return key
}
