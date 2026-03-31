import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { TipdmWireRfNode } from '../../domain/flow/reactFlowTypes'
import { listWirePorts, portRecordId, readWireDisplayName } from '../../domain/flow/nodeWireHelpers'

export function TipdmWireNode(props: NodeProps<TipdmWireRfNode>) {
  const wire = props.data.wire
  const title = readWireDisplayName(wire)
  const inputs = listWirePorts(wire, 'inputs')
  const outputs = listWirePorts(wire, 'outputs')

  return (
    <div
      style={{
        position: 'relative',
        padding: '8px 12px',
        minWidth: 120,
        borderRadius: 6,
        border: '1px solid #d9d9d9',
        background: '#fff',
        boxShadow: '0 1px 2px rgb(0 0 0 / 6%)',
        fontSize: 12,
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
