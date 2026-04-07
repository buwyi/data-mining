/** `GET /api/cat/{catId}/childs` 单项（与 api-doc 约定：`component: true` 为组件） */
export type CatChildNodeDto = {
  id: number
  name: string
  /** 为 `true` 时表示组件，否则为子分类 */
  component?: boolean
  parentId?: number
  leaf?: boolean
  [key: string]: unknown
}

/** `GET/PUT /api/component/{id}` 主体字段（与 api-doc 示意对齐，允许后端扩展字段） */
export type ComponentDefinitionDto = Record<string, unknown> & {
  id?: number
  name?: string
  targetAlgorithm?: string
  parentId?: number
  description?: string
  iconPath?: string
  minimumInput?: number
  inputs?: unknown[]
  outputs?: unknown[]
  tabs?: unknown[]
  script?: Record<string, string>
  allowViewSource?: boolean
  supportPMML?: boolean
  hasReport?: boolean
  enabled?: boolean
  extra?: { engine?: string }
}
