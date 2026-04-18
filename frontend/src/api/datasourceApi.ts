import type { ApiResult } from '../types/apiResult'
import type {
  ConnectionTestColumnMeta,
  ConnectionTestResult,
  CreateRdbmsDatasourceBody,
  DatasourceConnectionTestBody,
  DatasourceSearchPage,
  DatasourceSearchParams,
  FlatDatasourceColumnPayload,
} from '../types/datasource'
import { normalizePagedListData, type PagedListResult } from '../utils/normalizePagedData'
import { apiFetch } from './httpClient'

async function readApiResult<T>(res: Response): Promise<T> {
  let json: unknown
  try {
    json = await res.json()
  } catch {
    throw new Error(`接口返回非 JSON（HTTP ${res.status}）`)
  }
  const wrapped = json as ApiResult<T>
  if (wrapped.status === 'FAIL') {
    throw new Error(wrapped.message ?? '请求失败')
  }
  if (wrapped.status !== 'SUCCESS') {
    throw new Error('未知响应状态')
  }
  return wrapped.data as T
}

async function readApiResultAllowEmpty<T>(res: Response): Promise<T | undefined> {
  const text = await res.text()
  if (!text.trim()) return undefined
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error(`接口返回非 JSON（HTTP ${res.status}）`)
  }
  const wrapped = json as ApiResult<T>
  if (wrapped.status === 'FAIL') {
    throw new Error(wrapped.message ?? '请求失败')
  }
  if (wrapped.status !== 'SUCCESS') {
    throw new Error('未知响应状态')
  }
  return wrapped.data as T
}

/** 数据源列表分页解析（实现与模板列表等共用 `normalizePagedListData`） */
export function normalizeDatasourceSearchData(raw: unknown): DatasourceSearchPage {
  return normalizePagedListData(raw) as DatasourceSearchPage
}

function buildDatasourceListQuery(p: DatasourceSearchParams): string {
  const q = new URLSearchParams()
  const page = p.pageNumber ?? 1
  const size = p.pageSize ?? 10
  q.set('pageNumber', String(page))
  q.set('pageSize', String(size))
  /** 后端 `DataSourceController#getTables` 使用 `showName`，非 `keyword` */
  const kw = p.keyword?.trim()
  if (kw) q.set('showName', kw)
  return q.toString()
}

/** `GET /api/datasource/search` */
export async function searchDatasources(params: DatasourceSearchParams = {}): Promise<DatasourceSearchPage> {
  const qs = buildDatasourceListQuery(params)
  const res = await apiFetch(`/api/datasource/search?${qs}`)
  if (!res.ok) {
    throw new Error(`加载数据源列表失败：${res.status} ${res.statusText}`)
  }
  const raw = await readApiResult<unknown>(res)
  return normalizeDatasourceSearchData(raw)
}

/** `GET /api/datasource/shared` */
export async function fetchSharedDatasources(params: DatasourceSearchParams = {}): Promise<DatasourceSearchPage> {
  const qs = buildDatasourceListQuery(params)
  const res = await apiFetch(`/api/datasource/shared?${qs}`)
  if (!res.ok) {
    throw new Error(`加载共享数据源失败：${res.status} ${res.statusText}`)
  }
  const raw = await readApiResult<unknown>(res)
  return normalizeDatasourceSearchData(raw)
}

/** `DELETE /api/datasource/{tableId}` */
export async function deleteDatasource(tableId: string | number): Promise<void> {
  const enc = encodeURIComponent(String(tableId))
  const res = await apiFetch(`/api/datasource/${enc}`, { method: 'DELETE' })
  if (!res.ok) {
    throw new Error(`删除数据源失败：${res.status} ${res.statusText}`)
  }
  await readApiResultAllowEmpty<unknown>(res)
}

function toNonNegIntLocal(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : Number.parseInt(String(v), 10)
  if (!Number.isFinite(n) || n < 0) return fallback
  return Math.floor(n)
}

/** 预览接口 `data` 可能是 Spring Page、对象数组或 columns+矩阵 */
function normalizeDatasourcePreviewResult(raw: unknown): PagedListResult {
  const base = normalizePagedListData(raw)
  if (base.rows.length > 0 || base.total > 0) return base
  if (raw == null || typeof raw !== 'object') return { rows: [], total: 0 }
  const o = raw as Record<string, unknown>
  const arrData = o.data
  if (Array.isArray(arrData) && arrData.length > 0 && typeof arrData[0] === 'object' && !Array.isArray(arrData[0])) {
    const rows = arrData as Record<string, unknown>[]
    const total = toNonNegIntLocal(o.total ?? o.totalElements ?? o.totalCount, rows.length)
    return { rows, total }
  }
  const colRaw = o.columns ?? o.headers
  const matrix = o.data ?? o.rows
  if (Array.isArray(colRaw) && Array.isArray(matrix) && matrix.length > 0 && Array.isArray(matrix[0])) {
    const headers = colRaw.map((c, i) => {
      if (typeof c === 'string') return c.trim() || `col${i}`
      if (c && typeof c === 'object' && c !== null && 'name' in c) {
        const n = (c as { name: unknown }).name
        return typeof n === 'string' && n.trim() ? n.trim() : `col${i}`
      }
      return `col${i}`
    })
    const rows = (matrix as unknown[][]).map((arr) => {
      const rec: Record<string, unknown> = {}
      headers.forEach((h, idx) => {
        rec[h] = arr[idx]
      })
      return rec
    })
    return { rows, total: toNonNegIntLocal(o.total ?? o.totalElements, rows.length) }
  }
  return { rows: [], total: 0 }
}

/** `GET /api/datasource/{tableId}/preview` */
export async function fetchDatasourcePreview(
  tableId: string | number,
  pageNumber: number,
  pageSize: number,
): Promise<PagedListResult> {
  const enc = encodeURIComponent(String(tableId))
  const q = new URLSearchParams({
    pageNumber: String(pageNumber),
    pageSize: String(pageSize),
  })
  const res = await apiFetch(`/api/datasource/${enc}/preview?${q.toString()}`)
  if (!res.ok) {
    throw new Error(`加载数据预览失败：${res.status} ${res.statusText}`)
  }
  const raw = await readApiResult<unknown>(res)
  return normalizeDatasourcePreviewResult(raw)
}

function flattenConnectionInfoValue(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

/** `GET /api/datasource/{tableId}/connection/info` */
export async function fetchDatasourceConnectionInfo(tableId: string | number): Promise<Record<string, string>> {
  const enc = encodeURIComponent(String(tableId))
  const res = await apiFetch(`/api/datasource/${enc}/connection/info`)
  if (!res.ok) {
    throw new Error(`加载连接信息失败：${res.status} ${res.statusText}`)
  }
  const raw = await readApiResult<unknown>(res)
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    out[k] = flattenConnectionInfoValue(v)
  }
  return out
}

export type SyncDatasourceTableResult = {
  /** 后端 `data` 为文案时带回，用于 Message 展示 */
  detail?: string
}

function pickSyncResponseDetail(data: unknown): string | undefined {
  if (typeof data === 'string' && data.trim()) return data.trim()
  if (data != null && typeof data === 'object' && !Array.isArray(data)) {
    const o = data as Record<string, unknown>
    for (const k of ['message', 'msg', 'info', 'detail', 'description'] as const) {
      const v = o[k]
      if (typeof v === 'string' && v.trim()) return v.trim()
    }
  }
  return undefined
}

/** `GET /api/datasource/syncTable?tableName=` */
export async function syncDatasourceTable(tableName: string): Promise<SyncDatasourceTableResult> {
  const q = new URLSearchParams({ tableName })
  const res = await apiFetch(`/api/datasource/syncTable?${q.toString()}`)
  if (!res.ok) {
    throw new Error(`同步失败：${res.status} ${res.statusText}`)
  }
  const data = await readApiResultAllowEmpty<unknown>(res)
  return { detail: pickSyncResponseDetail(data) }
}

/**
 * `POST /api/datasource/{dataSourceId}/share`
 * 请求体为 **JSON 数组**，与后端 `List<Audience>` 一致（`userId` 必填，`userName` 可选）。
 */
export async function shareDatasource(
  dataSourceId: string | number,
  audiences: Array<{ userId: number; userName?: string }>,
): Promise<void> {
  const enc = encodeURIComponent(String(dataSourceId))
  const res = await apiFetch(`/api/datasource/${enc}/share`, { method: 'POST', body: audiences })
  if (!res.ok) {
    throw new Error(`共享失败：${res.status} ${res.statusText}`)
  }
  await readApiResultAllowEmpty<unknown>(res)
}

export type DatasourceTableFilterParams = {
  prefix: string
  exclude?: string
  limit?: number
}

function normalizeDatasourceFilterList(raw: unknown): string[] {
  if (raw == null) return []
  if (Array.isArray(raw)) {
    return raw
      .map((x) => {
        if (typeof x === 'string' && x.trim()) return x.trim()
        if (x && typeof x === 'object' && !Array.isArray(x)) {
          const o = x as Record<string, unknown>
          const n = o.name ?? o.tableName ?? o.value ?? o.label
          if (typeof n === 'string' && n.trim()) return n.trim()
        }
        return ''
      })
      .filter((s) => s.length > 0)
  }
  if (typeof raw === 'object') {
    const o = raw as Record<string, unknown>
    const nested = o.data ?? o.list ?? o.result ?? o.records
    if (nested != null) return normalizeDatasourceFilterList(nested)
  }
  return []
}

/** `GET /api/datasource/filter?prefix=&exclude=&limit=`（表名/前缀联想等） */
export async function fetchDatasourceTableNameFilter(
  params: DatasourceTableFilterParams,
): Promise<string[]> {
  const q = new URLSearchParams()
  q.set('prefix', params.prefix)
  /** 后端为 `Table.ExcludeType[]`，至少传一项；默认 `NONE` */
  const ex = params.exclude?.trim()
  q.set('exclude', ex && ex.length > 0 ? ex : 'NONE')
  q.set('limit', String(params.limit ?? 20))
  const res = await apiFetch(`/api/datasource/filter?${q.toString()}`)
  if (!res.ok) {
    throw new Error(`表名过滤查询失败：${res.status} ${res.statusText}`)
  }
  const raw = await readApiResult<unknown>(res)
  return normalizeDatasourceFilterList(raw)
}

/** `GET /api/datasource/table/{table}/structure` */
export async function fetchDatasourceTableStructure(table: string): Promise<unknown> {
  const enc = encodeURIComponent(table)
  const res = await apiFetch(`/api/datasource/table/${enc}/structure`)
  if (!res.ok) {
    throw new Error(`加载表结构失败：${res.status} ${res.statusText}`)
  }
  return readApiResult<unknown>(res)
}

function parseConnectionTestResult(raw: unknown): ConnectionTestResult {
  if (raw == null || typeof raw !== 'object') return { columns: [], data: [] }
  const o = raw as Record<string, unknown>
  const colArr = Array.isArray(o.columns) ? o.columns : []
  const columns = colArr
    .map((c): ConnectionTestColumnMeta | null => {
      if (c == null || typeof c !== 'object') return null
      const r = c as Record<string, unknown>
      const name = r.name
      if (typeof name !== 'string' || !name.trim()) return null
      const dataType = typeof r.dataType === 'string' && r.dataType.trim() ? r.dataType.trim() : 'text'
      return { name: name.trim(), dataType }
    })
    .filter((x): x is ConnectionTestColumnMeta => x != null)
  const data = Array.isArray(o.data) ? (o.data as Record<string, unknown>[]) : []
  return { columns, data }
}

/** `POST /api/datasource/connection/test` */
export async function testDatasourceConnection(body: DatasourceConnectionTestBody): Promise<ConnectionTestResult> {
  const res = await apiFetch('/api/datasource/connection/test', { method: 'POST', body })
  if (!res.ok) {
    throw new Error(`连接测试失败：${res.status} ${res.statusText}`)
  }
  const raw = await readApiResult<unknown>(res)
  return parseConnectionTestResult(raw)
}

/** `POST /api/datasource/rdbms` */
export async function createRdbmsDatasource(body: CreateRdbmsDatasourceBody): Promise<void> {
  const res = await apiFetch('/api/datasource/rdbms', { method: 'POST', body })
  if (!res.ok) {
    throw new Error(`创建数据库数据源失败：${res.status} ${res.statusText}`)
  }
  await readApiResultAllowEmpty<unknown>(res)
}

/** `GET /api/datasource/{tableName}/exists` → data 为是否已存在 */
export async function checkDatasourceTableExists(tableName: string): Promise<boolean> {
  const path = `/api/datasource/${encodeURIComponent(tableName)}/exists`
  const res = await apiFetch(path)
  if (!res.ok) {
    throw new Error(`校验表名失败：${res.status} ${res.statusText}`)
  }
  return readApiResult<boolean>(res)
}

export type CreateFlatDatasourceBody = {
  tableName: string
  fileMD5: string
  duration: number
  previewMode: string
  columns: FlatDatasourceColumnPayload[]
}

/** `POST /api/datasource/flat` → data 为 uploadId */
export async function createFlatDatasource(body: CreateFlatDatasourceBody): Promise<string> {
  const res = await apiFetch('/api/datasource/flat', { method: 'POST', body })
  if (!res.ok) {
    throw new Error(`创建数据源失败：${res.status} ${res.statusText}`)
  }
  const id = await readApiResult<string>(res)
  if (typeof id !== 'string' || !id.trim()) {
    throw new Error('创建数据源失败：未返回 uploadId')
  }
  return id.trim()
}

/** `GET /api/file/existsMD5`：FLAT 场景下多为 false，true 表示可视为已上传完成 */
export async function checkFlatFileExistsByMd5(uploadId: string, fileMD5: string): Promise<boolean> {
  const q = new URLSearchParams({ uploadId, fileMD5 })
  const res = await apiFetch(`/api/file/existsMD5?${q.toString()}`)
  if (!res.ok) {
    throw new Error(`MD5 校验请求失败：${res.status} ${res.statusText}`)
  }
  return readApiResult<boolean>(res)
}

/** 与 `FileManagerController#uploadFlat` 一致：仅 `file`、`uploadId`、`delimiter`、`encoding`（整文件上传不传 chunk/chunks） */
export type UploadFlatFileParams = {
  uploadId: string
  file: File
  delimiter: string
  encoding: string
}

/** `POST /api/file/flat/upload`，整文件单次上传（不传 chunk/chunks） */
export async function uploadFlatCsvFile(p: UploadFlatFileParams): Promise<void> {
  const form = new FormData()
  form.append('file', p.file)
  form.append('uploadId', p.uploadId)
  form.append('delimiter', p.delimiter)
  form.append('encoding', p.encoding)

  const res = await apiFetch('/api/file/flat/upload', { method: 'POST', body: form })
  if (!res.ok) {
    throw new Error(`上传文件失败：${res.status} ${res.statusText}`)
  }
  const text = await res.text()
  if (!text.trim()) return
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return
  }
  const wrapped = json as ApiResult<unknown>
  if (wrapped.status === 'FAIL') {
    throw new Error(wrapped.message ?? '上传失败')
  }
}
