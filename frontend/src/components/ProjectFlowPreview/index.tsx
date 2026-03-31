import {
  Background,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useEffect, useMemo } from 'react'
import type { FlowLinkWire, FlowNodeWire } from '../../domain/flow'
import { persistedFlowToReactFlow, TIPDM_WIRE_NODE_TYPE } from '../../domain/flow/reactFlowAdapter'
import { TipdmWireNode } from '../TipdmWireNode'

const nodeTypes = { [TIPDM_WIRE_NODE_TYPE]: TipdmWireNode }

function FitViewWhenNodesChange({ count }: { count: number }) {
  const { fitView } = useReactFlow()
  useEffect(() => {
    if (count === 0) return
    const id = requestAnimationFrame(() => {
      fitView({ padding: 0.15 })
    })
    return () => cancelAnimationFrame(id)
  }, [count, fitView])
  return null
}

export type ProjectFlowPreviewProps = {
  nodes: FlowNodeWire[]
  links: FlowLinkWire[]
  /** 预览区高度（px） */
  height?: number
}

export function ProjectFlowPreview({ nodes, links, height = 440 }: ProjectFlowPreviewProps) {
  const initial = useMemo(() => persistedFlowToReactFlow({ nodes, links }), [nodes, links])
  const [rfNodes, setRfNodes, onNodesChange] = useNodesState(initial.nodes)
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState(initial.edges)

  useEffect(() => {
    const next = persistedFlowToReactFlow({ nodes, links })
    setRfNodes(next.nodes)
    setRfEdges(next.edges)
  }, [nodes, links, setRfEdges, setRfNodes])

  return (
    <div style={{ height, border: '1px solid #f0f0f0', borderRadius: 8, overflow: 'hidden' }}>
      <ReactFlowProvider>
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnDrag
          zoomOnScroll
          minZoom={0.2}
          maxZoom={1.5}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={16} size={1} />
          <Controls showInteractive={false} />
          <FitViewWhenNodesChange count={rfNodes.length} />
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  )
}
