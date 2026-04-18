import { readWireNodeId } from './nodeWireHelpers'
import type { FlowLinkWire, FlowNodeWire } from './flowWireTypes'

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

/**
 * 根据当前 links 重算各节点 inputs[].isConnected（对齐旧版连线后更新端口状态）。
 */
export function reconcileInputPortsConnected(nodes: FlowNodeWire[], links: FlowLinkWire[]): FlowNodeWire[] {
  return nodes.map((wire) => {
    let nid: string
    try {
      nid = readWireNodeId(wire)
    } catch {
      return wire
    }
    const inputs = wire.inputs
    if (!Array.isArray(inputs)) return wire
    const nextInputs = inputs.map((p) => {
      if (!isRecord(p)) return p
      const pid = p.id
      if (typeof pid !== 'string') return p
      const isConnected = links.some((l) => l.target === nid && l.inputPortId === pid)
      return { ...p, isConnected }
    })
    return { ...wire, inputs: nextInputs }
  })
}
