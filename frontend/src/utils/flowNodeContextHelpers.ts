import type { FlowNodeWire } from '../domain/flow'

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

export type WireOutputPreviewItem = {
  name: string
  value: string
  id: string
  canPreview: boolean
  /** 调 `…/data` 或数据源预览时使用的路径段（可能与 `value` 不同） */
  previewPathId: string
}

/** 正整数：走 TipDM `findDataByOutputId` 的数据源 id 分支（`GET /api/datasource/{id}/preview`） */
export const OUTPUT_NUMERIC_DATASOURCE_RE = /^[1-9]\d*$/

/**
 * 旧版 `PreviewDataDialog`：纯数字 `value` → 数据源预览；否则 → `GET …/project/{id}/{output}/data`。
 * 部分节点 `value` 为 `clientId_0_1` 而 `id` 为数据表数字 id，此时应优先用 `id`。
 */
export function resolveOutputIdForDataPreview(item: { id: string; value: string }): string {
  const val = String(item.value ?? '').trim()
  const oid = String(item.id ?? '').trim()
  if (OUTPUT_NUMERIC_DATASOURCE_RE.test(val)) return val
  if (OUTPUT_NUMERIC_DATASOURCE_RE.test(oid) && val.includes('_')) return oid
  return val.length > 0 ? val : oid
}

export function listWireOutputsForPreview(wire: FlowNodeWire): WireOutputPreviewItem[] {
  const raw = wire.outputs
  if (!Array.isArray(raw)) return []
  const out: WireOutputPreviewItem[] = []
  for (const item of raw) {
    if (!isRecord(item)) continue
    const id = typeof item.id === 'string' ? item.id : ''
    const value = typeof item.value === 'string' ? item.value : id
    const name =
      typeof item.description === 'string' && item.description.length > 0
        ? item.description
        : value || id || '输出'
    const previewPathId = resolveOutputIdForDataPreview({ id, value })
    out.push({
      name,
      value,
      id,
      canPreview: item.canPreview === true,
      previewPathId,
    })
  }
  return out
}

const CHART_DRAWING_TYPES = ['pie', 'line', 'bar', 'area', 'scatter', 'wordCloud'] as const

/** 对齐旧版 `RightMenuContent` isChart */
export function wireSupportsChartVisual(wire: FlowNodeWire): boolean {
  const tabs = wire.tabs
  if (!Array.isArray(tabs)) return false
  for (const tab of tabs) {
    if (!isRecord(tab)) continue
    const els = tab.elements
    if (!Array.isArray(els)) continue
    for (const el of els) {
      if (!isRecord(el)) continue
      if (el.name === 'drawingType' && typeof el.value === 'string') {
        if ((CHART_DRAWING_TYPES as readonly string[]).includes(el.value)) return true
      }
    }
  }
  return false
}

export function readWireAllowViewSource(wire: FlowNodeWire): boolean {
  return wire.allowViewSource === true
}

export function readWireHasReport(wire: FlowNodeWire): boolean {
  return wire.hasReport === true
}
