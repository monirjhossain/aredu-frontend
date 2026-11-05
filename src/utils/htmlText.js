/** Strip tags for word counts / plain comparisons while keeping API body as HTML-capable text. */
export function stripHtml(value) {
  const raw = String(value || '')
  if (!raw) return ''
  if (typeof document !== 'undefined') {
    const node = document.createElement('div')
    node.innerHTML = raw
    return (node.textContent || node.innerText || '').replace(/\u00a0/g, ' ')
  }
  return raw.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ')
}

export function countWordsHtml(value) {
  const trimmed = stripHtml(value).trim().replace(/\s+/g, ' ')
  if (!trimmed) return 0
  return trimmed.split(/\s+/).filter(Boolean).length
}

const ALLOWED = new Set(['P', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'UL', 'OL', 'LI'])

export function sanitizeWritingHtml(value) {
  const raw = String(value || '')
  if (!raw) return ''
  if (typeof document === 'undefined') {
    return raw.replace(/<(?!\/?(?:p|br|strong|b|em|i|u|ul|ol|li)\b)[^>]*>/gi, '')
  }
  const root = document.createElement('div')
  root.innerHTML = raw
  const walk = (node) => {
    const children = Array.from(node.childNodes)
    for (const child of children) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        if (!ALLOWED.has(child.tagName)) {
          while (child.firstChild) node.insertBefore(child.firstChild, child)
          node.removeChild(child)
          continue
        }
        ;[...child.attributes].forEach((attr) => child.removeAttribute(attr.name))
        walk(child)
      }
    }
  }
  walk(root)
  return root.innerHTML
}
