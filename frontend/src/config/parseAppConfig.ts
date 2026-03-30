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

  return {
    httpServer,
    httpOauth,
    httpClient,
    socketServer,
    socketPort,
    title,
    databaseUploadFileSize,
    mode,
  }
}
