import type { ApiResult } from '../types/apiResult'
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

/**
 * `GET /api/seq/` — 生成新节点/端口等用的全局唯一 ID（与 api-doc 5.6 一致）。
 */
export async function fetchNextSequenceId(): Promise<string> {
  const res = await apiFetch(`/api/seq/?d=${Date.now()}`)
  if (!res.ok) {
    throw new Error(`申请序列号失败：${res.status} ${res.statusText}`)
  }
  const data = await readApiResult<unknown>(res)
  if (typeof data === 'string' || typeof data === 'number') {
    return String(data)
  }
  if (data !== null && typeof data === 'object' && 'id' in data) {
    const id = (data as { id: unknown }).id
    if (typeof id === 'string' || typeof id === 'number') return String(id)
  }
  throw new Error('序列号接口返回格式无法识别')
}
