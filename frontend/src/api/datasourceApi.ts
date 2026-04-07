import type { ApiResult } from '../types/apiResult'
import type { FlatDatasourceColumnPayload } from '../types/datasource'
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

export type UploadFlatFileParams = {
  uploadId: string
  file: File
  delimiter: string
  encoding: string
  fileMD5: string
  tableName: string
  header: string
}

/** `POST /api/file/flat/upload`，整文件单次上传（不传 chunk/chunks） */
export async function uploadFlatCsvFile(p: UploadFlatFileParams): Promise<void> {
  const form = new FormData()
  form.append('file', p.file)
  form.append('uploadId', p.uploadId)
  form.append('delimiter', p.delimiter)
  form.append('encoding', p.encoding)
  form.append('fileMD5', p.fileMD5)
  form.append('tableName', p.tableName)
  form.append('header', p.header)

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
