import { useAuthStore } from '../stores/authStore'
import { useConfigStore } from '../stores/configStore'

function resolveAccessToken(): string | null {
  const fromStore = useAuthStore.getState().accessToken
  if (fromStore) return fromStore
  try {
    return localStorage.getItem('accessToken')
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
}

/** 业务 API 请求：自动附加 `accessToken`，JSON 时设置 Content-Type */
export async function apiFetch(path: string, init: JsonRequestInit = {}): Promise<Response> {
  const base = getHttpServerBase()
  const url = path.startsWith('http') ? path : `${base}${path.startsWith('/') ? '' : '/'}${path}`
  const headers = new Headers(init.headers)
  const token = resolveAccessToken()
  if (token) headers.set('accessToken', token)
  let body = init.body as BodyInit | null | undefined
  if (init.body !== undefined && init.body !== null && !(init.body instanceof FormData)) {
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json; charset=utf-8')
    }
    body = JSON.stringify(init.body)
  }
  return fetch(url, { ...init, headers, body })
}
