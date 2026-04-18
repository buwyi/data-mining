/**
 * 侧栏路由与 `GET /token/info` → `permissions` 的对应关系。
 * 与 TipDM Vue `frontend/src/store/modules/global.js` → `navMenu[].permission` 一致：
 * `main:menu`、`datasource:menu`、`project:menu`、**`components:menu`**（注意为复数 components）。
 */
export const SIDEBAR_MENU_PERMISSION: Record<string, string | undefined> = {
  '/home/main': 'main:menu',
  '/home/datasource': 'datasource:menu',
  '/home/project': 'project:menu',
  '/home/components': 'components:menu',
}

/** 与规范权限等价、历史上可能出现的别名字符串（任一命中即视为有权限） */
const MENU_PERMISSION_ALIASES: Record<string, readonly string[]> = {
  'components:menu': ['component:menu'],
}

function expandRequiredPermissions(required: string): string[] {
  const extra = MENU_PERMISSION_ALIASES[required]
  if (extra === undefined) return [required]
  return [required, ...extra]
}

const SORTED_PREFIXES = Object.keys(SIDEBAR_MENU_PERMISSION).sort((a, b) => b.length - a.length)

/** 当前路径所需的菜单权限；未配置的前缀视为无需校验 */
export function getSidebarPermissionForPath(pathname: string): string | undefined {
  for (const prefix of SORTED_PREFIXES) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      return SIDEBAR_MENU_PERMISSION[prefix]
    }
  }
  return undefined
}

/**
 * - 未要求权限的路由始终允许。
 * - `permissions.length === 0` 时视为后端未下发菜单级控制，允许访问（与侧栏「全开」一致）。
 * - 支持通配 `*` 表示超级权限。
 */
export function isPermissionGranted(required: string | undefined, permissions: string[]): boolean {
  if (required === undefined) return true
  if (permissions.length === 0) return true
  if (permissions.includes('*')) return true
  return expandRequiredPermissions(required).some((p) => permissions.includes(p))
}

export function isSidebarPathAllowed(pathname: string, permissions: string[]): boolean {
  return isPermissionGranted(getSidebarPermissionForPath(pathname), permissions)
}
