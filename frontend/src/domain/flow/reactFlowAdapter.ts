import type { Edge } from '@xyflow/react'
import type { FlowCanvasStyle, FlowLinkWire, FlowNodeWire, PersistedFlowDocument } from './flowWireTypes'
import {
  listWirePorts,
  portRecordId,
  readWireNodeId,
  readWirePosition,
} from './nodeWireHelpers'
import type { TipdmEdgeData, TipdmWireRfNode } from './reactFlowTypes'

export const TIPDM_WIRE_NODE_TYPE = 'tipdmWire' as const

/**
 * 磁盘 / store 中的 nodes+links → React Flow 受控元素。
 * 端口使用 `sourceHandle` / `targetHandle` 与旧版 `outputPortId` / `inputPortId` 对齐。
 */
export function persistedFlowToReactFlow(
  doc: Pick<PersistedFlowDocument, 'nodes' | 'links'>,
): { nodes: TipdmWireRfNode[]; edges: Edge<TipdmEdgeData>[] } {
  const nodes: TipdmWireRfNode[] = doc.nodes.map((wire) => ({
    id: readWireNodeId(wire),
    type: TIPDM_WIRE_NODE_TYPE,
    position: readWirePosition(wire),
    data: { wire },
  }))

  const edges: Edge<TipdmEdgeData>[] = doc.links.map((link) => ({
    id: link.id,
    source: link.source,
    target: link.target,
    sourceHandle: link.outputPortId,
    targetHandle: link.inputPortId,
    type: 'smoothstep',
    data: { wire: { ...link } },
  }))

  return { nodes, edges }
}

/**
 * React Flow 当前图 → 可持久化的文档（不含 `summary`；保存接口只传 style/nodes/links）。
 * `position` 回写到 wire 的 `left`/`top`；边在存在 `data.wire` 时与其合并，保留 `d` 等字段。
 */
export function reactFlowToPersistedPayload(
  rfNodes: TipdmWireRfNode[],
  rfEdges: Edge<TipdmEdgeData>[],
  style: FlowCanvasStyle,
): Pick<PersistedFlowDocument, 'style' | 'nodes' | 'links'> {
  const nodes: FlowNodeWire[] = rfNodes.map((n) => {
    const wire: FlowNodeWire = { ...n.data.wire }
    wire.id = n.id
    wire.left = n.position.x
    wire.top = n.position.y
    return wire
  })

  const links: FlowLinkWire[] = rfEdges.map((e) => {
    const base = e.data?.wire
    const sourceHandle = e.sourceHandle ?? ''
    const targetHandle = e.targetHandle ?? ''
    if (base) {
      return {
        ...base,
        id: e.id,
        source: e.source,
        target: e.target,
        outputPortId: sourceHandle || base.outputPortId,
        inputPortId: targetHandle || base.inputPortId,
      }
    }
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      outputPortId: sourceHandle,
      inputPortId: targetHandle,
    }
  })

  return { style, nodes, links }
}

/** 将节点上的端口 id 汇总（用于校验边 handle 是否存在，可选） */
export function collectWireNodePortIds(wire: FlowNodeWire): { sources: Set<string>; targets: Set<string> } {
  const sources = new Set<string>()
  const targets = new Set<string>()
  for (const p of listWirePorts(wire, 'outputs')) {
    const id = portRecordId(p)
    if (id) sources.add(id)
  }
  for (const p of listWirePorts(wire, 'inputs')) {
    const id = portRecordId(p)
    if (id) targets.add(id)
  }
  return { sources, targets }
}
