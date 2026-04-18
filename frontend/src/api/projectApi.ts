import type { ApiResult } from '../types/apiResult'
import { apiFetch } from './httpClient'

/** `GET /api/project/{id}` 返回的 `versions` 单项（见 api-doc 5.2） */
export type ProjectVersionMeta = {
  createTime?: string
  description?: string
}

export type ProjectDetailDto = Record<string, unknown> & {
  id: number
  name?: string
  description?: string
  /** 部分后端在工程详情中返回，用于「另存为」父目录等 */
  parentId?: number
  json?: string | null
  versions?: Record<string, ProjectVersionMeta>
}

export type ProjectChildDto = {
  /**
   * 文档树节点 id（`dm_document.id`），与 `GET /api/project/{id}/child` 的路径参数一致。
   * 叶子工程行上的 `id` 仍是文档 id，**不是** `GET /api/project/{id}` 所用的工程 id。
   */
  id: number
  name: string
  /** 父文档节点 id；根下节点后端可能省略字段，前端按 `0` 处理 */
  parentId: number
  leaf: boolean
  delete: boolean
  sequence?: number
  creatorId?: number
  creatorName?: string
  /** 仅 `leaf === true` 时有值：`dm_project.id`，用于详情/删除/路由 */
  projectEntityId?: number
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

/** 部分 POST 可能返回空 body，仍视为成功 */
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

function toFiniteInt(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.trunc(v)
  if (typeof v === 'string' && /^\d+$/.test(v.trim())) return Number.parseInt(v.trim(), 10)
  return null
}

function normalizeProjectChildRow(raw: unknown): ProjectChildDto | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  const documentId = toFiniteInt(o.id)
  if (documentId === null) return null
  const name = typeof o.name === 'string' ? o.name : String(o.name ?? '')
  const leaf = o.leaf === true || o.isLeaf === true
  const del = o.delete === true || o.isDelete === true
  const parentRaw = o.parentId ?? o.parent_id
  const parentId = toFiniteInt(parentRaw) ?? 0

  let projectEntityId: number | undefined
  if (leaf) {
    const proj = o.project
    if (proj !== null && typeof proj === 'object' && !Array.isArray(proj)) {
      const pid = toFiniteInt((proj as Record<string, unknown>).id)
      if (pid !== null) projectEntityId = pid
    }
  }

  return {
    id: documentId,
    name,
    parentId,
    leaf,
    delete: Boolean(del),
    sequence: toFiniteInt(o.sequence) ?? undefined,
    creatorId: toFiniteInt(o.creatorId ?? o.creator_id) ?? undefined,
    creatorName:
      typeof o.creatorName === 'string'
        ? o.creatorName
        : typeof o.creator_name === 'string'
          ? o.creator_name
          : undefined,
    projectEntityId,
  }
}

/** `GET /api/project/{documentId}/child` — 返回 `Document` 列表，已规范 `parentId` 与嵌套 `project.id` */
export async function fetchProjectChildren(documentId: number): Promise<ProjectChildDto[]> {
  const res = await apiFetch(`/api/project/${documentId}/child`)
  if (!res.ok) {
    throw new Error(`加载工程目录失败：${res.status} ${res.statusText}`)
  }
  const data = await readApiResult<unknown>(res)
  if (!Array.isArray(data)) return []
  return data.map(normalizeProjectChildRow).filter((x): x is ProjectChildDto => x !== null)
}

export type CreateProjectBody = {
  name: string
  parentId: number
  description?: string
}

/** `POST /api/project/` 新建工程（成功后磁盘创建 json，默认空 Flow） */
export async function createProject(body: CreateProjectBody): Promise<number | null> {
  const res = await apiFetch('/api/project/', { method: 'POST', body })
  if (!res.ok) {
    throw new Error(`新建工程失败：${res.status} ${res.statusText}`)
  }
  const data = await readApiResultAllowEmpty<unknown>(res)
  if (data === undefined) return null
  if (typeof data === 'number' && Number.isFinite(data)) return data
  if (data !== null && typeof data === 'object' && 'id' in data) {
    const id = (data as { id: unknown }).id
    if (typeof id === 'number' && Number.isFinite(id)) return id
  }
  return null
}

/**
 * TipDM `POST /api/project/{templateProjectId}/clone/{parentDocumentId}?newName=`（见 `ProjectController#clone`）。
 * - **templateProjectId**：模板关联的**源工程 id**（列表项 `project.id`，对应 `dm_project`，非 `dm_template.id`）。
 * - **parentDocumentId**：新工程在文档树下的**父目录 id**（根多为 `0`）。
 */
export async function cloneProjectFromDocument(
  templateProjectId: number,
  parentDocumentId: string | number,
  newName: string,
): Promise<number | null> {
  const name = newName.trim()
  if (!name) {
    throw new Error('工程名称不能为空')
  }
  const q = new URLSearchParams({ newName: name })
  const enc = encodeURIComponent(String(parentDocumentId))
  const res = await apiFetch(`/api/project/${templateProjectId}/clone/${enc}?${q.toString()}`, {
    method: 'POST',
  })
  if (!res.ok) {
    throw new Error(`从模板创建工程失败：${res.status} ${res.statusText}`)
  }
  const data = await readApiResultAllowEmpty<unknown>(res)
  if (data === undefined) return null
  if (typeof data === 'number' && Number.isFinite(data)) return data
  if (data !== null && typeof data === 'object' && 'id' in data) {
    const id = (data as { id: unknown }).id
    if (typeof id === 'number' && Number.isFinite(id)) return id
    if (typeof id === 'string' && /^\d+$/.test(id)) return Number.parseInt(id, 10)
  }
  return null
}

/**
 * `POST /api/project/{parentProjectId}/saveAs/{sourceDocumentId}?asName=` — 另存为新工程（见 api-doc 5.1）。
 * 约定：首段为**目标父目录 id**（`0` 为根），次段为**源工程 id**（通常为当前工程）；若与你方后端语义不一致再调整调用方。
 */
export async function saveProjectAsCopy(
  parentProjectId: number,
  sourceDocumentId: string | number,
  asName: string,
): Promise<number | null> {
  const name = asName.trim()
  if (!name) {
    throw new Error('新工程名称不能为空')
  }
  const q = new URLSearchParams({ asName: name })
  const enc = encodeURIComponent(String(sourceDocumentId))
  const res = await apiFetch(`/api/project/${parentProjectId}/saveAs/${enc}?${q.toString()}`, {
    method: 'POST',
  })
  if (!res.ok) {
    throw new Error(`另存为工程失败：${res.status} ${res.statusText}`)
  }
  const data = await readApiResultAllowEmpty<unknown>(res)
  if (data === undefined) return null
  if (typeof data === 'number' && Number.isFinite(data)) return data
  if (data !== null && typeof data === 'object' && 'id' in data) {
    const id = (data as { id: unknown }).id
    if (typeof id === 'number' && Number.isFinite(id)) return id
    if (typeof id === 'string' && /^\d+$/.test(id)) return Number.parseInt(id, 10)
  }
  return null
}

export type CreateProjectCatBody = {
  name: string
  parentId: number
}

/** `POST /api/project/cat` 新建工程分类目录 */
export async function createProjectCategory(body: CreateProjectCatBody): Promise<void> {
  const res = await apiFetch('/api/project/cat', { method: 'POST', body })
  if (!res.ok) {
    throw new Error(`新建分类失败：${res.status} ${res.statusText}`)
  }
  await readApiResultAllowEmpty<unknown>(res)
}

/** `DELETE /api/project/cat/{catId}` 删除空分类（旧版要求子项已清空） */
export async function deleteProjectCategory(catId: number): Promise<void> {
  const res = await apiFetch(`/api/project/cat/${catId}`, { method: 'DELETE' })
  if (!res.ok) {
    throw new Error(`删除分类失败：${res.status} ${res.statusText}`)
  }
  await readApiResultAllowEmpty<unknown>(res)
}

/** `DELETE /api/project/{projectId}` 删除工程 */
export async function deleteProject(projectId: number): Promise<void> {
  const res = await apiFetch(`/api/project/${projectId}`, { method: 'DELETE' })
  if (!res.ok) {
    throw new Error(`删除工程失败：${res.status} ${res.statusText}`)
  }
  await readApiResultAllowEmpty<unknown>(res)
}

/** `PATCH /api/project/modify/{projectId}/desc?desc=...` */
export async function patchProjectDescription(projectId: number, desc: string): Promise<void> {
  const q = new URLSearchParams({ desc })
  const res = await apiFetch(`/api/project/modify/${projectId}/desc?${q.toString()}`, {
    method: 'PATCH',
  })
  if (!res.ok) {
    throw new Error(`更新描述失败：${res.status} ${res.statusText}`)
  }
  await readApiResultAllowEmpty<unknown>(res)
}

export type FetchProjectDetailOptions = {
  /** 与 `httpClient` 一致：外链预览等场景传入分享 token */
  overrideAccessToken?: string
}

/** `GET /api/project/{projectId}` */
export async function fetchProjectDetail(
  projectId: number,
  options?: FetchProjectDetailOptions,
): Promise<ProjectDetailDto> {
  const res = await apiFetch(`/api/project/${projectId}`, {
    overrideAccessToken: options?.overrideAccessToken,
  })
  if (!res.ok) {
    throw new Error(`加载工程详情失败：${res.status} ${res.statusText}`)
  }
  return readApiResult<ProjectDetailDto>(res)
}

/** `PUT /api/project/{projectId}?description=`：创建历史版本（建议先 `saveProjectFlowContent`）；`description` 与后端 `@RequestParam` 一致 */
export async function createProjectHistoryVersion(
  projectId: number,
  options?: { description?: string },
): Promise<void> {
  const q = new URLSearchParams()
  const d = options?.description?.trim()
  if (d) q.set('description', d)
  const qs = q.toString()
  const url = qs.length > 0 ? `/api/project/${projectId}?${qs}` : `/api/project/${projectId}`
  const res = await apiFetch(url, { method: 'PUT' })
  if (!res.ok) {
    throw new Error(`创建历史版本失败：${res.status} ${res.statusText}`)
  }
  await readApiResultAllowEmpty<unknown>(res)
}

/** `PUT /api/project/{projectId}/saveAsTemplate` — 后端为 `String[] tags`，多个标签用重复 query 键 `tags` */
export async function saveProjectAsTemplate(projectId: number, tags?: string): Promise<void> {
  const q = new URLSearchParams()
  const t = tags?.trim()
  if (t) {
    for (const part of t.split(/[,，]/).map((s) => s.trim()).filter(Boolean)) {
      q.append('tags', part)
    }
  }
  const qs = q.toString()
  const url =
    qs.length > 0
      ? `/api/project/${projectId}/saveAsTemplate?${qs}`
      : `/api/project/${projectId}/saveAsTemplate`
  const res = await apiFetch(url, { method: 'PUT' })
  if (!res.ok) {
    throw new Error(`另存为模板失败：${res.status} ${res.statusText}`)
  }
  await readApiResultAllowEmpty<unknown>(res)
}

/** `GET /api/project/{projectId}/{versionKey}`：查看某历史版本元数据/内容 */
export async function fetchProjectVersionDetail(
  projectId: number,
  versionKey: string,
): Promise<ProjectDetailDto> {
  const enc = encodeURIComponent(versionKey)
  const res = await apiFetch(`/api/project/${projectId}/${enc}`)
  if (!res.ok) {
    throw new Error(`加载历史版本失败：${res.status} ${res.statusText}`)
  }
  return readApiResult<ProjectDetailDto>(res)
}

/** `PUT /api/project/{projectId}/recover/{versionKey}`：恢复指定历史版本为当前工程 */
export async function recoverProjectVersion(projectId: number, versionKey: string): Promise<void> {
  const enc = encodeURIComponent(versionKey)
  const res = await apiFetch(`/api/project/${projectId}/recover/${enc}`, { method: 'PUT' })
  if (!res.ok) {
    throw new Error(`恢复版本失败：${res.status} ${res.statusText}`)
  }
  await readApiResultAllowEmpty<unknown>(res)
}

/** `DELETE /api/project/{projectId}/{versionKey}`：删除历史版本记录 */
export async function deleteProjectVersion(projectId: number, versionKey: string): Promise<void> {
  const enc = encodeURIComponent(versionKey)
  const res = await apiFetch(`/api/project/${projectId}/${enc}`, { method: 'DELETE' })
  if (!res.ok) {
    throw new Error(`删除历史版本失败：${res.status} ${res.statusText}`)
  }
  await readApiResultAllowEmpty<unknown>(res)
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

/**
 * TipDM `ProjectController#execute` 将调度器返回的 **`String workFlowId`** 写入 `data`（常为顶层 `data` 字符串，非数字）。
 */
function tryParseWorkFlowId(json: unknown): string | null {
  if (typeof json !== 'object' || json === null) return null
  const o = json as Record<string, unknown>
  const normalize = (v: unknown): string | null => {
    if (typeof v === 'string' && v.trim()) return v.trim()
    if (typeof v === 'number' && Number.isFinite(v)) return String(v)
    return null
  }
  const top = normalize(o.workFlowId ?? o.workflowId)
  if (top !== null) return top
  const data = o.data
  if (data != null) {
    const flat = normalize(data)
    if (flat !== null) return flat
    if (typeof data === 'object' && !Array.isArray(data)) {
      const d = data as Record<string, unknown>
      return normalize(d.workFlowId ?? d.workflowId)
    }
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
  /** 调度任务 id；`ProjectController` 侧为字符串，与 `GET …/shutdown/{workFlowId}` 一致 */
  workFlowId: string | null
}

/** 与 `api-doc` 5.4 一致；`componentId` 为画布节点 id 字符串（旧版 `curNodeId`） */
export type ProjectExecuteVariant = 'full' | 'endAt' | 'only' | 'startAt'

function buildProjectExecutePath(
  projectId: number,
  executionId: string,
  variant: ProjectExecuteVariant,
  nodeId?: string,
): string {
  const q = new URLSearchParams({ executionId }).toString()
  if (variant === 'full') {
    return `/api/project/execute/${projectId}?${q}`
  }
  if (!nodeId?.length) {
    throw new Error('按节点运行需要 nodeId')
  }
  const enc = encodeURIComponent(nodeId)
  if (variant === 'endAt') {
    return `/api/project/execute/${projectId}/endAt/${enc}?${q}`
  }
  if (variant === 'only') {
    return `/api/project/execute/${projectId}/only/${enc}?${q}`
  }
  return `/api/project/execute/${projectId}/startAt/${enc}?${q}`
}

async function getRunExecuteResponse(res: Response): Promise<RunProjectFlowFullResult> {
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

/** `GET …/execute/…` 各模式（先 `applyProjectExecution` 拿到 executionId） */
export async function runProjectExecute(
  projectId: number,
  executionId: string,
  variant: ProjectExecuteVariant,
  nodeId?: string,
): Promise<RunProjectFlowFullResult> {
  const path = buildProjectExecutePath(projectId, executionId, variant, nodeId)
  const res = await apiFetch(path)
  return getRunExecuteResponse(res)
}

/** `GET /api/project/execute/{projectId}?executionId=…`：全部运行 */
export async function runProjectFlowFull(
  projectId: number,
  executionId: string,
): Promise<RunProjectFlowFullResult> {
  return runProjectExecute(projectId, executionId, 'full')
}

/** `GET /api/project/shutdown/{workFlowId}`（路径变量为字符串，与 `WorkFlowScheduler.execute` 返回值一致） */
export async function shutdownProjectRun(workFlowId: string | number): Promise<void> {
  const enc = encodeURIComponent(String(workFlowId))
  const res = await apiFetch(`/api/project/shutdown/${enc}`)
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
