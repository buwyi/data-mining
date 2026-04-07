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
import { App } from 'antd'
import { useCallback, useEffect, useRef, type DragEvent } from 'react'
import { fetchComponentDefinition } from '../../api/componentApi'
import { fetchNextSequenceId } from '../../api/seqApi'
import { TIPDM_COMPONENT_DRAG_MIME } from '../../constants/tipdmDrag'
import {
  buildFlowNodeWireFromComponent,
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
  const { message } = App.useApp()
  const flowRemoteRevision = useProjectStore((s) => s.flowRemoteRevision)
  const flowGraphRevision = useProjectStore((s) => s.flowGraphRevision)
  const pushFlowToStore = useProjectStore((s) => s.setFlowGraph)
  const appendFlowNodeWire = useProjectStore((s) => s.appendFlowNodeWire)
  const skipNextStoreSyncRef = useRef(false)
  const { screenToFlowPosition } = useReactFlow()

  const [rfNodes, setRfNodes, onNodesChange] = useNodesState<TipdmWireRfNode>([])
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState<Edge<TipdmEdgeData>>([])

  useEffect(() => {
    const { nodes, links } = useProjectStore.getState().flowData
    const next = persistedFlowToReactFlow({ nodes, links })
    skipNextStoreSyncRef.current = true
    setRfNodes(next.nodes)
    setRfEdges(next.edges)
  }, [flowGraphRevision, setRfEdges, setRfNodes])

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

  const onDragOver = useCallback((e: DragEvent) => {
    if (readOnly) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }, [readOnly])

  const onDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault()
      if (readOnly) return
      const raw =
        e.dataTransfer.getData(TIPDM_COMPONENT_DRAG_MIME) || e.dataTransfer.getData('text/plain')
      const componentDefId = Number(raw)
      if (!Number.isFinite(componentDefId) || componentDefId <= 0) return
      const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      void (async () => {
        try {
          const nodeIdStr = await fetchNextSequenceId()
          const def = await fetchComponentDefinition(componentDefId)
          const wire = buildFlowNodeWireFromComponent(componentDefId, nodeIdStr, pos, def)
          appendFlowNodeWire(wire)
          message.success(`已添加「${String(def.name ?? componentDefId)}」`)
        } catch (err) {
          message.error(err instanceof Error ? err.message : '从组件库添加节点失败')
        }
      })()
    },
    [appendFlowNodeWire, message, readOnly, screenToFlowPosition],
  )

  return (
    <ReactFlow
      nodes={rfNodes}
      edges={rfEdges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={readOnly ? undefined : onConnect}
      onDragOver={readOnly ? undefined : onDragOver}
      onDrop={readOnly ? undefined : onDrop}
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
