import { apiUrl } from './api'

import { marked } from 'marked'
import DOMPurify from 'dompurify'

marked.setOptions({ gfm: true, breaks: false })

export function renderMarkdown(md: string): string {
  const raw = marked.parse(md ?? '', { async: false }) as string
  const sanitized = DOMPurify.sanitize(raw, { ADD_ATTR: ['target'] })
  return sanitized.replace(/(src|href)="(\/api\/files\/[^"?#]+(?:[?#][^"]*)?)"/g, (_, attribute, path) => `${attribute}="${apiUrl(path)}"`)
}
