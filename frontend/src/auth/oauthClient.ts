import type { AppRuntimeConfig } from '../types/appConfig'

export function resolveOAuthClientId(config: AppRuntimeConfig | null): string | null {
  const fromCfg = config?.oauthClientId
  if (typeof fromCfg === 'string' && fromCfg.length > 0) return fromCfg
  const v = import.meta.env.VITE_OAUTH_CLIENT_ID
  return typeof v === 'string' && v.length > 0 ? v : null
}

/** 仅用于换票；生产环境建议改为后端代理换票，避免在浏览器暴露 secret */
export function resolveOAuthClientSecret(): string {
  const v = import.meta.env.VITE_OAUTH_CLIENT_SECRET
  return typeof v === 'string' ? v : ''
}
