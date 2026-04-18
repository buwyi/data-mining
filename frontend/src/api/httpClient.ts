import {
  applyApiAccessTokenHeader,
  resolveAccessTokenStorageKey,
} from '../config/accessTokenRuntime'
import { useAuthStore } from '../stores/authStore'
import { useConfigStore } from '../stores/configStore'

function resolveAccessToken(): string | null {
  const fromStore = useAuthStore.getState().accessToken
  if (fromStore) return fromStore
  try {
    return localStorage.getItem(resolveAccessTokenStorageKey())
  } catch {
    return null
  }
}

export function getHttpServerBase(): string {
  const base = useConfigStore.getState().config?.httpServer
  if (!base) throw new Error('尚未加载运行时配置（httpServer）')
  return base.replace(/\/$/, '')
}

export type JsonRequestInit = Omit<RequestInit, 'body'> & {
  body?: unknown
  /** 仅此请求作为 `accessToken` 头（如 `/show` 外链分享 token），不写入登录态 */
  overrideAccessToken?: string
}

/** 业务 API 请求：自动附加 `accessToken`，JSON 时设置 Content-Type */
export async function apiFetch(path: string, init: JsonRequestInit = {}): Promise<Response> {
  const { overrideAccessToken, body: rawBody, headers: initHeaders, ...restInit } = init
  const base = getHttpServerBase()
  const url = path.startsWith('http') ? path : `${base}${path.startsWith('/') ? '' : '/'}${path}`
  const headers = new Headers(initHeaders)
  const override = typeof overrideAccessToken === 'string' ? overrideAccessToken.trim() : ''
  const token = override.length > 0 ? override : resolveAccessToken()
  if (token) applyApiAccessTokenHeader(headers, token)
  let body = rawBody as BodyInit | null | undefined
  if (rawBody !== undefined && rawBody !== null && !(rawBody instanceof FormData)) {
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json; charset=utf-8')
    }
    body = JSON.stringify(rawBody)
  }
  return fetch(url, { ...restInit, headers, body })
}
