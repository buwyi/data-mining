import type { ProjectDetailDto } from '../api/projectApi'

export function readDetailParentId(d: ProjectDetailDto): number {
  const p = d.parentId
  if (typeof p === 'number' && Number.isFinite(p)) return p
  const raw = (d as Record<string, unknown>).parentId
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  if (typeof raw === 'string' && /^\d+$/.test(raw)) return Number.parseInt(raw, 10)
  return 0
}
