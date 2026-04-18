/** 创建 FLAT 数据源时 `columns` 单项（与 api-doc / 旧版 AddFile 一致） */
export type FlatDatasourceColumnPayload = {
  name: string
  dataType: string
  comment: string
  formatter: string
  length: number
  scale: number
}

/** 上传向导中可编辑的列草稿 */
export type FlatFileColumnDraft = {
  key: string
  oldName: string
  name: string
  dataType: 'numeric' | 'text' | 'date' | 'timestamp'
  length: number
  scale: number
  comment: string
  format: string
}

export type FlatPreviewColumnTitle = {
  name: string
  key: string
}

/** `GET /api/datasource/search` / `shared` 查询参数（与预览接口一致使用 pageNumber、pageSize） */
export type DatasourceSearchParams = {
  pageNumber?: number
  pageSize?: number
  /**
   * 表名/显示名关键词；请求中映射为后端参数 **`showName`**（见 `DataSourceController`）。
   */
  keyword?: string
}

/** 列表行原始对象（字段随后端 DTO 变化） */
export type DatasourceListRow = Record<string, unknown>

export type DatasourceSearchPage = {
  rows: DatasourceListRow[]
  total: number
}

function firstNonEmptyString(row: DatasourceListRow, keys: readonly string[]): string {
  for (const k of keys) {
    const v = row[k]
    if (v != null && String(v).trim() !== '') return String(v)
  }
  return ''
}

/** 表格「名称」列展示 */
export function pickDatasourceRowLabel(row: DatasourceListRow): string {
  const s = firstNonEmptyString(row, ['tableName', 'name', 'table', 'label', 'title'])
  return s || '—'
}

/** `GET /api/datasource/syncTable?tableName=` 使用的逻辑表名（与路径 tableId 可能不同） */
export function pickDatasourceSyncTableName(row: DatasourceListRow): string | null {
  const s = firstNonEmptyString(row, ['tableName', 'name', 'table'])
  return s || null
}

/** `DELETE /api/datasource/{tableId}` 路径段：优先数值 id，否则表名 */
export function pickDatasourceDeleteId(row: DatasourceListRow): string | null {
  const idKeys = ['tableId', 'id', 'dataSourceId', 'datasourceId'] as const
  for (const k of idKeys) {
    const v = row[k]
    if (v != null && String(v).trim() !== '') return String(v)
  }
  const nameKeys = ['tableName', 'name', 'table'] as const
  for (const k of nameKeys) {
    const v = row[k]
    if (v != null && String(v).trim() !== '') return String(v)
  }
  return null
}

export function pickDatasourceTypeLabel(row: DatasourceListRow): string {
  const s = firstNonEmptyString(row, ['type', 'sourceType', 'dataSourceType', 'category', 'kind'])
  return s || '—'
}

export function pickDatasourceTimeLabel(row: DatasourceListRow): string {
  const s = firstNonEmptyString(row, [
    'createTime',
    'createdTime',
    'gmtCreate',
    'updateTime',
    'updatedTime',
    'gmtModified',
  ])
  return s || '—'
}

/** 列表行若含同步相关字段则展示（字段名随后端 DTO 扩展） */
export function pickDatasourceSyncStatusText(row: DatasourceListRow): string | null {
  const s = firstNonEmptyString(row, [
    'syncStatus',
    'syncState',
    'tableSyncStatus',
    'synchronizeStatus',
    'lastSyncStatus',
    'syncResult',
    'syncMessage',
  ])
  return s || null
}

/** `POST /api/datasource/connection/test`（api-doc 6.3） */
export type DatasourceConnectionTestBody = {
  url: string
  userName: string
  password: string
  sql: string
}

export type ConnectionTestColumnMeta = {
  name: string
  dataType: string
}

/** 连接测试返回：列定义 + 样例数据行 */
export type ConnectionTestResult = {
  columns: ConnectionTestColumnMeta[]
  data: Record<string, unknown>[]
}

/** `POST /api/datasource/rdbms` 的 columns 单项（字段名 format，与 FLAT 的 formatter 区分） */
export type RdbmsDatasourceColumnPayload = {
  name: string
  dataType: string
  comment: string
  length: number
  scale: number
  format: string
}

export type CreateRdbmsDatasourceBody = {
  tableName: string
  duration: number
  previewMode: string
  columns: RdbmsDatasourceColumnPayload[]
  connection: DatasourceConnectionTestBody
}
