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

/**
 * 表格「显示名称」列：优先使用后端展示名（与检索参数 `showName` 对应），再回退物理表名等。
 */
export function pickDatasourceRowLabel(row: DatasourceListRow): string {
  const s = firstNonEmptyString(row, [
    'showName',
    'displayName',
    'chineseName',
    'tableName',
    'name',
    'table',
    'label',
    'title',
  ])
  return s || '—'
}

/** 数据源来源：仅区分数据库拉表与文件导入（用于列表「类型」列） */
export type DatasourceOriginKind = 'database' | 'file'

export function inferDatasourceOriginKind(row: DatasourceListRow): DatasourceOriginKind {
  const typeStr = [
    firstNonEmptyString(row, ['type', 'sourceType', 'dataSourceType', 'category', 'kind']),
    row.engine != null ? String(row.engine) : '',
  ]
    .join(' ')
    .toLowerCase()

  const tableHint = (
    pickDatasourceSyncTableName(row) ??
    firstNonEmptyString(row, ['tableName', 'name', 'table'])
  ).toLowerCase()

  const hay = `${typeStr} ${tableHint}`

  if (
    /\bflat\b|\bcsv\b|upload|spreadsheet|excel|\.csv|\.xlsx?|\.txt\b|file\s*import|import\s*file/.test(hay)
  ) {
    return 'file'
  }
  if (
    /\bjdbc\b|\bmysql\b|\bpostgres\b|\boracle\b|\bmssql\b|\bmariadb\b|\bhive\b|\bdm\b|\btidb\b|\brdbms\b|\bdatabase\b|\bsql\b/.test(
      hay,
    )
  ) {
    return 'database'
  }

  if (/\.(csv|xlsx?|txt)$/.test(tableHint)) return 'file'

  return 'database'
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

/** 将接口返回的时间字符串/时间戳格式化为中文易读：yyyy年MM月dd日 HH:mm:ss（24 小时制） */
export function formatDatasourceTimeHumanReadable(raw: string): string {
  const t = raw.trim()
  if (t === '') return raw

  let d: Date
  // 仅当为足够长的纯数字时按 Unix 时间戳解析（避免把「2024」等误当时间戳）
  if (/^\d{10,}$/.test(t)) {
    const n = Number(t)
    d = new Date(n < 1e12 ? n * 1000 : n)
  } else {
    d = new Date(t)
  }
  if (Number.isNaN(d.getTime())) return raw

  const pad = (n: number) => String(n).padStart(2, '0')
  const y = d.getFullYear()
  const m = pad(d.getMonth() + 1)
  const day = pad(d.getDate())
  const hh = pad(d.getHours())
  const mm = pad(d.getMinutes())
  const ss = pad(d.getSeconds())
  return `${y}年${m}月${day}日 ${hh}:${mm}:${ss}`
}

/**
 * 标准本地时间：`YYYY-MM-DD HH:mm:ss`（24 小时制），用于连接信息弹窗等。
 * 无法解析为时间则原样返回。
 */
export function formatStandardLocalDateTime(raw: string): string {
  const t = raw.trim()
  if (t === '') return raw

  let d: Date
  if (/^\d{10,}$/.test(t)) {
    const n = Number(t)
    d = new Date(n < 1e12 ? n * 1000 : n)
  } else {
    d = new Date(t)
  }
  if (Number.isNaN(d.getTime())) return raw

  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

/** 连接信息对象字段名是否像时间戳/时间（用于格式化为标准时间） */
export function isLikelyTimeFieldKeyForConnectionInfo(key: string): boolean {
  const raw = key.trim()
  const k = raw.toLowerCase().replace(/_/g, '')
  return (
    k.includes('time') ||
    k.includes('date') ||
    k.includes('gmt') ||
    /(created|updated)at$/i.test(raw)
  )
}

/** 原始时间字段串（未格式化），供列表「近期导入」等展示逻辑使用 */
export function pickDatasourceTimeRaw(row: DatasourceListRow): string {
  return firstNonEmptyString(row, [
    'createTime',
    'createdTime',
    'gmtCreate',
    'updateTime',
    'updatedTime',
    'gmtModified',
  ])
}

export function pickDatasourceTimeLabel(row: DatasourceListRow): string {
  const s = pickDatasourceTimeRaw(row)
  if (s === '') return '—'
  return formatDatasourceTimeHumanReadable(s)
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
