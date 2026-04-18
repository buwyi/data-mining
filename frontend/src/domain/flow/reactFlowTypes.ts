import type { Edge, Node } from '@xyflow/react'
import type { FlowLinkWire, FlowNodeWire } from './flowWireTypes'

/** 自定义节点携带完整 wire，便于序列化回后端 JSON */
export type TipdmNodeData = {
  wire: FlowNodeWire
}

/** 自定义边携带原始 wire（含 `d` 等），编辑后可回写 */
export type TipdmEdgeData = {
  wire: FlowLinkWire
}

/** 与 `TIPDM_WIRE_NODE_TYPE` 对应的 RF 节点类型（用于 `NodeProps<…>`） */
export type TipdmWireRfNode = Node<TipdmNodeData, 'tipdmWire'>

export type TipdmRfEdge = Edge<TipdmEdgeData>
