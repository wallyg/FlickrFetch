// Flickr descriptions are small bits of HTML (links, bold, italic, line breaks, lists).
// This turns that text into a plain tree we control, so the screen can draw it safely
// (never by pasting Flickr's HTML into the page) and the file writer can flatten it to plain text.

export type DescNode =
  | { t: 'text'; v: string }
  | { t: 'br' }
  | { t: 'el'; tag: 'a' | 'b' | 'i' | 'p' | 'ul' | 'li'; href?: string; children: DescNode[] }

type ElNode = Extract<DescNode, { t: 'el' }>

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—',
  hellip: '…', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', copy: '©'
}

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
      try { return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : m } catch { return m }
    }
    return NAMED_ENTITIES[e.toLowerCase()] ?? m
  })
}

// Only web addresses become links. Flickr sometimes writes site-relative links ("/photos/...").
function safeHref(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  const href = decodeEntities(raw).trim()
  if (/^https?:\/\//i.test(href)) return href
  if (href.startsWith('//')) return `https:${href}`
  if (href.startsWith('/')) return `https://www.flickr.com${href}`
  return undefined
}

const TAG_MAP: Record<string, 'a' | 'b' | 'i' | 'p' | 'ul' | 'li'> = {
  a: 'a', b: 'b', strong: 'b', i: 'i', em: 'i',
  p: 'p', div: 'p', blockquote: 'p', ul: 'ul', ol: 'ul', li: 'li'
}
const BLOCKS = new Set(['p', 'ul', 'li'])
const SKIP_CONTENT = new Set(['script', 'style'])

interface Open { name: string; node: ElNode | null; children: DescNode[] }

export function parseDescription(html: string): DescNode[] {
  const root: DescNode[] = []
  const stack: Open[] = [{ name: '', node: null, children: root }]
  const top = (): DescNode[] => stack[stack.length - 1].children
  const re = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>|[^<]+|</g
  let skipUntil: string | null = null
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    const whole = m[0]
    const closing = m[1]
    const rawName = m[2]
    const attrs = m[3] ?? ''
    if (!rawName) {
      if (skipUntil || whole.startsWith('<!--')) continue
      top().push({ t: 'text', v: decodeEntities(whole) })
      continue
    }
    const name = rawName.toLowerCase()
    if (skipUntil) { if (closing && name === skipUntil) skipUntil = null; continue }
    if (!closing && SKIP_CONTENT.has(name)) { skipUntil = name; continue }
    if (name === 'br') { if (!closing) top().push({ t: 'br' }); continue }
    const tag = TAG_MAP[name]
    if (!tag) continue   // unknown tag: drop the tag, keep what is inside it
    if (!closing) {
      const hrefMatch = /href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrs)
      const href = tag === 'a' ? safeHref(hrefMatch?.[1] ?? hrefMatch?.[2] ?? hrefMatch?.[3]) : undefined
      if (tag === 'a' && !href) { stack.push({ name, node: null, children: top() }); continue }   // unusable link: keep its text
      // A new list item or paragraph closes an unclosed one of the same kind
      if (tag === 'li' || tag === 'p') {
        const last = stack[stack.length - 1]
        if (last.node && last.node.tag === tag) stack.pop()
      }
      const el: ElNode = { t: 'el', tag, href, children: [] }
      top().push(el)
      stack.push({ name, node: el, children: el.children })
    } else {
      for (let i = stack.length - 1; i > 0; i--) {
        if (stack[i].name === name || (stack[i].node && TAG_MAP[stack[i].name] === tag && tag !== 'a')) { stack.length = i; break }
      }
    }
  }
  const out = tidy(root)
  trimEnds(out)
  return out
}

// Drop whitespace-only text sitting between block elements, so spacing comes from the layout
function tidy(nodes: DescNode[]): DescNode[] {
  const hasBlock = nodes.some(n => n.t === 'el' && BLOCKS.has(n.tag))
  const out: DescNode[] = []
  for (const n of nodes) {
    if (n.t === 'text' && hasBlock && n.v.trim() === '') continue
    if (n.t === 'el') {
      n.children = tidy(n.children)
      if (n.tag === 'li' || n.tag === 'p') trimEnds(n.children)
    }
    out.push(n)
  }
  return out
}

// Blank space at the very start and end of a list item or paragraph is not content
function trimEnds(children: DescNode[]): void {
  const first = children[0]
  if (first && first.t === 'text') first.v = first.v.replace(/^\s+/, '')
  const last = children[children.length - 1]
  if (last && last.t === 'text') last.v = last.v.replace(/\s+$/, '')
}

const stripScheme = (u: string): string => u.replace(/^https?:\/\//i, '').replace(/\/$/, '')

function inline(nodes: DescNode[]): string {
  return nodes.map(n => {
    if (n.t === 'text') return n.v.replace(/[ \t ]+/g, ' ')
    if (n.t === 'br') return '\n'
    const inner = inline(n.children)
    switch (n.tag) {
      case 'a': {
        if (!n.href) return inner
        const label = inner.trim()
        return label === '' || stripScheme(label) === stripScheme(n.href) ? n.href : `${inner} (${n.href})`
      }
      case 'li': return `- ${inner.trim()}\n`
      case 'ul': return `\n${inner}\n`
      case 'p': return `${inner.trim()}\n\n`
      default: return inner
    }
  }).join('')
}

// Plain-text version for files and the clipboard: line breaks kept, list items as "- item",
// links as "text (address)".
export function descriptionToPlainText(html: string): string {
  if (!html) return ''
  return inline(parseDescription(html))
    .replace(/\r\n?/g, '\n')
    .replace(/ {2,}/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
