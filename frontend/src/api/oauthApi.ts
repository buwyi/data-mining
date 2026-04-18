import { resolveOauthAccessTokenPath } from '../config/accessTokenRuntime'
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
 * `POST {httpOauth}/{oauthAccessTokenPath}`（路径默认 `accessToken`，可由 `config.json` 或 `VITE_OAUTH_ACCESS_TOKEN_PATH` 覆盖）
 * 使用 `application/x-www-form-urlencoded`，与 TipDM Vue（jQuery ajax）及 Apache Oltu `OAuthTokenRequest` 一致。
 */
export async function exchangeAuthorizationCode(
  params: ExchangeCodeParams,
  init?: { signal?: AbortSignal },
): Promise<string> {
  const path = resolveOauthAccessTokenPath()
  const url = `${getOauthBase()}/${path}`
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: params.clientId,
    client_secret: params.clientSecret,
    code: params.code,
    redirect_uri: params.redirectUri,
  })
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8' },
    signal: init?.signal,
    body: body.toString(),
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
