/** 节点日志接口可能返回 HTML；仅保留安全子集用于展示 */

const ALLOWED_TAGS = new Set(['DIV', 'SPAN', 'BR', 'B', 'STRONG', 'I', 'EM', 'P', 'PRE'])

function escapeHtmlText(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** 仅允许常见排版与着色，拒绝 expression/url(javascript) 等 */
function sanitizeStyleAttr(style: string): string {
  const parts = style
    .split(';')
    .map((p) => p.trim())
    .filter(Boolean)
  const out: string[] = []
  const propRe =
    /^(color|text-align|font-family|font-size|line-height|white-space|margin|padding|background-color)\s*:\s*.+$/i
  for (const p of parts) {
    if (!propRe.test(p)) continue
    if (/expression|url\s*\(|behavior|javascript|import|@import/i.test(p)) continue
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

function stripAttrs(el: Element): void {
  for (const attr of Array.from(el.attributes)) {
    if (attr.name !== 'style') {
      el.removeAttribute(attr.name)
    } else {
      const safe = sanitizeStyleAttr(attr.value)
      if (safe) el.setAttribute('style', safe)
      else el.removeAttribute('style')
    }
  }
}

/**
 * 将后端返回的日志字符串转为可安全插入 DOM 的 HTML。
 * 非 HTML 形态则按纯文本换行展示。
 */
export function sanitizeNodeLogHtmlForDisplay(raw: string): string {
  const t = raw.trim()
  if (!t) return ''

  if (!/<[a-z][\s\S]*>/i.test(t)) {
    return `<pre class="node-log-plain" style="margin:0;white-space:pre-wrap;word-break:break-word;">${escapeHtmlText(t)}</pre>`
  }

  const doc = new DOMParser().parseFromString(`<div class="node-log-root">${t}</div>`, 'text/html')
  const root = doc.querySelector('.node-log-root')
  if (!root) {
    return `<pre class="node-log-plain" style="margin:0;white-space:pre-wrap;">${escapeHtmlText(t)}</pre>`
  }

  root.querySelectorAll('script, style, iframe, object, embed, link, meta').forEach((el) => el.remove())

  /** 反复剥离非白名单标签（自底向上：先处理深层） */
  let guard = 0
  while (guard++ < 200) {
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

  root.querySelectorAll('*').forEach((el) => stripAttrs(el))

  return root.innerHTML
}
