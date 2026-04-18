/**
 * 节点「报告」接口可能返回完整/片段 HTML。比日志白名单更宽，保留表格与常用内联样式，
 * 避免在侧栏展示时出现表格线、对齐、背景等「样式丢失」观感。
 * 仍移除脚本、事件处理器与危险 URL。
 */

const ALLOWED_TAGS = new Set([
  'DIV',
  'SPAN',
  'BR',
  'B',
  'STRONG',
  'I',
  'EM',
  'U',
  'P',
  'PRE',
  'CODE',
  'TABLE',
  'CAPTION',
  'THEAD',
  'TBODY',
  'TFOOT',
  'TR',
  'TH',
  'TD',
  'COL',
  'COLGROUP',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'UL',
  'OL',
  'LI',
  'HR',
  'BLOCKQUOTE',
  'A',
  'IMG',
  'FONT',
  'CENTER',
  'SECTION',
  'ARTICLE',
  'MAIN',
  'HEADER',
  'FOOTER',
  'NAV',
  'ASIDE',
  'LINK',
])

function escapeHtmlText(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** 比日志更宽：含表格布局、边框、flex 等常见报告样式 */
function sanitizeStyleAttr(style: string): string {
  const parts = style
    .split(';')
    .map((p) => p.trim())
    .filter(Boolean)
  const out: string[] = []
  const propRe =
    /^(color|background|background-color|border|border-[\w-]+|padding|margin|width|max-width|min-width|height|max-height|min-height|font-family|font-size|font-weight|line-height|text-align|vertical-align|white-space|word-break|overflow|display|flex[\w-]*|justify-content|align-items|position|top|left|right|bottom|z-index|opacity|box-shadow|border-collapse|border-spacing|table-layout|clear|float|list-style|gap|grid[\w-]*)\s*:\s*.+$/i
  for (const p of parts) {
    if (!propRe.test(p)) continue
    if (/expression|url\s*\(\s*['"]?\s*javascript|behavior|@import|javascript\s*:/i.test(p)) continue
    out.push(p)
  }
  return out.join('; ')
}

function unwrapElement(el: Element, parent: Node): void {
  while (el.firstChild) {
    parent.insertBefore(el.firstChild, el)
  }
  parent.removeChild(el)
}

function safeHref(href: string): string | null {
  const t = href.trim()
  if (!t) return null
  if (/^https?:\/\//i.test(t)) return t
  if (t.startsWith('/') && !t.startsWith('//')) return t
  if (t.startsWith('mailto:') && t.length < 500) return t
  return null
}

function safeImgSrc(src: string): string | null {
  const t = src.trim()
  if (!t) return null
  if (/^https?:\/\//i.test(t)) return t
  if (t.startsWith('/') && !t.startsWith('//')) return t
  if (/^data:image\/(png|jpeg|jpg|gif|webp);base64,/i.test(t) && t.length < 2_000_000) return t
  return null
}

function stripReportAttrs(el: Element): void {
  const tag = el.tagName
  const keep = new Map<string, (v: string) => string | null>()

  if (tag === 'A') {
    keep.set('href', (v) => safeHref(v))
  } else if (tag === 'IMG') {
    keep.set('src', (v) => safeImgSrc(v))
    keep.set('alt', (v) => (v.length > 2000 ? v.slice(0, 2000) : v))
    keep.set('title', (v) => (v.length > 500 ? v.slice(0, 500) : v))
    keep.set('width', (v) => (/^[\d.%\s]+$/.test(v.trim()) ? v.trim() : null))
    keep.set('height', (v) => (/^[\d.%\s]+$/.test(v.trim()) ? v.trim() : null))
  } else if (tag === 'TD' || tag === 'TH') {
    keep.set('colspan', (v) => (/^\d+$/.test(v.trim()) ? v.trim() : null))
    keep.set('rowspan', (v) => (/^\d+$/.test(v.trim()) ? v.trim() : null))
    keep.set('width', (v) => (/^[\d.%\s]+$/.test(v.trim()) ? v.trim() : null))
    keep.set('height', (v) => (/^[\d.%\s]+$/.test(v.trim()) ? v.trim() : null))
    keep.set('align', (v) => (/^(left|right|center|justify)$/i.test(v.trim()) ? v.trim().toLowerCase() : null))
    keep.set('valign', (v) => (/^(top|middle|bottom|baseline)$/i.test(v.trim()) ? v.trim().toLowerCase() : null))
  } else if (tag === 'TABLE') {
    keep.set('width', (v) => (/^[\d.%\s]+$/.test(v.trim()) ? v.trim() : null))
    keep.set('border', (v) => (/^\d+$/.test(v.trim()) ? v.trim() : null))
    keep.set('cellpadding', (v) => (/^\d+$/.test(v.trim()) ? v.trim() : null))
    keep.set('cellspacing', (v) => (/^\d+$/.test(v.trim()) ? v.trim() : null))
    keep.set('align', (v) => (/^(left|right|center)$/i.test(v.trim()) ? v.trim().toLowerCase() : null))
  } else if (tag === 'COL' || tag === 'COLGROUP') {
    keep.set('width', (v) => (/^[\d.%\s]+$/.test(v.trim()) ? v.trim() : null))
    keep.set('span', (v) => (/^\d+$/.test(v.trim()) ? v.trim() : null))
  } else if (tag === 'LINK') {
    keep.set('rel', (v) => (/\bstylesheet\b/i.test(v) ? v.trim() : null))
    keep.set('href', (v) => safeHref(v))
    keep.set('type', (v) => (/^text\/css/i.test(v.trim()) ? v.trim() : null))
  }

  const attrs = Array.from(el.attributes)
  for (const attr of attrs) {
    const n = attr.name.toLowerCase()
    if (n.startsWith('on')) {
      el.removeAttribute(attr.name)
      continue
    }
    if (n === 'style') {
      const safe = sanitizeStyleAttr(attr.value)
      if (safe) el.setAttribute('style', safe)
      else el.removeAttribute('style')
      continue
    }
    if (n === 'class') {
      const c = attr.value.trim()
      if (c && /^[\w\-\s\u4e00-\u9fff]{1,400}$/.test(c)) {
        el.setAttribute('class', c)
      } else {
        el.removeAttribute('class')
      }
      continue
    }
    const fn = keep.get(n)
    if (fn) {
      const v = fn(attr.value)
      if (v !== null) el.setAttribute(n, v)
      else el.removeAttribute(attr.name)
    } else {
      el.removeAttribute(attr.name)
    }
  }
}

/**
 * 判断接口返回的字符串是否应按「内联 HTML」展示（而非当作 iframe URL）。
 * 若以 `http(s)://` 或单独一段 `/path`（无标签）开头则仍走 URL / iframe。
 */
export function shouldRenderNodeResultAsInlineHtml(raw: string): boolean {
  const t = raw.trim()
  if (!t) return false
  if (/^https?:\/\//i.test(t)) return false
  if (t.startsWith('/') && !/[<>]/.test(t)) return false
  if (!t.startsWith('<')) return false
  const head = t.slice(0, 400).toLowerCase()
  if (head.startsWith('<!doctype') || head.startsWith('<html')) return true
  if (/<table\b/i.test(t)) return true
  if (/<\/(table|thead|tbody|tfoot|tr|td|th|div|p|span|ul|ol|section)\b/i.test(t)) return true
  if (/<(div|p|span|table|thead|tbody|tr|td|th|ul|ol|section|article|main)\b/i.test(t.slice(0, 800))) return true
  return false
}

export type SanitizeNodeReportHtmlOptions = {
  /** 将 `<link href="/foo.css">` 转为可加载的绝对地址（与 `apiFetch` 同源） */
  stylesheetBase?: string
}

/**
 * 将后端返回的报告 HTML 转为可安全插入页面的片段（根节点内联样式兜底表格展示）。
 */
export function sanitizeNodeReportHtmlForDisplay(
  raw: string,
  options?: SanitizeNodeReportHtmlOptions,
): string {
  const t = raw.trim()
  if (!t) return ''

  if (!/<[a-z][\s\S]*>/i.test(t)) {
    return `<pre class="node-report-plain" style="margin:0;white-space:pre-wrap;word-break:break-word;">${escapeHtmlText(t)}</pre>`
  }

  const doc = new DOMParser().parseFromString(`<div class="node-report-root">${t}</div>`, 'text/html')
  const root = doc.querySelector('.node-report-root')
  if (!root) {
    return `<pre class="node-report-plain" style="margin:0;white-space:pre-wrap;">${escapeHtmlText(t)}</pre>`
  }

  const base = options?.stylesheetBase?.trim().replace(/\/$/, '') ?? ''
  if (base) {
    root.querySelectorAll('link').forEach((el) => {
      const rel = el.getAttribute('rel')?.toLowerCase() ?? ''
      const href = el.getAttribute('href')?.trim() ?? ''
      if (!rel.includes('stylesheet') || !href) return
      if (href.startsWith('/') && !href.startsWith('//')) {
        el.setAttribute('href', `${base}${href}`)
      }
    })
  }

  root.querySelectorAll('script, iframe, object, embed, meta, base, form, input, button, select, textarea').forEach((el) => el.remove())
  root.querySelectorAll('link').forEach((el) => {
    const rel = el.getAttribute('rel')?.toLowerCase() ?? ''
    const href = el.getAttribute('href')?.trim() ?? ''
    if (!rel.includes('stylesheet') || !href) el.remove()
  })

  let guard = 0
  while (guard++ < 400) {
    const all = root.querySelectorAll('*')
    let found: Element | undefined
    for (let i = all.length - 1; i >= 0; i--) {
      const el = all[i]!
      if (!ALLOWED_TAGS.has(el.tagName)) {
        found = el
        break
      }
    }
    if (!found) break
    const p = found.parentNode
    if (p) unwrapElement(found, p)
  }

  root.querySelectorAll('*').forEach((el) => stripReportAttrs(el))

  root.querySelectorAll('link').forEach((el) => {
    const rel = el.getAttribute('rel')?.toLowerCase() ?? ''
    const href = el.getAttribute('href')?.trim() ?? ''
    if (!rel.includes('stylesheet') || !href) el.remove()
  })

  const inner = root.innerHTML
  return `<div class="node-report-sanitized" style="font-size:13px;line-height:1.55;color:rgba(0,0,0,0.88);">${inner}</div>`
}
