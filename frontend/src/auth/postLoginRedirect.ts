const KEY = 'tipdm_post_login_redirect'

export function setPostLoginRedirect(pathname: string): void {
  try {
    sessionStorage.setItem(KEY, pathname.startsWith('/') ? pathname : `/${pathname}`)
  } catch {
    /* ignore */
  }
}

export function consumePostLoginRedirect(): string {
  try {
    const v = sessionStorage.getItem(KEY)
    sessionStorage.removeItem(KEY)
    if (v && v.startsWith('/')) return v
  } catch {
    /* ignore */
  }
  return '/home/main'
}
