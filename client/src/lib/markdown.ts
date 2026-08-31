import { apiUrl } from './api'

import { marked } from 'marked'
import DOMPurify from 'dompurify'

marked.setOptions({ gfm: true, breaks: false })

export function renderMarkdown(md: string): string {
  const raw = marked.parse(md ?? '', { async: false }) as string
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
