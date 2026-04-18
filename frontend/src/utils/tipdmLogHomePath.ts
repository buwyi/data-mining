import type { AppRuntimeConfig } from '../types/appConfig'
import { tipdmClientIdForNodeFilesystemApis } from './tipdmNodePathId'

function trimTrailingSlashes(dir: string): string {
  return dir.replace(/\/+$/, '')
}

/**
 * TipDM 节点日志在服务端磁盘上的约定路径：`{LOG_HOME}/{clientId}.log`（见 TipDM `system.properties` 的 `LOG_HOME`）。
 * 前端仅作展示与排错提示；实际内容仍由 `GET /api/project/node/{id}/log` 返回。
 */
export function resolveTipdmLogHome(config: AppRuntimeConfig | null): string | undefined {
  const fromConfig = config?.tipdmLogHome?.trim()
  if (fromConfig) return trimTrailingSlashes(fromConfig)
  const fromEnv = import.meta.env.VITE_TIPDM_LOG_HOME?.trim()
  if (fromEnv) return trimTrailingSlashes(fromEnv)
  return undefined
}

export function formatTipdmNodeLogFilePath(logHome: string, nodeIdForApi: string): string {
  const base = trimTrailingSlashes(logHome.trim())
  const id = tipdmClientIdForNodeFilesystemApis(nodeIdForApi)
  return `${base}/${id}.log`
}
