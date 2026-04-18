const STORAGE_KEY = 'tipdm_browser_chromium_hint_dismissed'

/** 粗略判断是否为 Chromium 系（Chrome / Edge / Opera 等），用于与旧版「建议 Chrome」行为对齐 */
export function isLikelyChromiumBrowser(): boolean {
  if (typeof navigator === 'undefined') return true
  const ua = navigator.userAgent
  if (/Edg\//.test(ua) || /OPR\//.test(ua) || /Chromium\//.test(ua)) return true
  if (/Chrome\//.test(ua) || /CriOS\//.test(ua)) return true
  return false
}

export function readBrowserHintDismissed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function persistBrowserHintDismissed(): void {
  try {
    localStorage.setItem(STORAGE_KEY, '1')
  } catch {
    /* ignore */
  }
}
