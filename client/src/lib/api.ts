const BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

export function apiUrl(path: string): string {
  return path.startsWith('/') && BASE ? `${BASE}${path}` : path;
}

async function req<T>(url: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(BASE + url, {
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts,
  });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const j = await res.json();
      msg = j.error || msg;
    } catch {
      try { msg = await res.text(); } catch {}
    }
    throw new Error(msg || `Request failed ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return (await res.json()) as T;
  return (await res.text()) as unknown as T;
}

// ---- Types ----
export type FolderDto = { id: string; name: string; parentId: string | null; createdAt: string };
export type NoteDto = { id: string; title: string; folderId: string | null; content: string; createdAt: string; updatedAt: string };
export type AttachmentDto = {
  id: string;
  fileName: string;
  contentType: string;
  size: number;
  folderId: string | null;
  noteId: string | null;
  createdAt: string;
  url: string;
  path: string;
};
export type TreeNodeDto = {
  id: string;
  name: string;
  kind: 'folder' | 'note' | 'asset';
  parentId: string | null;
  createdAt?: string;
  children?: TreeNodeDto[];
};
export type SearchResultDto = {
  id: string;
  title: string;
  folderId: string | null;
  content?: string;
  updatedAt?: string;
  snippet?: string;
  name?: string;
  kind?: string;
};
export type ReadingBucketDto = { startUtc: string; endUtc: string; seconds: number };
export type ReadingSummaryDto = { range: string; totalSeconds: number; buckets: ReadingBucketDto[] };
export type NoteReadingStatDto = {
  noteId: string;
  title: string;
  folderId: string | null;
  path: string;
  totalSeconds: number;
  sessionCount: number;
  lastReadAt: string;
  active: boolean;
};
export type ReadingRange = 'today' | '7d' | '30d' | '1y' | 'all';

// ---- Folders ----
export const folderApi = {
  tree: () => req<TreeNodeDto[]>('/api/folders/tree'),
  list: () => req<FolderDto[]>('/api/folders'),
  create: (name: string, parentId: string | null) =>
    req<FolderDto>('/api/folders', { method: 'POST', body: JSON.stringify({ name, parentId }) }),
  rename: (id: string, name: string) =>
    req<FolderDto>(`/api/folders/${id}`, { method: 'PUT', body: JSON.stringify({ name }) }),
  remove: (id: string) => req<void>(`/api/folders/${id}`, { method: 'DELETE' }),
  move: (id: string, targetParentId: string | null) =>
    req<FolderDto>(`/api/folders/${id}/move`, { method: 'PUT', body: JSON.stringify({ targetParentId }) }),
};

// ---- Notes ----
export const noteApi = {
  list: (folderId?: string | null) => {
    const q = folderId && folderId !== 'root' ? `?folderId=${encodeURIComponent(folderId)}` : '';
    return req<NoteDto[]>(`/api/notes${q}`);
  },
  get: (id: string) => req<NoteDto>(`/api/notes/${id}`),
  create: (title: string, folderId: string | null, content = '') =>
    req<NoteDto>('/api/notes', { method: 'POST', body: JSON.stringify({ title, folderId, content }) }),
  update: (id: string, patch: { title?: string; content?: string }) =>
    req<NoteDto>(`/api/notes/${id}`, { method: 'PUT', body: JSON.stringify(patch) }),
  remove: (id: string) => req<void>(`/api/notes/${id}`, { method: 'DELETE' }),
  move: (id: string, targetFolderId: string | null) =>
    req<NoteDto>(`/api/notes/${id}/move`, { method: 'PUT', body: JSON.stringify({ targetFolderId }) }),
  duplicate: (id: string) => req<NoteDto>(`/api/notes/${id}/duplicate`, { method: 'POST' }),
};

// ---- Files / Attachments ----
function proxyAttachmentUrl(path: string): string {
  return apiUrl(path);
}

function proxyAttachment(attachment: AttachmentDto): AttachmentDto {
  const path = `/api/files/${attachment.id}`;
  return { ...attachment, url: proxyAttachmentUrl(path), path };
}

export const fileApi = {
  list: async () => (await req<AttachmentDto[]>('/api/attachments')).map(proxyAttachment),
  listByNote: async (noteId: string) => (await req<AttachmentDto[]>(`/api/notes/${noteId}/files`)).map(proxyAttachment),
  upload: async (file: File, noteId?: string | null, folderId?: string | null) => {
    const fd = new FormData();
    fd.append('file', file);
    if (noteId) fd.append('noteId', noteId);
    if (folderId) fd.append('folderId', folderId || '');
    const res = await fetch(BASE + '/api/files', { method: 'POST', body: fd });
    if (!res.ok) {
      let msg = res.statusText;
      try { const j = await res.json(); msg = j.error || msg; } catch {}
      throw new Error(msg);
    }
    return proxyAttachment(await res.json() as AttachmentDto);
  },
  // for pasted SVG text or dataUrl, convert to File before calling upload
  uploadBlob: async (blob: Blob, fileName: string, noteId?: string | null, folderId?: string | null) => {
    const f = new File([blob], fileName, { type: blob.type || 'application/octet-stream' });
    return fileApi.upload(f, noteId, folderId);
  },
  move: (id: string, targetFolderId: string | null) =>
    req<AttachmentDto>(`/api/files/${id}/move`, { method: 'PUT', body: JSON.stringify({ targetFolderId }) }),
  remove: (id: string) => req<void>(`/api/files/${id}`, { method: 'DELETE' }),
  meta: async (id: string) => proxyAttachment(await req<AttachmentDto>(`/api/files/${id}/meta`)),
};

// ---- Search ----
export const searchApi = {
  search: (q: string, limit = 20) => req<SearchResultDto[]>(`/api/search?q=${encodeURIComponent(q)}&limit=${limit}`),
  palette: (q: string) => req<SearchResultDto[]>(`/api/palette?q=${encodeURIComponent(q)}`),
};

// ---- Reading time tracking ----

export const readingApi = {
  start: (noteId: string) =>
    req<{ id: string; noteId: string; startedAt: string }>('/api/reading/sessions/start', {
      method: 'POST',
      body: JSON.stringify({ noteId }),
    }),
  heartbeat: (sessionId: string) =>
    req<{ id: string; durationSeconds: number }>(`/api/reading/sessions/${sessionId}/heartbeat`, { method: 'POST' }),
  end: (sessionId: string) =>
    req<{ id: string; durationSeconds: number }>(`/api/reading/sessions/${sessionId}/end`, { method: 'POST' }),
  // Fire-and-forget close that survives page unload (fetch keepalive would still get
  // cancelled by some browsers; sendBeacon is the documented way to do this).
  endBeacon: (sessionId: string) => {
    try {
      navigator.sendBeacon(apiUrl(`/api/reading/sessions/${sessionId}/end`));
    } catch {
      // best effort only — the server reaps stale sessions on the next start anyway
    }
  },
  summary: (range: ReadingRange) => {
    let tz = 'UTC';
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { /* fall back to UTC */ }
    return req<ReadingSummaryDto>(`/api/reading/summary?range=${range}&tz=${encodeURIComponent(tz)}`);
  },
  notes: () => req<NoteReadingStatDto[]>('/api/reading/notes'),
};
