import type { ApiResult } from '../types/apiResult'
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

async function readApiResultAllowEmpty(res: Response): Promise<void> {
  const text = await res.text()
  if (!text.trim()) return
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error(`接口返回非 JSON（HTTP ${res.status}）`)
  }
  const wrapped = json as ApiResult<unknown>
  if (wrapped.status === 'FAIL') {
    throw new Error(wrapped.message ?? '请求失败')
  }
  if (wrapped.status !== 'SUCCESS') {
    throw new Error('未知响应状态')
  }
}

/** `GET /api/template/list?pageNumber=&pageSize=` */
export async function fetchTemplateList(pageNumber: number, pageSize: number): Promise<PagedListResult> {
  const q = new URLSearchParams({
    pageNumber: String(pageNumber),
    pageSize: String(pageSize),
  })
  const res = await apiFetch(`/api/template/list?${q.toString()}`)
  if (!res.ok) {
    throw new Error(`加载模板列表失败：${res.status} ${res.statusText}`)
  }
  const raw = await readApiResult<unknown>(res)
  return normalizePagedListData(raw)
}

/** `DELETE /api/template/{templateId}` */
export async function deleteTemplate(templateId: string | number): Promise<void> {
  const enc = encodeURIComponent(String(templateId))
  const res = await apiFetch(`/api/template/${enc}`, { method: 'DELETE' })
  if (!res.ok) {
    throw new Error(`删除模板失败：${res.status} ${res.statusText}`)
  }
  await readApiResultAllowEmpty(res)
}
