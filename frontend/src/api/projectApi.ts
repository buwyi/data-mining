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

function tryParseWorkFlowId(json: unknown): number | null {
  if (typeof json !== 'object' || json === null) return null
  const o = json as Record<string, unknown>
  const pick = (v: unknown): number | null => {
    if (typeof v === 'number' && Number.isFinite(v)) return v
    return null
  }
  const top = pick(o.workFlowId ?? o.workflowId)
  if (top !== null) return top
  const data = o.data
  if (typeof data === 'object' && data !== null) {
    const d = data as Record<string, unknown>
    return pick(d.workFlowId ?? d.workflowId)
  }
  return null
}

/** `POST /api/project/execute/{projectId}/apply`，返回 executionId（文档称 data 为 base64-uuid 字符串） */
export async function applyProjectExecution(projectId: number): Promise<string> {
  const res = await apiFetch(`/api/project/execute/${projectId}/apply`, { method: 'POST' })
  if (!res.ok) {
    throw new Error(`申请运行会话失败：${res.status} ${res.statusText}`)
  }
  const id = await readApiResult<string>(res)
  if (typeof id !== 'string' || !id.trim()) {
    throw new Error('申请运行会话失败：未返回 executionId')
  }
  return id.trim()
}

export type RunProjectFlowFullResult = {
  /** 若响应 JSON 中含 workFlowId，可用于调用 `shutdownProjectRun` */
  workFlowId: number | null
}

/** `GET /api/project/execute/{projectId}?executionId=…`：按文档为「全部运行」 */
export async function runProjectFlowFull(
  projectId: number,
  executionId: string,
): Promise<RunProjectFlowFullResult> {
  const q = new URLSearchParams({ executionId })
  const res = await apiFetch(`/api/project/execute/${projectId}?${q.toString()}`)
  if (!res.ok) {
    throw new Error(`启动流程运行失败：${res.status} ${res.statusText}`)
  }
  const text = await res.text()
  if (!text.trim()) {
    return { workFlowId: null }
  }
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return { workFlowId: null }
  }
  const wrapped = json as ApiResult<unknown>
  if (wrapped.status === 'FAIL') {
    throw new Error(wrapped.message ?? '运行失败')
  }
  return { workFlowId: tryParseWorkFlowId(json) }
}

/** `GET /api/project/shutdown/{workFlowId}` */
export async function shutdownProjectRun(workFlowId: number): Promise<void> {
  const res = await apiFetch(`/api/project/shutdown/${workFlowId}`)
  if (!res.ok) {
    throw new Error(`停止运行失败：${res.status} ${res.statusText}`)
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
    throw new Error(wrapped.message ?? '停止失败')
  }
}
