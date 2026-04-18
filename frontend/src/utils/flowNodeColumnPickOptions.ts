import type { FlowLinkWire, FlowNodeWire } from '../domain/flow'
import { listWirePorts, readWireNodeId } from '../domain/flow'
import { gridColumnKeys } from './flowNodeGridModel'

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

/** 从 `dataFields` 数组提取 `name`（与旧版 TipDM 一致） */
export function listNamesFromDataFields(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const names: string[] = []
  for (const item of raw) {
    if (!isRecord(item)) continue
    const n = item.name
    if (typeof n === 'string' && n.trim().length > 0) names.push(n.trim())
  }
  return [...new Set(names)]
}

function readInputDataEntryByPortKey(wire: FlowNodeWire, portKey: string): Record<string, unknown> | null {
  const raw = wire.inputData
  if (!Array.isArray(raw)) return null
  for (const it of raw) {
    if (!isRecord(it)) continue
    if (it.key === portKey) return it
  }
  return null
}

/**
 * 优先使用当前节点 `inputData` 中与输入口 key 对应项的 `dataFields`；
 * 若无则沿连线查找上游节点对应输出口的 `outputData` 项。
 */
export function resolveFieldNamesForInputPortKey(
  nodeId: string,
  portKey: string,
  wire: FlowNodeWire,
  nodes: FlowNodeWire[],
  links: FlowLinkWire[],
): string[] {
  const slice = readInputDataEntryByPortKey(wire, portKey)
  if (slice && Array.isArray(slice.dataFields) && slice.dataFields.length > 0) {
    return listNamesFromDataFields(slice.dataFields)
  }

  const inputs = listWirePorts(wire, 'inputs')
  const port = inputs.find((p) => p.key === portKey)
  const pid = port && typeof port.id === 'string' ? port.id : null
  if (!pid) return []

  const link = links.find((l) => l.target === nodeId && l.inputPortId === pid)
  if (!link) return []

  let src: FlowNodeWire | undefined
  try {
    src = nodes.find((n) => readWireNodeId(n) === link.source)
  } catch {
    src = undefined
  }
  if (!src) return []

  const outs = listWirePorts(src, 'outputs')
  const outPort = outs.find((p) => p.id === link.outputPortId)
  const outKey = outPort && typeof outPort.key === 'string' ? outPort.key : null
  if (!outKey) return []

  const od = src.outputData
  if (!Array.isArray(od)) return []

  for (const item of od) {
    if (!isRecord(item)) continue
    if (item.key !== outKey) continue
    return listNamesFromDataFields(item.dataFields)
  }
  return []
}

function readGridColumnInputKeys(el: Record<string, unknown>): Record<string, string> | null {
  const ex = el.extra
  if (!isRecord(ex)) return null
  const m = ex.gridColumnInputKeys
  if (!isRecord(m)) return null
  const out: Record<string, string> = {}
  for (const [col, v] of Object.entries(m)) {
    if (typeof v === 'string' && v.trim().length > 0) out[col] = v.trim()
  }
  return Object.keys(out).length > 0 ? out : null
}

function readSingleInputPortKey(el: Record<string, unknown>): string | null {
  const ex = el.extra
  if (!isRecord(ex)) return null
  const k = ex.key
  if (typeof k === 'string' && k.trim().length > 0) return k.trim()
  return null
}

/**
 * 为 `FlowNodeInputDataGrid` 文本列生成「可选列名」列表。
 *
 * - 组件可在 `tabs[].elements[].extra.gridColumnInputKeys` 中按**表格列名**映射到**输入口 key**（表合并等多输入场景）。
 * - 若仅有 `extra.key`，则所有文本列共用该输入口的字段列表（与旧版单下拉一致）。
 * - 未配置映射且无法解析时返回 `undefined`，网格仍用普通输入框。
 */
export function buildGridColumnPickOptions(
  el: Record<string, unknown>,
  wire: FlowNodeWire,
  nodeId: string,
  rows: Record<string, unknown>[],
  nodes: FlowNodeWire[],
  links: FlowLinkWire[],
): Record<string, string[]> | undefined {
  const perCol = readGridColumnInputKeys(el)
  const single = readSingleInputPortKey(el)
  if (!perCol && !single) return undefined

  const colSet = new Set(gridColumnKeys(rows))
  if (perCol) {
    for (const k of Object.keys(perCol)) colSet.add(k)
  }

  const out: Record<string, string[]> = {}
  for (const col of colSet) {
    const portKey = perCol?.[col] ?? single
    if (!portKey) continue
    const names = resolveFieldNamesForInputPortKey(nodeId, portKey, wire, nodes, links)
    if (names.length > 0) out[col] = names
  }

  return Object.keys(out).length > 0 ? out : undefined
}
