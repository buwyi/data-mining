/** 参数项说明：顶层 `description` 或 `extra.description`（与 `buildComponentPutBody` 折叠规则一致） */
export function readElementUiDescription(el: unknown): string {
  if (el === null || typeof el !== 'object' || Array.isArray(el)) return ''
  const o = el as Record<string, unknown>
  if (typeof o.description === 'string') return o.description
  const ex = o.extra
  if (ex !== null && typeof ex === 'object' && !Array.isArray(ex)) {
    const d = (ex as Record<string, unknown>).description
    if (typeof d === 'string') return d
  }
  return ''
}

/** 从组件定义 `tabs[].elements[]` 中读取元素数字 id（与 DELETE /api/element/{id} 对齐） */
export function readElementNumericId(el: unknown): number | null {
  if (el === null || typeof el !== 'object' || Array.isArray(el)) return null
  const o = el as Record<string, unknown>
  const raw = o.id
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return raw
  if (typeof raw === 'string' && /^\d+$/.test(raw)) {
    const n = Number.parseInt(raw, 10)
    return n > 0 ? n : null
  }
  return null
}

export function readTabsArray(tabs: unknown): unknown[] {
  return Array.isArray(tabs) ? tabs : []
}

export function readTabElements(tab: unknown): unknown[] {
  if (tab === null || typeof tab !== 'object' || Array.isArray(tab)) return []
  const els = (tab as Record<string, unknown>).elements
  return Array.isArray(els) ? els : []
}

export function readTabName(tab: unknown, fallback: string): string {
  if (tab === null || typeof tab !== 'object' || Array.isArray(tab)) return fallback
  const n = (tab as Record<string, unknown>).tabName
  return typeof n === 'string' && n.trim() ? n.trim() : fallback
}
