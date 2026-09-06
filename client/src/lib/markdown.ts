import { apiUrl } from './api'

import { marked } from 'marked'
import DOMPurify from 'dompurify'

marked.setOptions({ gfm: true, breaks: false })

/** Parsed value of a single YAML-ish scalar/array frontmatter field. */
export type FrontmatterValue = string | string[]

/**
 * Splits a leading `---\n...\n---` YAML block off a note's raw markdown.
 * Only a flat `key: value` shape is supported (strings, quoted strings, and
 * `[a, b, c]` arrays) — enough for Obsidian-style note properties. Anything
 * without a recognizable leading frontmatter fence is returned unchanged.
 */
export function parseFrontmatter(md: string): { data: Record<string, FrontmatterValue>; body: string } {
  const src = md ?? ''
  const fence = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n?/.exec(src)
  if (!fence) return { data: {}, body: src }
  const data: Record<string, FrontmatterValue> = {}
  for (const line of fence[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line)
    if (!kv) continue
    const raw = kv[2].trim()
    data[kv[1]] = raw.startsWith('[') && raw.endsWith(']')
      ? raw.slice(1, -1).split(',').map((s) => s.trim().replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1')).filter(Boolean)
      : raw.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1')
  }
  return { data, body: src.slice(fence[0].length) }
}

export function renderMarkdown(md: string): string {
  const { body } = parseFrontmatter(md ?? '')
  const raw = marked.parse(body, { async: false }) as string
  const sanitized = DOMPurify.sanitize(raw, {
    USE_PROFILES: { html: true, svg: true, svgFilters: true } as any,
    ADD_ATTR: ['target', 'viewBox', 'd', 'fill', 'stroke', 'stroke-width', 'cx', 'cy', 'r', 'x', 'y', 'width', 'height', 'transform', 'points'],
  })
  let html = sanitized.replace(/(src|href)="(\/api\/files\/[^"?#]+(?:[?#][^"]*)?)"/g, (_, attribute, path) => `${attribute}="${apiUrl(path)}"`)
  // wrap tables for horizontal scroll without breaking layout
  html = html.replace(/<table>/g, '<div class="table-wrap"><table>')
  html = html.replace(/<\/table>/g, '</table></div>')
  return html
}
