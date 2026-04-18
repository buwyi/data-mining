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

/** `GET /token/check`（业务服，带 accessToken 头） */
export async function checkAccessToken(): Promise<void> {
  const res = await apiFetch('/token/check')
  if (!res.ok) {
    throw new Error(`Token 校验失败：${res.status} ${res.statusText}`)
  }
  await readApiResult<unknown>(res)
}

export type TokenInfoDto = {
  username?: string
  permissions?: string[]
  shareable?: unknown[]
}

/** `GET /token/info` */
export async function fetchTokenInfo(): Promise<TokenInfoDto> {
  const res = await apiFetch('/token/info')
  if (!res.ok) {
    throw new Error(`获取用户信息失败：${res.status} ${res.statusText}`)
  }
  const data = await readApiResult<unknown>(res)
  if (data === null || typeof data !== 'object') {
    return {}
  }
  return data as TokenInfoDto
}
