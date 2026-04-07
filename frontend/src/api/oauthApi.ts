import { useConfigStore } from '../stores/configStore'

function getOauthBase(): string {
  const base = useConfigStore.getState().config?.httpOauth
  if (!base) throw new Error('OAuth 地址未就绪（httpOauth）')
  return base.replace(/\/$/, '')
}

export type ExchangeCodeParams = {
  code: string
  redirectUri: string
  clientId: string
  clientSecret: string
}

/**
 * `POST {httpOauth}/accessToken`（与 api-doc 4.1 一致，请求体为 JSON）。
 * 响应一般为 OAuth 标准字段 `access_token`。
 */
export async function exchangeAuthorizationCode(
  params: ExchangeCodeParams,
  init?: { signal?: AbortSignal },
): Promise<string> {
  const url = `${getOauthBase()}/accessToken`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    signal: init?.signal,
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: params.clientId,
      client_secret: params.clientSecret,
      code: params.code,
      redirect_uri: params.redirectUri,
    }),
  })
  let json: unknown
  try {
    json = await res.json()
  } catch {
    throw new Error(`换票接口返回非 JSON（HTTP ${res.status}）`)
  }
  if (!res.ok) {
    const msg =
      json !== null && typeof json === 'object' && 'message' in json
        ? String((json as { message?: unknown }).message)
        : `换票失败：HTTP ${res.status}`
    throw new Error(msg)
  }
  if (json === null || typeof json !== 'object') {
    throw new Error('换票响应格式无效')
  }
  const o = json as Record<string, unknown>
  const token = o.access_token ?? o.accessToken
  if (typeof token !== 'string' || !token) {
    throw new Error('换票响应中未找到 access_token')
  }
  return token
}
