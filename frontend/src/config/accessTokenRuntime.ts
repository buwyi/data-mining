import { useConfigStore } from '../stores/configStore'

function parseCommaList(v: string | undefined): string[] {
  if (v === undefined || !String(v).trim()) return []
  return String(v)
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function cfgString(
  fromConfig: string | undefined,
  fromEnv: string | undefined,
  fallback: string,
): string {
  if (typeof fromConfig === 'string' && fromConfig.trim()) return fromConfig.trim()
  if (typeof fromEnv === 'string' && fromEnv.trim()) return fromEnv.trim()
  return fallback
}

/** 持久化 token 的 localStorage 键（默认 `accessToken`） */
export function resolveAccessTokenStorageKey(): string {
  return cfgString(
    useConfigStore.getState().config?.accessTokenStorageKey,
    import.meta.env.VITE_ACCESS_TOKEN_STORAGE_KEY,
    'accessToken',
  )
}

/** 业务 API 请求头名（默认 `accessToken`，可改为 `Authorization` 等） */
export function resolveAccessTokenHeaderName(): string {
  const n = cfgString(
    useConfigStore.getState().config?.accessTokenHeaderName,
    import.meta.env.VITE_ACCESS_TOKEN_HEADER_NAME,
    'accessToken',
  )
  return n || 'accessToken'
}

/** 头值前缀，如 `Bearer `（与 `Authorization` 组合使用） */
export function resolveAccessTokenHeaderPrefix(): string {
  const cfg = useConfigStore.getState().config?.accessTokenHeaderPrefix
  if (typeof cfg === 'string') return cfg
  const env = import.meta.env.VITE_ACCESS_TOKEN_HEADER_PREFIX
  return typeof env === 'string' ? env : ''
}

const DEFAULT_SHARE_QUERY_KEYS = ['token', 'shareToken', 't', 'accessToken'] as const

/**
 * `/show` 外链识别分享 token 时的 query 参数名（默认键在前，config/env 追加去重）。
 */
export function getShareAccessTokenQueryParamNames(): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  const add = (k: string) => {
    const t = k.trim()
    if (!t || seen.has(t)) return
    seen.add(t)
    out.push(t)
  }
  for (const k of DEFAULT_SHARE_QUERY_KEYS) add(k)
  const extra = useConfigStore.getState().config?.shareAccessTokenQueryParams
  if (Array.isArray(extra)) {
    for (const x of extra) {
      if (typeof x === 'string') add(x)
    }
  }
  for (const k of parseCommaList(import.meta.env.VITE_SHARE_ACCESS_TOKEN_QUERY_PARAMS)) {
    add(k)
  }
  return out
}

/** Socket.IO 握手 query 参数名（TipDM 默认为 `accessToken`） */
export function resolveSocketAccessTokenQueryParam(): string {
  const n = cfgString(
    useConfigStore.getState().config?.socketAccessTokenQueryParam,
    import.meta.env.VITE_SOCKET_ACCESS_TOKEN_QUERY_PARAM,
    'accessToken',
  )
  return n || 'accessToken'
}

/**
 * OAuth 换票接口路径（拼在 `httpOauth` 后，不含前导 `/`）。
 * 默认 `accessToken`，即 `POST {httpOauth}/accessToken`。
 */
export function resolveOauthAccessTokenPath(): string {
  const cfg = useConfigStore.getState().config?.oauthAccessTokenPath
  const env = import.meta.env.VITE_OAUTH_ACCESS_TOKEN_PATH
  const raw = (typeof cfg === 'string' && cfg.trim() ? cfg : typeof env === 'string' ? env : 'accessToken').trim()
  const normalized = raw.replace(/^\/+/, '').replace(/\/+$/, '')
  if (!normalized || normalized.includes('..')) return 'accessToken'
  return normalized
}

/**
 * 写入带鉴权头的请求（覆盖同名头）。
 * TipDM `WorkFlowScheduler` 固定读取 **`request.getHeader("accessToken")`**，与 Socket 握手写入 Redis 的 key 一致；
 * 若仅发 `Authorization: Bearer …` 而无 `accessToken` 头，流程推送会找不到会话，画板节点不会高亮。
 */
export function applyApiAccessTokenHeader(headers: Headers, token: string): void {
  const name = resolveAccessTokenHeaderName()
  const prefix = resolveAccessTokenHeaderPrefix()
  headers.set(name, `${prefix}${token}`)
  if (name.trim().toLowerCase() !== 'accesstoken') {
    headers.set('accessToken', token)
  }
}
