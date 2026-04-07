import type { ApiResult } from '../types/apiResult'
import type { CatChildNodeDto, ComponentDefinitionDto } from '../types/component'
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

function parseCatChildList(data: unknown): CatChildNodeDto[] {
  if (!Array.isArray(data)) return []
  return data
    .map((row) => {
      if (row === null || typeof row !== 'object') return null
      const o = row as Record<string, unknown>
      const id = o.id
      const name = o.name
      if (typeof id !== 'number' || !Number.isFinite(id)) return null
      if (typeof name !== 'string') return null
      const component = o.component === true
      const parentId = o.parentId
      const leaf = o.leaf
      return {
        id,
        name,
        component,
        ...(typeof parentId === 'number' ? { parentId } : {}),
        ...(typeof leaf === 'boolean' ? { leaf } : {}),
        ...o,
      } as CatChildNodeDto
    })
    .filter((x): x is CatChildNodeDto => x !== null)
}

/** `GET /api/cat/{catId}/childs` */
export async function fetchCatChildren(catId: number): Promise<CatChildNodeDto[]> {
  const res = await apiFetch(`/api/cat/${catId}/childs`)
  if (!res.ok) {
    throw new Error(`加载分类子节点失败：${res.status} ${res.statusText}`)
  }
  const data = await readApiResult<unknown>(res)
  return parseCatChildList(data)
}

export type CreateCatBody = {
  name: string
  parentId: number
}

/** `POST /api/cat` */
export async function createCat(body: CreateCatBody): Promise<void> {
  const res = await apiFetch('/api/cat', { method: 'POST', body })
  if (!res.ok) {
    throw new Error(`新建分类失败：${res.status} ${res.statusText}`)
  }
  await readApiResult<unknown>(res)
}

/** `PATCH /api/cat/{catId}?name=` */
export async function patchCatName(catId: number, name: string): Promise<void> {
  const q = new URLSearchParams({ name })
  const res = await apiFetch(`/api/cat/${catId}?${q.toString()}`, { method: 'PATCH' })
  if (!res.ok) {
    throw new Error(`重命名分类失败：${res.status} ${res.statusText}`)
  }
  await readApiResult<unknown>(res)
}

/** `DELETE /api/cat/{catId}` */
export async function deleteCat(catId: number): Promise<void> {
  const res = await apiFetch(`/api/cat/${catId}`, { method: 'DELETE' })
  if (!res.ok) {
    throw new Error(`删除分类失败：${res.status} ${res.statusText}`)
  }
  await readApiResult<unknown>(res)
}

/** `GET /api/component/{componentId}` */
export async function fetchComponentDefinition(componentId: number): Promise<ComponentDefinitionDto> {
  const res = await apiFetch(`/api/component/${componentId}`)
  if (!res.ok) {
    throw new Error(`获取组件失败：${res.status} ${res.statusText}`)
  }
  const data = await readApiResult<unknown>(res)
  if (data === null || typeof data !== 'object') {
    throw new Error('组件数据格式无效')
  }
  return data as ComponentDefinitionDto
}

/** `PUT /api/component/{componentId}` */
export async function updateComponentDefinition(
  componentId: number,
  body: ComponentDefinitionDto,
): Promise<void> {
  const res = await apiFetch(`/api/component/${componentId}`, { method: 'PUT', body })
  if (!res.ok) {
    throw new Error(`保存组件失败：${res.status} ${res.statusText}`)
  }
  await readApiResult<unknown>(res)
}

/** `DELETE /api/component/{componentId}` */
export async function deleteComponent(componentId: number): Promise<void> {
  const res = await apiFetch(`/api/component/${componentId}`, { method: 'DELETE' })
  if (!res.ok) {
    throw new Error(`删除组件失败：${res.status} ${res.statusText}`)
  }
  await readApiResult<unknown>(res)
}
