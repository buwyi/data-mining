export type TemplateListRow = Record<string, unknown>

function firstNonEmpty(row: TemplateListRow, keys: readonly string[]): string {
  for (const k of keys) {
    const v = row[k]
    if (v != null && String(v).trim() !== '') return String(v)
  }
  return ''
}

function readNumericId(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.trunc(v)
  if (typeof v === 'string' && /^\d+$/.test(v.trim())) return Number.parseInt(v.trim(), 10)
  return null
}

/** TipDM `Template` JSON 中的嵌套 `project`（`dm_project`） */
function pickNestedProject(row: TemplateListRow): Record<string, unknown> | null {
  const p = row.project
  if (p != null && typeof p === 'object' && !Array.isArray(p)) return p as Record<string, unknown>
  return null
}

export function pickTemplateName(row: TemplateListRow): string {
  const flat = firstNonEmpty(row, ['name', 'templateName', 'title', 'label'])
  if (flat) return flat
  const proj = pickNestedProject(row)
  if (proj) {
    const n = firstNonEmpty(proj, ['name'])
    if (n) return n
  }
  return '—'
}

export function pickTemplateId(row: TemplateListRow): string | null {
  for (const k of ['id', 'templateId', 'pk'] as const) {
    const v = row[k]
    if (v != null && String(v).trim() !== '') return String(v)
  }
  return null
}

export function pickTemplateDescription(row: TemplateListRow): string {
  const flat = firstNonEmpty(row, ['description', 'desc', 'remark', 'comment'])
  if (flat) return flat
  const proj = pickNestedProject(row)
  if (proj) return firstNonEmpty(proj, ['description', 'desc'])
  return ''
}

/**
 * TipDM `POST /api/project/{templateProjectId}/clone/{parentDocumentId}` 首段：
 * **模板关联的工程 id**（实体 `Template.project.id` / `dm_project.id`），不是 `dm_template.id`。
 */
export function pickTemplateSourceProjectId(row: TemplateListRow): number | null {
  const proj = pickNestedProject(row)
  if (proj) {
    const id = readNumericId(proj.id)
    if (id != null) return id
  }
  const legacy = readNumericId(row.sourceProjectId)
  if (legacy != null) return legacy
  return null
}

/**
 * 上述 clone 接口**第二段**：新工程落在文档树下的父目录 id，TipDM 根目录多为 `0`。
 */
export function pickCloneParentDocumentId(row: TemplateListRow): number {
  for (const k of ['parentDocumentId', 'cloneParentId', 'targetParentId'] as const) {
    const n = readNumericId(row[k])
    if (n != null) return n
  }
  return 0
}
