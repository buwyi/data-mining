import { Navigate, useSearchParams } from 'react-router-dom'
import { buildShowPathWithPreservedShareQuery } from '../../utils/pickShareAccessToken'
import { pickPositiveProjectIdFromUrlSearchParams } from '../../utils/legacyProjectIdQuery'

/**
 * `/show?projectId=123` 等形态重定向到 `/show/123`（`ProjectShowPage`）。
 * 无合法正整数 id 时回首页。
 */
export function ProjectShowLegacyRedirect() {
  const [searchParams] = useSearchParams()
  const id = pickPositiveProjectIdFromUrlSearchParams(searchParams)
  if (id !== null) {
    const to = buildShowPathWithPreservedShareQuery(id, searchParams)
    return <Navigate to={to} replace />
  }

  return <Navigate to="/home/main" replace />
}
