import type { ApiResult } from '../types/apiResult'
import { OUTPUT_NUMERIC_DATASOURCE_RE } from '../utils/flowNodeContextHelpers'
import { formatTipdmNodeLogFilePath } from '../utils/tipdmLogHomePath'
import { tipdmClientIdForNodeFilesystemApis } from '../utils/tipdmNodePathId'
import { fetchDatasourcePreview } from './datasourceApi'
import { apiFetch } from './httpClient'

async function readApiResult<T>(res: Response): Promise<T> {
  let json: unknown
  try {
    json = await res.json()
  } catch {
    throw new Error(`接口返回非 JSON（HTTP ${res.status}）`)
  }
  const wrapped = json as ApiResult<T>
  if (wrapped.status === 'FAIL') {
    throw new Error(wrapped.message ?? '请求失败')
  }
  if (wrapped.status !== 'SUCCESS') {
    throw new Error('未知响应状态')
  }
  return wrapped.data as T
}

function asStringData(data: unknown): string {
  if (data === undefined || data === null) return ''
  if (typeof data === 'string') return data
  return String(data)
}

/** 匹配 Apache Commons / JDK 常见的「日志文件不存在」文案（TipDM 读 `LOG_HOME/{clientId}.log` 未捕获异常时） */
const TIPDM_MISSING_LOG_FILE_RE = /^File '(.+)' does not exist\.?$/i

async function readHttpErrorHint(res: Response): Promise<string> {
  const text = await res.text().catch(() => '')
  const trimmed = text.trim()
  if (!trimmed) return ''
  try {
    const j = JSON.parse(trimmed) as { message?: string }
    if (typeof j.message === 'string' && j.message.trim()) return j.message.trim()
  } catch {
    if (trimmed.length < 500 && !trimmed.startsWith('<')) return trimmed
  }
  return ''
}

/** `GET /api/project/node/{id}/result` → 报告 URL（常为字符串） */
export async function fetchProjectNodeResult(nodeId: string): Promise<string> {
  const idSeg = tipdmClientIdForNodeFilesystemApis(nodeId)
  const res = await apiFetch(`/api/project/node/${encodeURIComponent(idSeg)}/result`)
  if (!res.ok) {
    const hint = await readHttpErrorHint(res)
    throw new Error(hint || `获取报告地址失败：${res.status} ${res.statusText}`)
  }
  const data = await readApiResult<unknown>(res)
  return asStringData(data)
}

export type FetchProjectNodeLogOptions = {
  /** 与 TipDM `system.properties` 的 `LOG_HOME` 一致，用于失败时提示预期 `{LOG_HOME}/{clientId}.log` */
  tipdmLogHome?: string
}

/**
 * `GET /api/project/node/{id}/log` → 日志文本。
 * 后端按 `LOG_HOME/{id}.log` 读文件且未捕获 IOException，无文件时常为 **HTTP 500**。
 */
export async function fetchProjectNodeLog(
  nodeId: string,
  options?: FetchProjectNodeLogOptions,
): Promise<string> {
  const idSeg = tipdmClientIdForNodeFilesystemApis(nodeId)
  const res = await apiFetch(`/api/project/node/${encodeURIComponent(idSeg)}/log`)
  if (!res.ok) {
    const hint = await readHttpErrorHint(res)
    let fileHint = ''
    const home = options?.tipdmLogHome?.trim()
    if (home) {
      try {
        fileHint = formatTipdmNodeLogFilePath(home, nodeId)
      } catch {
        /* ignore */
      }
    }
    if (res.status === 500) {
      const defaultBase =
        '加载节点日志失败（HTTP 500）。常见原因：尚未成功运行过该节点、服务端 LOG_HOME 下无对应 .log 文件、或日志目录未配置。可先执行该节点后再试；若仍失败请核对服务端 system.properties 的 LOG_HOME 与前端 config 中的 tipdmLogHome 是否一致。'
      const base = hint || defaultBase
      const missing = hint ? TIPDM_MISSING_LOG_FILE_RE.exec(hint.trim()) : null
      const serverPath = missing?.[1]?.trim()
      const explain = serverPath
        ? ` 说明：上述路径由当前 API 进程的 LOG_HOME 与节点 clientId 拼接；文件不存在通常表示该节点尚未在本机成功写出日志，或任务在其它机器/容器写入导致与 API 不同盘。`
        : ''
      let suffix = ''
      if (fileHint) {
        if (!serverPath || fileHint !== serverPath) {
          suffix = ` 与 tipdmLogHome 一致时的完整路径：${fileHint}`
        }
      } else if (!hint) {
        suffix = ''
      }
      throw new Error(base + explain + suffix)
    }
    throw new Error(hint || `获取日志失败：${res.status} ${res.statusText}`)
  }
  const data = await readApiResult<unknown>(res)
  return asStringData(data)
}

/** `GET /api/project/{projectId}/{nodeId}/viewsource` */
export async function fetchProjectNodeViewSource(
  projectId: number,
  nodeId: string,
): Promise<string> {
  const res = await apiFetch(
    `/api/project/${projectId}/${encodeURIComponent(nodeId)}/viewsource`,
  )
  if (!res.ok) {
    throw new Error(`获取源码失败：${res.status} ${res.statusText}`)
  }
  const data = await readApiResult<unknown>(res)
  return asStringData(data)
}

/**
 * PostgreSQL：`ERROR: relation "schema.table" does not exist`（TipDM 临时输出表尚未创建时常出现）。
 */
function humanizeOutputDataRelationMissing(hint: string, outputId: string): string | null {
  const h = hint.trim()
  if (!h) return null
  const lower = h.toLowerCase()
  const en = lower.includes('does not exist') && lower.includes('relation')
  const zh = /不存在/.test(h) && (/relation/i.test(h) || h.includes('关系'))
  if (!en && !zh) return null
  return `无法加载输出数据：输出「${outputId}」对应的结果表尚未创建（数据库提示 relation 不存在）。请先在本工程成功运行该节点以生成中间表；若已运行过，可能是临时表已过期被清理，或执行用户（如 admin）与当前库不一致。原始信息：${h.slice(0, 280)}${h.length > 280 ? '…' : ''}`
}

/**
 * `GET /api/project/{projectId}/{outputId}/data` 或（当 outputId 为正整数时）`GET /api/datasource/{id}/preview`。
 * 后者对应 TipDM `DataTableServiceImpl.findDataByOutputId` 的 `NumberUtils.isDigits` 分支。
 */
export async function fetchProjectNodeOutputData(
  projectId: number,
  outputId: string,
  pageNumber = 1,
  pageSize = 100,
): Promise<unknown> {
  const id = outputId.trim()
  if (OUTPUT_NUMERIC_DATASOURCE_RE.test(id)) {
    const paged = await fetchDatasourcePreview(id, pageNumber, pageSize)
    return {
      content: paged.rows,
      totalElements: paged.total,
      size: pageSize,
      number: pageNumber,
    }
  }
  const q = new URLSearchParams({
    pageNumber: String(pageNumber),
    pageSize: String(pageSize),
  })
  const res = await apiFetch(
    `/api/project/${projectId}/${encodeURIComponent(id)}/data?${q.toString()}`,
  )
  if (!res.ok) {
    const hint = await readHttpErrorHint(res)
    if (res.status === 500) {
      const pg = humanizeOutputDataRelationMissing(hint, id)
      throw new Error(
        pg ||
          hint ||
          `获取输出数据失败（HTTP 500）。常见原因：该输出对应的临时表尚未生成（请先成功运行该节点）、或数据库中不存在名「${id}」的输出表。详情见服务端日志。`,
      )
    }
    throw new Error(hint || `获取输出数据失败：${res.status} ${res.statusText}`)
  }
  return readApiResult<unknown>(res)
}

/** `GET /api/project/{projectId}/node/{outId}/visual` → 可视化资源地址 */
export async function fetchProjectNodeVisual(
  projectId: number,
  outId: string,
): Promise<string> {
  const res = await apiFetch(
    `/api/project/${projectId}/node/${encodeURIComponent(outId)}/visual`,
  )
  if (!res.ok) {
    throw new Error(`获取可视化地址失败：${res.status} ${res.statusText}`)
  }
  const data = await readApiResult<unknown>(res)
  return asStringData(data)
}
