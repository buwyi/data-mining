import type { ApiResult } from '../types/apiResult'
import { apiFetch } from './httpClient'

export type ProjectDetailDto = Record<string, unknown> & {
  id: number
  name?: string
  json?: string | null
}

export type ProjectChildDto = {
  id: number
  name: string
  parentId: number
  leaf: boolean
  delete: boolean
  sequence?: number
  creatorId?: number
  creatorName?: string
}

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

/** `GET /api/project/{documentId}/child` */
export async function fetchProjectChildren(documentId: number): Promise<ProjectChildDto[]> {
  const res = await apiFetch(`/api/project/${documentId}/child`)
  if (!res.ok) {
    throw new Error(`加载工程目录失败：${res.status} ${res.statusText}`)
  }
  return readApiResult<ProjectChildDto[]>(res)
}

/** `GET /api/project/{projectId}` */
export async function fetchProjectDetail(projectId: number): Promise<ProjectDetailDto> {
  const res = await apiFetch(`/api/project/${projectId}`)
  if (!res.ok) {
    throw new Error(`加载工程详情失败：${res.status} ${res.statusText}`)
  }
  return readApiResult<ProjectDetailDto>(res)
}

/** `POST /api/project/{projectId}`，字段 `content` 为 JSON 字符串 */
export async function saveProjectFlowContent(projectId: number, content: string): Promise<void> {
  const form = new FormData()
  form.append('content', content)
  const res = await apiFetch(`/api/project/${projectId}`, {
    method: 'POST',
    body: form,
  })
  if (!res.ok) {
    throw new Error(`保存流程失败：${res.status} ${res.statusText}`)
  }
  const text = await res.text()
  if (!text.trim()) return
  const wrapped = JSON.parse(text) as ApiResult<unknown>
  if (wrapped.status === 'FAIL') {
    throw new Error(wrapped.message ?? '保存失败')
  }
}
