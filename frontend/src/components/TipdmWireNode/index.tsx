import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { MouseEvent } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { TipdmWireRfNode } from '../../domain/flow/reactFlowTypes'
import { readDmNodeLastRunStatus } from '../../domain/flow/dmRunPersistence'
import { listWirePorts, portRecordId, readWireDisplayName, readWireNodeId } from '../../domain/flow/nodeWireHelpers'
import type { SocketRunVisualVariant } from '../../realtime/tipdmSocketTypes'
import { useProjectStore } from '../../stores/projectStore'
import { tipdmCanvasNodeIdMatchesSocketJobId } from '../../utils/tipdmSocketNodeIdMatch'

function socketRunVisualStyle(variant: SocketRunVisualVariant): {
  border: string
  background: string
  boxShadow: string
} {
  switch (variant) {
    case 'failed':
      return {
        border: '2px solid #ff4d4f',
        background: '#fff2f0',
        boxShadow: '0 0 0 3px rgba(255, 77, 79, 0.2), 0 1px 2px rgb(0 0 0 / 6%)',
      }
    case 'skipped':
      return {
        border: '2px dashed #bfbfbf',
        background: '#fafafa',
        boxShadow: '0 1px 2px rgb(0 0 0 / 6%)',
      }
    case 'queued':
      return {
        border: '2px solid #faad14',
        background: '#fffbe6',
        boxShadow: '0 0 0 3px rgba(250, 173, 20, 0.22), 0 1px 2px rgb(0 0 0 / 6%)',
      }
    case 'running':
      return {
        border: '2px solid #1677ff',
        background: '#f0f7ff',
        boxShadow: '0 0 0 3px rgba(22, 119, 255, 0.18), 0 1px 2px rgb(0 0 0 / 6%)',
      }
    case 'success':
      return {
        border: '2px solid #52c41a',
        background: '#f6ffed',
        boxShadow: '0 0 0 3px rgba(82, 196, 26, 0.2), 0 1px 2px rgb(0 0 0 / 6%)',
      }
  }
}

export function TipdmWireNode(props: NodeProps<TipdmWireRfNode>) {
  const wire = props.data.wire
  const title = readWireDisplayName(wire)
  const inputs = listWirePorts(wire, 'inputs')
  const outputs = listWirePorts(wire, 'outputs')
  const nodeIdStr = String(props.id)
  const { socketRunVisual, persistedRun } = useProjectStore(
    useShallow((s) => {
      for (const w of s.flowData.nodes) {
        try {
          if (readWireNodeId(w) === nodeIdStr) {
            return {
              socketRunVisual: s.flowData.socketRunVisual,
              persistedRun: readDmNodeLastRunStatus(w),
            }
          }
        } catch {
          /* 跳过异常 wire */
        }
      }
      return {
        socketRunVisual: s.flowData.socketRunVisual,
        persistedRun: readDmNodeLastRunStatus(wire),
      }
    }),
  )
  /** 不依赖 `isRunning`：以 Socket 指向为准，避免与调度状态不同步时整段运行过程无高亮 */
  const liveMatch =
    socketRunVisual.nodeId !== '' &&
    tipdmCanvasNodeIdMatchesSocketJobId(nodeIdStr, socketRunVisual.nodeId)

  const highlightStyle = liveMatch
    ? socketRunVisualStyle(socketRunVisual.variant)
    : persistedRun === 'success'
      ? socketRunVisualStyle('success')
      : persistedRun === 'failed'
        ? socketRunVisualStyle('failed')
        : persistedRun === 'skipped'
          ? socketRunVisualStyle('skipped')
          : null

  const onNodeContextMenu = (e: MouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    useProjectStore.getState().openNodeContextMenu({
      clientX: e.clientX,
      clientY: e.clientY,
      nodeId: String(props.id),
    })
  }

  return (
    <div
      onContextMenu={onNodeContextMenu}
      style={{
        position: 'relative',
        padding: '8px 12px',
        minWidth: 120,
        borderRadius: 6,
        border: highlightStyle?.border ?? '1px solid #d9d9d9',
        background: highlightStyle?.background ?? '#fff',
        boxShadow: highlightStyle?.boxShadow ?? '0 1px 2px rgb(0 0 0 / 6%)',
        fontSize: 12,
        transition: 'border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease',
      }}
    >
      {inputs.map((p, i) => {
        const id = portRecordId(p)
        if (!id) return null
        const topPct = ((i + 1) / (inputs.length + 1)) * 100
        return (
          <Handle
            key={id}
            id={id}
            type="target"
            position={Position.Left}
            style={{ top: `${topPct}%` }}
          />
        )
      })}
      <div style={{ textAlign: 'center', fontWeight: 500 }}>{title}</div>
      {outputs.map((p, i) => {
        const id = portRecordId(p)
        if (!id) return null
        const topPct = ((i + 1) / (outputs.length + 1)) * 100
        return (
          <Handle
            key={id}
            id={id}
            type="source"
            position={Position.Right}
            style={{ top: `${topPct}%` }}
          />
        )
      })}
    </div>
  )
}
