import type { FlowNodeWire } from './flowWireTypes'

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

export function readWireNodeId(wire: FlowNodeWire): string {
  const id = wire.id
  if (typeof id === 'string' && id.length > 0) return id
  throw new Error('流程节点缺少 string 类型 id')
}

export function readWirePosition(wire: FlowNodeWire): { x: number; y: number } {
  const x = typeof wire.left === 'number' ? wire.left : 0
  const y = typeof wire.top === 'number' ? wire.top : 0
  return { x, y }
}

export function readWireDisplayName(wire: FlowNodeWire): string {
  if (typeof wire.name === 'string' && wire.name.length > 0) return wire.name
  return readWireNodeId(wire)
}

/** 从节点 wire 中取出 inputs/outputs 端口（旧版为对象数组，含 `id`） */
export function listWirePorts(wire: FlowNodeWire, kind: 'inputs' | 'outputs'): Record<string, unknown>[] {
  const raw = wire[kind]
  if (!Array.isArray(raw)) return []
  return raw.filter(isRecord) as Record<string, unknown>[]
}

export function portRecordId(port: Record<string, unknown>): string | null {
  const id = port.id
  return typeof id === 'string' && id.length > 0 ? id : null
}
