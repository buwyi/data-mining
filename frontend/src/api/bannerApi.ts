import type { ApiResult } from '../types/apiResult'
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

/** 将后端 `LinkedHashMap<String,String>` 等转为可渲染的标题→链接 */
export function coerceBannerLinkMap(data: unknown): Record<string, string> {
  if (data == null || typeof data !== 'object' || Array.isArray(data)) return {}
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
    if (typeof v === 'string' && v.trim()) out[k] = v
    else if (v != null && typeof v !== 'object') out[k] = String(v).trim()
  }
  return out
}

/** 判断 Banner 的链接值是否像图片地址（用于首页轮播以图为主展示） */
export function isProbableBannerImageUrl(url: string): boolean {
  const u = url.trim()
  if (!u) return false
  const lower = u.split(/[?#]/)[0]?.toLowerCase() ?? ''
  return /\.(png|jpe?g|gif|webp|bmp|svg)$/.test(lower)
}

/** `GET /api/banner/bbs/` */
export async function fetchBannerBbs(): Promise<Record<string, string>> {
  const res = await apiFetch('/api/banner/bbs/')
  if (!res.ok) {
    throw new Error(`加载社区 Banner 失败：${res.status} ${res.statusText}`)
  }
  const raw = await readApiResult<unknown>(res)
  return coerceBannerLinkMap(raw)
}

/** `GET /api/banner/documentation/` */
export async function fetchBannerDocumentation(): Promise<Record<string, string>> {
  const res = await apiFetch('/api/banner/documentation/')
  if (!res.ok) {
    throw new Error(`加载文档 Banner 失败：${res.status} ${res.statusText}`)
  }
  const raw = await readApiResult<unknown>(res)
  return coerceBannerLinkMap(raw)
}
