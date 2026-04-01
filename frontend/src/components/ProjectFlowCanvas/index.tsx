import {
  addEdge,
  Background,
  Controls,
  type Connection,
  type Edge,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useCallback, useEffect, useRef } from 'react'
import {
  persistedFlowToReactFlow,
  reactFlowToPersistedPayload,
  reconcileInputPortsConnected,
  TIPDM_WIRE_NODE_TYPE,
  type TipdmEdgeData,
  type TipdmWireRfNode,
} from '../../domain/flow'
import { useProjectStore } from '../../stores/projectStore'
import { TipdmWireNode } from '../TipdmWireNode'

const nodeTypes = { [TIPDM_WIRE_NODE_TYPE]: TipdmWireNode }

function FitViewOnRemoteRevision({ revision }: { revision: number }) {
  const { fitView } = useReactFlow()
  useEffect(() => {
    if (revision === 0) return
    const id = requestAnimationFrame(() => {
      fitView({ padding: 0.15, duration: 200 })
    })
    return () => cancelAnimationFrame(id)
  }, [revision, fitView])
  return null
}

export type ProjectFlowCanvasProps = {
  /** 预览区高度（px） */
  height?: number
  /** 只读：不可拖拽、连线、选择、删除 */
  readOnly?: boolean
}

function ProjectFlowCanvasInner({ height = 520, readOnly = false }: ProjectFlowCanvasProps) {
  const flowRemoteRevision = useProjectStore((s) => s.flowRemoteRevision)
  const pushFlowToStore = useProjectStore((s) => s.setFlowGraph)
  const skipNextStoreSyncRef = useRef(false)

  const [rfNodes, setRfNodes, onNodesChange] = useNodesState<TipdmWireRfNode>([])
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState<Edge<TipdmEdgeData>>([])

  useEffect(() => {
    const { nodes, links } = useProjectStore.getState().flowData
    const next = persistedFlowToReactFlow({ nodes, links })
    skipNextStoreSyncRef.current = true
    setRfNodes(next.nodes)
    setRfEdges(next.edges)
  }, [flowRemoteRevision, setRfEdges, setRfNodes])

  const syncStoreFromCanvas = useCallback(() => {
    if (readOnly) return
    const style = useProjectStore.getState().flowData.contentStyle
    const raw = reactFlowToPersistedPayload(rfNodes, rfEdges, style)
    const nodes = reconcileInputPortsConnected([...raw.nodes], raw.links)
    pushFlowToStore(nodes, raw.links)
  }, [readOnly, rfEdges, rfNodes, pushFlowToStore])

  useEffect(() => {
    if (readOnly) return
    if (skipNextStoreSyncRef.current) {
      skipNextStoreSyncRef.current = false
      return
    }
    syncStoreFromCanvas()
  }, [readOnly, rfNodes, rfEdges, syncStoreFromCanvas])

  const onConnect = useCallback(
    (c: Connection) => {
      if (readOnly) return
      const { source, target, sourceHandle, targetHandle } = c
      if (!source || !target || !sourceHandle || !targetHandle) return
      setRfEdges((eds: Edge<TipdmEdgeData>[]) => {
        if (
          eds.some(
            (e: Edge<TipdmEdgeData>) =>
              e.source === source &&
              e.target === target &&
              e.sourceHandle === sourceHandle &&
              e.targetHandle === targetHandle,
          )
        ) {
          return eds
        }
        const id = `${sourceHandle}_${targetHandle}`
        const edge: Edge<TipdmEdgeData> = {
          id,
          source,
          target,
          sourceHandle,
          targetHandle,
          type: 'smoothstep',
          data: {
            wire: {
              id,
              source,
              target,
              outputPortId: sourceHandle,
              inputPortId: targetHandle,
            },
          },
        }
        return addEdge(edge, eds)
      })
    },
    [readOnly, setRfEdges],
  )

  return (
    <ReactFlow
      nodes={rfNodes}
      edges={rfEdges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={readOnly ? undefined : onConnect}
      nodeTypes={nodeTypes}
      nodesDraggable={!readOnly}
      nodesConnectable={!readOnly}
      elementsSelectable={!readOnly}
      edgesReconnectable={!readOnly}
      panOnDrag
      zoomOnScroll
      minZoom={0.15}
      maxZoom={1.8}
      deleteKeyCode={readOnly ? undefined : ['Backspace', 'Delete']}
      proOptions={{ hideAttribution: true }}
      style={{ height }}
    >
      <Background gap={16} size={1} />
      <Controls showInteractive={!readOnly} />
      {!readOnly ? <MiniMap pannable zoomable /> : null}
      <FitViewOnRemoteRevision revision={flowRemoteRevision} />
    </ReactFlow>
  )
}

export function ProjectFlowCanvas(props: ProjectFlowCanvasProps) {
  const { height = 520 } = props
  return (
    <div
      style={{
        height,
        border: '1px solid #f0f0f0',
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      <ReactFlowProvider>
        <ProjectFlowCanvasInner {...props} />
      </ReactFlowProvider>
    </div>
  )
}
