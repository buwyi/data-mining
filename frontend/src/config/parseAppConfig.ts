import type { AppRuntimeConfig } from '../types/appConfig'

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

/**
 * 校验并归一化 `config.json`，字段缺失或类型错误时抛出明确错误。
 */
export function parseAppConfig(raw: unknown): AppRuntimeConfig {
  if (raw === null || typeof raw !== 'object') {
    throw new Error('配置文件格式无效：根节点应为 JSON 对象')
  }

  const o = raw as Record<string, unknown>
  const httpServer = o.httpServer
  const httpOauth = o.httpOauth
  const httpClient = o.httpClient
  const socketServer = o.socketServer
  const socketPort = o.socketPort
  const title = o.title
  const databaseUploadFileSize = o.databaseUploadFileSize
  const mode = o.mode

  if (!isNonEmptyString(httpServer)) throw new Error('缺少或无效字段: httpServer')
  if (!isNonEmptyString(httpOauth)) throw new Error('缺少或无效字段: httpOauth')
  if (!isNonEmptyString(httpClient)) throw new Error('缺少或无效字段: httpClient')
  if (!isNonEmptyString(socketServer)) throw new Error('缺少或无效字段: socketServer')
  if (!isFiniteNumber(socketPort)) throw new Error('缺少或无效字段: socketPort')
  if (!isNonEmptyString(title)) throw new Error('缺少或无效字段: title')
  if (!isFiniteNumber(databaseUploadFileSize) || databaseUploadFileSize <= 0) {
    throw new Error('缺少或无效字段: databaseUploadFileSize')
  }
  if (!isNonEmptyString(mode)) throw new Error('缺少或无效字段: mode')

  const componentSystemCatId = o.componentSystemCatId
  const componentPersonalCatId = o.componentPersonalCatId
  const oauthClientId = o.oauthClientId
  if (componentSystemCatId !== undefined && !isFiniteNumber(componentSystemCatId)) {
    throw new Error('无效字段: componentSystemCatId')
  }
  if (componentPersonalCatId !== undefined && !isFiniteNumber(componentPersonalCatId)) {
    throw new Error('无效字段: componentPersonalCatId')
  }
  if (oauthClientId !== undefined && !isNonEmptyString(oauthClientId)) {
    throw new Error('无效字段: oauthClientId')
  }

  const accessTokenStorageKey = o.accessTokenStorageKey
  const accessTokenHeaderName = o.accessTokenHeaderName
  const accessTokenHeaderPrefix = o.accessTokenHeaderPrefix
  const shareAccessTokenQueryParams = o.shareAccessTokenQueryParams
  const oauthAccessTokenPath = o.oauthAccessTokenPath
  const socketAccessTokenQueryParam = o.socketAccessTokenQueryParam
  const tipdmLogHome = o.tipdmLogHome

  if (accessTokenStorageKey !== undefined && !isNonEmptyString(accessTokenStorageKey)) {
    throw new Error('无效字段: accessTokenStorageKey')
  }
  if (accessTokenHeaderName !== undefined && !isNonEmptyString(accessTokenHeaderName)) {
    throw new Error('无效字段: accessTokenHeaderName')
  }
  if (accessTokenHeaderPrefix !== undefined && typeof accessTokenHeaderPrefix !== 'string') {
    throw new Error('无效字段: accessTokenHeaderPrefix')
  }
  if (shareAccessTokenQueryParams !== undefined) {
    if (!Array.isArray(shareAccessTokenQueryParams)) {
      throw new Error('无效字段: shareAccessTokenQueryParams（应为字符串数组）')
    }
    for (const item of shareAccessTokenQueryParams) {
      if (!isNonEmptyString(item)) {
        throw new Error('无效字段: shareAccessTokenQueryParams（元素须为非空字符串）')
      }
    }
  }
  if (oauthAccessTokenPath !== undefined) {
    if (!isNonEmptyString(oauthAccessTokenPath)) {
      throw new Error('无效字段: oauthAccessTokenPath')
    }
    const norm = oauthAccessTokenPath.trim().replace(/^\/+/, '')
    if (norm.includes('..')) {
      throw new Error('无效字段: oauthAccessTokenPath（不允许 ..）')
    }
  }
  if (socketAccessTokenQueryParam !== undefined && !isNonEmptyString(socketAccessTokenQueryParam)) {
    throw new Error('无效字段: socketAccessTokenQueryParam')
  }
  if (tipdmLogHome !== undefined && !isNonEmptyString(tipdmLogHome)) {
    throw new Error('无效字段: tipdmLogHome')
  }

  const themeRaw = o.theme
  let theme: AppRuntimeConfig['theme'] | undefined
  if (themeRaw !== undefined) {
    if (themeRaw === null || typeof themeRaw !== 'object' || Array.isArray(themeRaw)) {
      throw new Error('无效字段: theme（应为对象）')
    }
    const tm = themeRaw as Record<string, unknown>
    const next: NonNullable<AppRuntimeConfig['theme']> = {}
    if ('colorPrimary' in tm) {
      if (!isNonEmptyString(tm.colorPrimary)) {
        throw new Error('无效字段: theme.colorPrimary')
      }
      next.colorPrimary = tm.colorPrimary.trim()
    }
    if ('borderRadius' in tm) {
      const br = tm.borderRadius
      if (!isFiniteNumber(br) || br < 0 || br > 64) {
        throw new Error('无效字段: theme.borderRadius（应为 0–64 的数字）')
      }
      next.borderRadius = br
    }
    if (Object.keys(next).length > 0) theme = next
    else if (Object.keys(tm).length > 0) {
      throw new Error('无效字段: theme（含无法识别的键）')
    }
  }

  return {
    httpServer,
    httpOauth,
    httpClient,
    socketServer,
    socketPort,
    title,
    databaseUploadFileSize,
    mode,
    ...(componentSystemCatId !== undefined ? { componentSystemCatId } : {}),
    ...(componentPersonalCatId !== undefined ? { componentPersonalCatId } : {}),
    ...(oauthClientId !== undefined ? { oauthClientId } : {}),
    ...(accessTokenStorageKey !== undefined ? { accessTokenStorageKey } : {}),
    ...(accessTokenHeaderName !== undefined ? { accessTokenHeaderName } : {}),
    ...(accessTokenHeaderPrefix !== undefined ? { accessTokenHeaderPrefix } : {}),
    ...(shareAccessTokenQueryParams !== undefined ? { shareAccessTokenQueryParams } : {}),
    ...(oauthAccessTokenPath !== undefined ? { oauthAccessTokenPath } : {}),
    ...(socketAccessTokenQueryParam !== undefined ? { socketAccessTokenQueryParam } : {}),
    ...(tipdmLogHome !== undefined ? { tipdmLogHome: tipdmLogHome.trim() } : {}),
    ...(theme !== undefined ? { theme } : {}),
  }
}
