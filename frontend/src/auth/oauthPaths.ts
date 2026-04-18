import { useConfigStore } from '../stores/configStore'

/** OAuth 授权服务器回调路径（需在授权服务器注册，与 `config.httpClient` 拼接） */
export const OAUTH_CALLBACK_PATH = '/oauth/callback'

export function getOAuthRedirectUri(): string {
  const client = useConfigStore.getState().config?.httpClient
  if (!client) throw new Error('httpClient 未配置')
  return `${client.replace(/\/$/, '')}${OAUTH_CALLBACK_PATH}`
}

export function buildOAuthAuthorizeUrl(clientId: string): string {
  const oauth = useConfigStore.getState().config?.httpOauth
  if (!oauth) throw new Error('httpOauth 未配置')
  const base = oauth.replace(/\/$/, '')
  const u = new URL(`${base}/authorize`)
  u.searchParams.set('client_id', clientId)
  u.searchParams.set('response_type', 'code')
  u.searchParams.set('redirect_uri', getOAuthRedirectUri())
  return u.toString()
}
