import { MinusOutlined, PlusOutlined } from '@ant-design/icons'
import {
  addEdge,
  Background,
  Controls,
  type Connection,
  type Edge,
  type NodeChange,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { App, Button, Space, Typography } from 'antd'
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
import { FlowNodeContextMenu } from '../FlowNodeContextMenu'
import { TipdmWireNode } from '../TipdmWireNode'

const nodeTypes = { [TIPDM_WIRE_NODE_TYPE]: TipdmWireNode }

/** 与旧版 `WorkHeader` 一致：画布「缩放」百分比存 `style.height`，范围 100–290 */
const CANVAS_ZOOM_MIN_PCT = 100
const CANVAS_ZOOM_MAX_PCT = 290
const CANVAS_ZOOM_STEP = 10

function FitViewOnRemoteRevision({ revision }: { revision: number }) {
  const { fitView, zoomTo } = useReactFlow()
  const heightPct = useProjectStore((s) => s.flowData.contentStyle.height)
  useEffect(() => {
    if (revision === 0) return
    let timeoutId: number | undefined
    const rafId = requestAnimationFrame(() => {
      void fitView({ padding: 0.15, duration: 200 })
      timeoutId = window.setTimeout(() => {
        const z = Math.min(CANVAS_ZOOM_MAX_PCT / 100, Math.max(CANVAS_ZOOM_MIN_PCT / 100, heightPct / 100))
        zoomTo(z, { duration: 150 })
      }, 220)
    })
    return () => {
      cancelAnimationFrame(rafId)
      if (timeoutId !== undefined) window.clearTimeout(timeoutId)
    }
  }, [revision, fitView, zoomTo, heightPct])
  return null
}

function FlowCanvasZoomPanel({ readOnly }: { readOnly: boolean }) {
  const heightPct = useProjectStore((s) => s.flowData.contentStyle.height)
  const setFlowData = useProjectStore((s) => s.setFlowData)
  const { zoomTo } = useReactFlow()

  const adjust = useCallback(
    (delta: number) => {
      if (readOnly) return
      const s = useProjectStore.getState().flowData.contentStyle
      const next = Math.min(CANVAS_ZOOM_MAX_PCT, Math.max(CANVAS_ZOOM_MIN_PCT, s.height + delta))
      setFlowData({
        contentStyle: { ...s, height: next },
      })
      zoomTo(next / 100, { duration: 120 })
    },
    [readOnly, setFlowData, zoomTo],
  )

  return (
    <Panel position="top-left">
      <Space
        align="center"
        size={2}
        style={{
          background: 'rgba(255,255,255,0.96)',
          padding: '2px 6px',
          borderRadius: 6,
          border: '1px solid #f0f0f0',
          boxShadow: '0 1px 4px rgb(0 0 0 / 8%)',
        }}
      >
        <Button
          type="text"
          size="small"
          icon={<MinusOutlined />}
          disabled={readOnly || heightPct <= CANVAS_ZOOM_MIN_PCT}
          onClick={() => adjust(-CANVAS_ZOOM_STEP)}
          title="缩小"
        />
        <Typography.Text type="secondary" style={{ minWidth: 42, textAlign: 'center', fontSize: 12, userSelect: 'none' }}>
          {heightPct}%
        </Typography.Text>
        <Button
          type="text"
          size="small"
          icon={<PlusOutlined />}
          disabled={readOnly || heightPct >= CANVAS_ZOOM_MAX_PCT}
          onClick={() => adjust(CANVAS_ZOOM_STEP)}
          title="放大"
        />
      </Space>
    </Panel>
  )
}

export type ProjectFlowCanvasProps = {
  /** 预览区高度（px） */
  height?: number
  /** 只读：不可拖拽、连线、选择、删除 */
  readOnly?: boolean
  /** 全屏预览等场景：去掉圆角与描边 */
  borderless?: boolean
}

function ProjectFlowCanvasInner({ height = 520, readOnly = false }: ProjectFlowCanvasProps) {
  const { message } = App.useApp()
  const flowRemoteRevision = useProjectStore((s) => s.flowRemoteRevision)
  const flowGraphRevision = useProjectStore((s) => s.flowGraphRevision)
  const pushFlowToStore = useProjectStore((s) => s.setFlowGraph)
  const appendFlowNodeWire = useProjectStore((s) => s.appendFlowNodeWire)
  const skipNextStoreSyncRef = useRef(false)
  const { screenToFlowPosition, getNodes } = useReactFlow()

  const [rfNodes, setRfNodes, onNodesChange] = useNodesState<TipdmWireRfNode>([])
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState<Edge<TipdmEdgeData>>([])

  const handleNodesChange = useCallback(
    (changes: NodeChange<TipdmWireRfNode>[]) => {
      onNodesChange(changes)
      if (readOnly) return
      queueMicrotask(() => {
        const list = getNodes()
        const picked = list.filter((n) => n.selected)
        const nextId =
          picked.length >= 1 ? String(picked[0].id) : null
        useProjectStore.getState().setSelectedWireNodeId(nextId)
      })
    },
    [getNodes, onNodesChange, readOnly],
  )

  useEffect(() => {
    const { nodes, links } = useProjectStore.getState().flowData
    const sid = useProjectStore.getState().selectedWireNodeId
    const next = persistedFlowToReactFlow({ nodes, links })
    skipNextStoreSyncRef.current = true
    setRfNodes(
      next.nodes.map((n) => ({
        ...n,
        selected: sid !== null && n.id === sid,
      })),
    )
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
    <>
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        onNodesChange={handleNodesChange}
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
        maxZoom={CANVAS_ZOOM_MAX_PCT / 100}
        deleteKeyCode={readOnly ? undefined : ['Backspace', 'Delete']}
        proOptions={{ hideAttribution: true }}
        style={{ height }}
      >
        <Background gap={16} size={1} />
        <FlowCanvasZoomPanel readOnly={readOnly} />
        <Controls showInteractive={!readOnly} />
        {!readOnly ? <MiniMap pannable zoomable /> : null}
        <FitViewOnRemoteRevision revision={flowRemoteRevision} />
      </ReactFlow>
      <FlowNodeContextMenu readOnly={readOnly} />
    </>
  )
}

export function ProjectFlowCanvas(props: ProjectFlowCanvasProps) {
  const { height = 520, borderless = false } = props
  return (
    <div
      style={{
        height,
        border: borderless ? 'none' : '1px solid #f0f0f0',
        borderRadius: borderless ? 0 : 8,
        overflow: 'hidden',
      }}
    >
      <ReactFlowProvider>
        <ProjectFlowCanvasInner {...props} />
      </ReactFlowProvider>
    </div>
  )
}
