import { getShareAccessTokenQueryParamNames } from '../config/accessTokenRuntime'

export function pickShareAccessToken(params: URLSearchParams): string | undefined {
  for (const k of getShareAccessTokenQueryParamNames()) {
    const v = params.get(k)?.trim()
    if (v) return v
  }
  return undefined
}

/** 重定向到 `/show/:id` 时保留首个有效的分享参数名与值 */
export function buildShowPathWithPreservedShareQuery(
  projectId: number,
  params: URLSearchParams,
): string {
  for (const k of getShareAccessTokenQueryParamNames()) {
    const v = params.get(k)?.trim()
    if (v) {
      const q = new URLSearchParams({ [k]: v })
      return `/show/${projectId}?${q.toString()}`
    }
  }
  return `/show/${projectId}`
}
