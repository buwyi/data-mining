import type { ComponentDefinitionDto } from '../../types/component'
import type { FlowNodeWire } from './flowWireTypes'

function deepCloneJson<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T
}

function readEngine(def: ComponentDefinitionDto): string {
  const extra = def.extra
  if (extra && typeof extra === 'object' && extra !== null && 'engine' in extra) {
    const e = (extra as { engine?: unknown }).engine
    if (typeof e === 'string' && e.length > 0) return e
  }
  const top = def.engine
  if (typeof top === 'string' && top.length > 0) return top
  return ''
}

/**
 * 将组件库定义转为可写入 Flow JSON 的节点（端口 ID 按旧版 `{nodeId}_0_i` / `{nodeId}_1_i` 规则生成）。
 */
export function buildFlowNodeWireFromComponent(
  componentId: number,
  nodeIdStr: string,
  position: { x: number; y: number },
  def: ComponentDefinitionDto,
): FlowNodeWire {
  const engine = readEngine(def)

  const clonePorts = (raw: unknown, kind: 'in' | 'out'): Record<string, unknown>[] => {
    if (!Array.isArray(raw)) return []
    const mid = kind === 'in' ? '1' : '0'
    return raw.map((item, index) => {
      const base =
        item !== null && typeof item === 'object'
          ? { ...(item as Record<string, unknown>) }
          : ({} as Record<string, unknown>)
      const pid = `${nodeIdStr}_${mid}_${index + 1}`
      base.id = pid
      base.value = pid
      if (kind === 'in') {
        base.isConnected = false
      }
      return base
    })
  }

  const tabs = Array.isArray(def.tabs) ? deepCloneJson(def.tabs) : []
  const script =
    def.script !== undefined && def.script !== null && typeof def.script === 'object'
      ? deepCloneJson(def.script)
      : { MAIN: '' }

  const wire: FlowNodeWire = {
    id: nodeIdStr,
    serverId: componentId,
    name: String(def.name ?? '未命名组件'),
    left: position.x,
    top: position.y,
    engine,
    targetAlgorithm: String(def.targetAlgorithm ?? ''),
    minimumInput: typeof def.minimumInput === 'number' ? def.minimumInput : 0,
    description: String(def.description ?? ''),
    iconPath: String(def.iconPath ?? ''),
    allowViewSource: def.allowViewSource === true,
    supportPMML: def.supportPMML === true,
    hasReport: def.hasReport === true,
    runStyle: '',
    lastUpdateTime: Date.now(),
    inputs: clonePorts(def.inputs, 'in'),
    outputs: clonePorts(def.outputs, 'out'),
    tabs,
    script,
    inputData: Array.isArray(def.inputData) ? deepCloneJson(def.inputData) : [],
    outputData: Array.isArray(def.outputData) ? deepCloneJson(def.outputData) : [],
  }

  if (def.outputExtraData !== undefined) {
    wire.outputExtraData = deepCloneJson(def.outputExtraData)
  }
  if (def.extra !== undefined && def.extra !== null && typeof def.extra === 'object') {
    wire.extra = deepCloneJson(def.extra)
  }

  return wire
}
