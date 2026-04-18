/** 与旧版书签/外链可能使用的工程 id query 名（按顺序取首个合法正整数） */
export const LEGACY_PROJECT_ID_QUERY_KEYS = ['projectId', 'id', 'documentId', 'docId'] as const

export function pickPositiveProjectIdFromUrlSearchParams(params: URLSearchParams): number | null {
  for (const key of LEGACY_PROJECT_ID_QUERY_KEYS) {
    const raw = params.get(key)
    if (!raw) continue
    const n = Number.parseInt(String(raw).trim(), 10)
    if (Number.isFinite(n) && n > 0) return n
  }
  return null
}

/** `location.search` 形态，如 `?projectId=12&foo=1` */
export function pickPositiveProjectIdFromSearchString(search: string): number | null {
  const q = search.startsWith('?') ? search.slice(1) : search
  if (!q.trim()) return null
  return pickPositiveProjectIdFromUrlSearchParams(new URLSearchParams(q))
}
