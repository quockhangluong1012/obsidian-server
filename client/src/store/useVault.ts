import { create } from 'zustand'
import { TREE, type TreeNode, MD } from '../mock/data'
import { folderApi, noteApi, fileApi, searchApi, type TreeNodeDto, type NoteDto } from '../lib/api'

export type Asset = {
  id: string
  gid: string
  name: string
  mime: string
  url: string
  path: string
  size: string
  folder: string // parent folder id or 'root'
  note: string
}

type Draft = { kind: 'folder' | 'note'; parent: string | null; name: string; error: string } | null

type Tab = { id: string; title: string; kind: string; parent?: string | null }

export type VaultState = {
  dark: boolean
  accent: string
  density: 'comfortable' | 'compact'
  panel: boolean
  locked: boolean
  keyValue: string
  keyError: boolean
  reveal: boolean
  mode: 'preview' | 'edit'
  tab: number
  openTabs: Tab[]
  active: string
  folder: string | null
  expanded: Record<string, boolean>
  extra: Record<string, TreeNode[]>
  moved: Record<string, string> // nodeId -> target parent 'root' or id
  assets: Asset[]
  seq: number
  palette: boolean
  query: string
  menu: null | { x: number; y: number; name: string; id: string; kind: 'folder' | 'note' | 'asset' }
  move: null | { id: string; name: string; kind: 'folder' | 'note' | 'asset'; path: string; target: string | null; targetName?: string }
  assetOpen: string | null
  upload: null | { name: string; size: string; path: string; phase: 'up' | 'done' }
  toast: string
  draft: Draft
  md: string | null
  over: string | null // 'root' or folder id for drag over ring
  drag: null | { id: string; name: string; kind: 'folder' | 'note' | 'asset' }
  // backend integration
  backendTree: TreeNodeDto[] | null
  treeLoading: boolean
  noteCache: Record<string, NoteDto>
  paletteResults: { id: string; name: string; kind: string; path?: string }[]
  // mobile ui
  view: 'library' | 'reading' | 'outline'
  drawer: boolean
  setView: (v: VaultState['view']) => void
  setDrawer: (v: boolean) => void
  // actions
  toggleDark: () => void
  setMode: (m: 'preview' | 'edit') => void
  setPanel: (v: boolean) => void
  toggle: (id: string) => void
  setExpanded: (e: Record<string, boolean>) => void
  collapseAll: () => void
  setActive: (id: string) => void
  openNote: (id: string) => void
  setTab: (i: number) => void
  startDraft: (kind: 'folder' | 'note', parent?: string | null) => void
  setDraft: (d: Draft) => void
  commitDraft: () => Promise<void>
  cancelDraft: () => void
  setPalette: (v: boolean) => void
  setQuery: (q: string) => void
  setMenu: (m: VaultState['menu']) => void
  setMove: (m: VaultState['move']) => void
  setAssetOpen: (id: string | null) => void
  setDrag: (d: VaultState['drag']) => void
  setOver: (o: string | null) => void
  setKeyValue: (v: string) => void
  setReveal: (v: boolean) => void
  submitKey: () => void
  lockVault: () => void
  setMd: (v: string) => void
  storeAsset: (name: string, mime: string, url: string, curNoteId: string) => void
  uploadFile: (file: File, curNoteId: string) => Promise<void>
  moveNode: (id: string, kind: 'folder' | 'note' | 'asset', target: string, name: string, targetName: string) => Promise<void>
  applyMove: () => void
  showToast: (t: string) => void
  setOverRoot: (v: string | null) => void
  // backend actions
  loadTree: () => Promise<void>
  fetchNote: (id: string) => Promise<void>
  saveNoteContent: (id: string, content: string) => Promise<void>
  renameNode: (id: string, kind: 'folder' | 'note', newName: string) => Promise<void>
  deleteNode: (id: string, kind: 'folder' | 'note' | 'asset') => Promise<void>
  duplicateNote: (id: string) => Promise<void>
}

function guid() {
  const h = '0123456789abcdef'
  let s = ''
  for (let i = 0; i < 32; i++) { s += h[Math.floor(Math.random() * 16)]; if (i === 7 || i === 11 || i === 15 || i === 19) s += '-' }
  return s
}
function fmtSize(bytes: number) {
  return bytes >= 1048576 ? (bytes / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(bytes / 1024)) + ' KB'
}
function bytesOfDataUrl(url: string) {
  const i = url.indexOf(',')
  return i < 0 ? 0 : Math.round((url.length - i - 1) * 0.75)
}

// debounce map for autosave
const saveTimers = new Map<string, number>()

const initialExpanded: Record<string, boolean> = { bt: true, 'bt-out': true, fosa: true, ta: true, eur: true, tj: true }

export const useVault = create<VaultState>((set, get) => ({
  dark: false,
  accent: '#5B3FD9',
  density: 'comfortable',
  panel: true,
  locked: false, // for MVP web, unlocked by default — set true if you want lock screen
  keyValue: '',
  keyError: false,
  reveal: false,
  mode: 'preview',
  tab: 1,
  openTabs: [
    { id: 'wf', kind: 'wf', title: 'WORKFLOW_EXPLAINED' },
    { id: 'ch27', kind: 'ch27', title: 'Chương 27. Các Định luật Kiến trúc…' },
  ],
  active: 'ch27',
  folder: 'fosa',
  expanded: initialExpanded,
  extra: {},
  moved: {},
  assets: [],
  seq: 0,
  palette: false,
  query: '',
  menu: null,
  move: null,
  assetOpen: null,
  upload: null,
  toast: '',
  draft: null,
  md: null,
  over: null,
  drag: null,
  backendTree: null,
  treeLoading: false,
  noteCache: {},
  paletteResults: [],
  view: 'reading',
  drawer: false,
  toggleDark: () => set(s => ({ dark: !s.dark })),
  setMode: (m) => set({ mode: m }),
  setPanel: (v) => set({ panel: v }),
  toggle: (id) => set(s => ({ expanded: { ...s.expanded, [id]: !s.expanded[id] } })),
  setExpanded: (e) => set({ expanded: e }),
  collapseAll: () => set({ expanded: {} }),
  setActive: (id) => set({ active: id }),
  openNote: (id) => {
    const s = get()
    // already open?
    let idx = s.openTabs.findIndex(t => t.id === id)
    let tabs = s.openTabs.slice()
    if (idx < 0) {
      // try to find title from backend tree or fallback
      let title = 'Note mới'
      const findInBackend = (nodes: TreeNodeDto[]): string | null => {
        for (const n of nodes) {
          if (n.id === id) return n.name
          if (n.children) { const r = findInBackend(n.children); if (r) return r }
        }
        return null
      }
      if (s.backendTree) {
        const t = findInBackend(s.backendTree)
        if (t) title = t
      } else {
        const find = (nodes: TreeNode[]): TreeNode | null => {
          for (const n of nodes) {
            if (n.id === id) return n
            if (n.children) { const f = find(n.children); if (f) return f }
          }
          return null
        }
        const node = find(TREE)
        if (node) title = node.name
        // also check cache
        if (s.noteCache[id]) title = s.noteCache[id].title
      }
      tabs.push({ id, kind: 'note', title, parent: s.folder })
      idx = tabs.length - 1
    }
    set({ active: id, openTabs: tabs, tab: idx, palette: false })
    // fetch note content async (fire and forget)
    get().fetchNote(id).catch(() => {})
  },
  setTab: (i) => {
    const t = get().openTabs[i]
    if (t) {
      set({ tab: i, active: t.id })
      if (t.kind === 'note' || t.id.length > 10) {
        get().fetchNote(t.id).catch(() => {})
      }
    }
  },
  startDraft: (kind, parent) => {
    const s = get()
    const p = parent === undefined ? (s.folder ?? null) : parent
    const exp = { ...s.expanded }
    if (p) exp[p] = true
    set({ draft: { kind, parent: p, name: '', error: '' }, expanded: exp, menu: null, palette: false })
  },
  setDraft: (d) => set({ draft: d }),
  cancelDraft: () => set({ draft: null }),
  commitDraft: async () => {
    const s = get()
    const d = s.draft
    if (!d) return
    const name = d.name.trim()
    if (!name) { set({ draft: null }); return }
    // check clash via backend tree or live children
    const children = getChildrenLive(d.parent, s)
    if (children.some(n => n.name.toLowerCase() === name.toLowerCase())) {
      set({ draft: { ...d, error: 'Tên này đã tồn tại trong thư mục.' } }); return
    }
    const parentForApi = d.parent === 'root' ? null : d.parent
    try {
      if (d.kind === 'folder') {
        const created = await folderApi.create(name, parentForApi)
        set({ draft: null, expanded: { ...s.expanded, [created.id]: true, ...(d.parent ? { [d.parent]: true } : {}) }, folder: created.id })
        get().showToast(`Đã tạo thư mục “${name}”`)
        await get().loadTree()
      } else {
        const created = await noteApi.create(name, parentForApi, '')
        const tabs = [...s.openTabs, { id: created.id, kind: 'note', title: created.title, parent: d.parent }]
        set({ draft: null, expanded: { ...s.expanded, ...(d.parent ? { [d.parent]: true } : {}) }, openTabs: tabs, tab: tabs.length - 1, active: created.id, mode: 'edit' as const, md: '' })
        get().showToast(`Đã tạo note “${name}”`)
        await get().loadTree()
        // open new note
        get().fetchNote(created.id).catch(() => {})
      }
    } catch (e: any) {
      // fallback to local mock if backend unavailable
      if (e?.message?.includes('Failed to fetch') || e?.message?.includes('NetworkError')) {
        const id = 'x' + (s.seq + 1)
        const node: TreeNode = d.kind === 'folder' ? { id, name, children: [] } : { id, name }
        const key = d.parent || 'root'
        const extra = { ...s.extra }
        extra[key] = [...(extra[key] || []), node]
        const exp = { ...s.expanded }
        if (d.parent) exp[d.parent] = true
        if (d.kind === 'folder') {
          exp[id] = true
          set({ extra, expanded: exp, draft: null, seq: s.seq + 1, folder: id })
          get().showToast(`Đã tạo thư mục “${name}” (offline)`)
        } else {
          const tabs = [...s.openTabs, { id, kind: 'new', title: name, parent: d.parent }]
          set({ extra, expanded: exp, draft: null, seq: s.seq + 1, openTabs: tabs, tab: tabs.length - 1, active: id, mode: 'edit' as const })
          get().showToast(`Đã tạo note “${name}” (offline)`)
        }
      } else {
        set({ draft: { ...d, error: e.message || 'Lỗi tạo mới' } })
      }
    }
  },
  setPalette: (v) => set({ palette: v, query: v ? '' : get().query }),
  setQuery: (q) => {
    set({ query: q })
    // trigger search debounce
    if (!q.trim()) { set({ paletteResults: [] }); return }
    const doSearch = async () => {
      try {
        const res = await searchApi.search(q, 12)
        // map to paletteResults shape
        const mapped = res.map((r: any) => ({
          id: r.id,
          name: r.title || r.name || '',
          kind: r.kind || 'note',
          path: r.snippet || '',
        }))
        set({ paletteResults: mapped })
      } catch {
        // fallback to local FLAT filter will be handled in component if needed
        set({ paletteResults: [] })
      }
    }
    // simple debounce via timeout
    const key = '__palette_search'
    const prev = (globalThis as any)[key]
    if (prev) clearTimeout(prev)
    ;(globalThis as any)[key] = setTimeout(doSearch, 180)
  },
  setMenu: (m) => set({ menu: m }),
  setMove: (m) => set({ move: m }),
  setAssetOpen: (id) => set({ assetOpen: id }),
  setDrag: (d) => set({ drag: d }),
  setOver: (o) => set({ over: o }),
  setOverRoot: (v) => set({ over: v }),
  setKeyValue: (v) => set({ keyValue: v, keyError: false }),
  setReveal: (v) => set({ reveal: v }),
  submitKey: () => {
    const want = '6oVGnGX48PBmla6TQrEvPCXqNSa7KcW2'
    const s = get()
    if (s.keyValue.trim() === want) {
      try { localStorage.setItem('obs-vault-unlocked', '1') } catch {}
      set({ locked: false, keyError: false, keyValue: '' })
    } else {
      set({ keyError: true })
    }
  },
  lockVault: () => {
    try { localStorage.removeItem('obs-vault-unlocked') } catch {}
    set({ locked: true, keyValue: '', keyError: false, menu: null, palette: false })
  },
  setMd: (v) => {
    set({ md: v })
    const s = get()
    const curId = s.active
    // only autosave for real notes (not wf/ch27 mock)
    if (!curId || curId === 'wf' || curId === 'ch27') return
    // if note is cached, save with debounce
    if (!s.noteCache[curId] && s.openTabs.find(t => t.id === curId)?.kind === 'new') return
    const prev = saveTimers.get(curId)
    if (prev) window.clearTimeout(prev)
    const t = window.setTimeout(async () => {
      try {
        await get().saveNoteContent(curId, v)
      } catch {}
    }, 800)
    saveTimers.set(curId, t)
  },
  storeAsset: (name, mime, url, curNoteId) => {
    // legacy path: keep local preview but also try real upload if url is dataUrl
    // This is called from old handlePasteStatic that uses FileReader.
    // We'll keep behavior but also handle via uploadFile for real files elsewhere.
    const s = get()
    const gid = guid()
    const size = fmtSize(bytesOfDataUrl(url))
    const folder = s.folder ? s.folder : 'root'
    const parent = (() => {
      const res = findParentLive(curNoteId, s)
      return res ?? folder
    })()
    const asset: Asset = { id: 'a' + (s.seq + 1), gid, name, mime, url, path: '/api/files/' + gid, size, folder: parent, note: curNoteId }
    set({
      assets: [...s.assets, asset],
      seq: s.seq + 1,
      upload: { name, size, path: asset.path, phase: 'up' },
      expanded: { ...s.expanded, [parent]: true },
    })
    setTimeout(() => {
      const cur = get()
      if (cur.upload) set({ upload: { ...cur.upload, phase: 'done' } })
      setTimeout(() => set({ upload: null }), 5200)
    }, 800)
    get().showToast(`Đã dán ${name}`)
    void url
  },
  uploadFile: async (file, curNoteId) => {
    const s = get()
    const folder = (() => {
      const res = findParentLive(curNoteId, s)
      return res ?? s.folder
    })()
    const displayFolder = folder === 'root' ? null : folder
    set({ upload: { name: file.name, size: fmtSize(file.size), path: '/api/files/uploading', phase: 'up' } })
    try {
      const att = await fileApi.upload(file, curNoteId, displayFolder || undefined)
      // map to Asset for UI
      const asset: Asset = {
        id: att.id,
        gid: att.id,
        name: att.fileName,
        mime: att.contentType,
        url: att.url,
        path: att.path,
        size: fmtSize(att.size),
        folder: att.folderId || 'root',
        note: curNoteId,
      }
      set({
        assets: [...s.assets, asset],
        upload: { name: att.fileName, size: fmtSize(att.size), path: att.path, phase: 'done' },
        expanded: { ...s.expanded, [(att.folderId || 'root')]: true },
      })
      setTimeout(() => set({ upload: null }), 3200)
      await get().loadTree()
      get().showToast(`Đã tải ${file.name}`)
      return att as any
    } catch (e: any) {
      set({ upload: null })
      get().showToast(e.message || 'Upload lỗi')
      throw e
    }
  },
  moveNode: async (id, kind, target, name, targetName) => {
    const s = get()
    const apiTarget = target === 'root' ? null : target
    try {
      if (kind === 'asset') {
        await fileApi.move(id, apiTarget)
      } else if (kind === 'folder') {
        await folderApi.move(id, apiTarget)
      } else {
        await noteApi.move(id, apiTarget)
      }
      set({ move: null, expanded: { ...s.expanded, [target]: true } })
      await get().loadTree()
      get().showToast(kind === 'asset' ? `Đã chuyển “${name}” sang ${targetName} · liên kết không đổi` : `Đã chuyển “${name}” sang ${targetName}`)
    } catch (e: any) {
      // fallback local
      if (e?.message?.includes('Failed to fetch')) {
        if (kind === 'asset') {
          set({
            assets: s.assets.map(a => a.id === id ? { ...a, folder: target } : a),
            expanded: { ...s.expanded, [target]: true },
            move: null,
          })
          get().showToast(`Đã chuyển “${name}” sang ${targetName} · liên kết không đổi (offline)`)
        } else {
          set({
            moved: { ...s.moved, [id]: target },
            expanded: { ...s.expanded, [target]: true },
            move: null,
          })
          get().showToast(`Đã chuyển “${name}” sang ${targetName} (offline)`)
        }
      } else {
        get().showToast(e.message || 'Di chuyển lỗi')
      }
    }
  },
  applyMove: () => {
    const s = get()
    const m = s.move
    if (!m || !m.target) return
    get().moveNode(m.id, m.kind as any, m.target, m.name, m.targetName ?? m.target)
  },
  showToast: (t) => {
    set({ toast: t })
    setTimeout(() => set({ toast: '' }), 3200)
  },
  setView: (v) => set({ view: v }),
  setDrawer: (v) => set({ drawer: v }),
  loadTree: async () => {
    set({ treeLoading: true })
    try {
      const tree = await folderApi.tree()
      set({ backendTree: tree, treeLoading: false })
      // also sync attachments list to assets for tree rendering fallback?
      // fetch attachments to populate assets array for legacy helpers (optional)
      try {
        const atts = await fileApi.list()
        const mapped: Asset[] = atts.map(a => ({
          id: a.id,
          gid: a.id,
          name: a.fileName,
          mime: a.contentType,
          url: `/api/files/${a.id}`,
          path: `/api/files/${a.id}`,
          size: fmtSize(a.size),
          folder: a.folderId || 'root',
          note: a.noteId || '',
        }))
        // merge: keep local assets that are not yet in backend (offline pasted)
        const existingIds = new Set(mapped.map(m => m.id))
        const localOnly = get().assets.filter(a => !existingIds.has(a.id) && a.id.startsWith('a'))
        set({ assets: [...mapped, ...localOnly] })
      } catch {}
    } catch {
      set({ treeLoading: false })
      // keep backendTree null -> fallback to mock TREE
    }
  },
  fetchNote: async (id) => {
    // skip mock ids
    if (id === 'wf' || id === 'ch27' || id.startsWith('x') || id.startsWith('ai') || id.startsWith('bt') || id.startsWith('tj')) {
      // for mock notes, use MD
      set({ md: MD, noteCache: { ...get().noteCache, [id]: { id, title: id, folderId: null, content: MD, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as any } })
      return
    }
    try {
      const note = await noteApi.get(id)
      set(s => ({ noteCache: { ...s.noteCache, [id]: note }, md: s.active === id ? note.content : s.md }))
      // also update tab title
      const tabs = get().openTabs.map(t => t.id === id ? { ...t, title: note.title } : t)
      set({ openTabs: tabs })
    } catch {
      // fallback to local md or empty
      if (!get().noteCache[id]) set({ md: '' })
    }
  },
  saveNoteContent: async (id, content) => {
    if (id === 'wf' || id === 'ch27' || id.startsWith('x')) return
    const cached = get().noteCache[id]
    const title = cached?.title || get().openTabs.find(t => t.id === id)?.title || 'Note'
    try {
      const updated = await noteApi.update(id, { title, content })
      set(s => ({ noteCache: { ...s.noteCache, [id]: updated } }))
    } catch (e: any) {
      // offline: keep local
    }
  },
  renameNode: async (id, kind, newName) => {
    try {
      if (kind === 'folder') await folderApi.rename(id, newName)
      else if (kind === 'note') await noteApi.update(id, { title: newName })
      await get().loadTree()
      get().showToast(`Đã đổi tên thành “${newName}”`)
    } catch (e: any) {
      get().showToast(e.message || 'Đổi tên lỗi')
      throw e
    }
  },
  deleteNode: async (id, kind) => {
    try {
      if (kind === 'folder') await folderApi.remove(id)
      else if (kind === 'note') await noteApi.remove(id)
      else await fileApi.remove(id)
      await get().loadTree()
      // close tab if note
      if (kind === 'note') {
        const tabs = get().openTabs.filter(t => t.id !== id)
        const active = tabs[0]?.id || 'wf'
        set({ openTabs: tabs.length ? tabs : [{ id: 'wf', kind: 'wf', title: 'WORKFLOW_EXPLAINED' }], active, tab: 0, menu: null })
      } else {
        set({ menu: null })
      }
      get().showToast('Đã xoá')
    } catch (e: any) {
      get().showToast(e.message || 'Xoá lỗi')
      throw e
    }
  },
  duplicateNote: async (id) => {
    try {
      const dup = await noteApi.duplicate(id)
      await get().loadTree()
      const tabs = [...get().openTabs, { id: dup.id, kind: 'note', title: dup.title, parent: dup.folderId }]
      set({ openTabs: tabs, tab: tabs.length - 1, active: dup.id })
      get().showToast(`Đã nhân bản “${dup.title}”`)
    } catch (e: any) {
      get().showToast(e.message || 'Nhân bản lỗi')
    }
  },
}))

// helpers for live tree — reused outside
// Now supports both backendTree and fallback mock TREE
export function findRawLive(id: string, s: Pick<VaultState, 'extra' | 'assets' | 'backendTree'>): TreeNode | null {
  // first search backendTree if available
  if (s.backendTree) {
    const search = (nodes: TreeNodeDto[]): TreeNodeDto | null => {
      for (const n of nodes) {
        if (n.id === id) return n
        if (n.children) { const r = search(n.children); if (r) return r }
      }
      return null
    }
    const found = search(s.backendTree)
    if (found) return { id: found.id, name: found.name, children: found.children as any } as TreeNode
  }
  let found: TreeNode | null = null
  const scan = (list: TreeNode[]) => {
    for (const n of list) {
      if (found) return
      if (n.id === id) { found = n; return }
      if (n.children) scan(n.children)
    }
  }
  scan(TREE)
  if (!found) {
    for (const k of Object.keys(s.extra)) for (const n of s.extra[k]) if (n.id === id) found = n
  }
  if (!found) {
    const a = s.assets.find(x => x.id === id)
    if (a) found = { id: a.id, name: a.name } as any
  }
  return found
}

export function getChildrenLive(parentId: string | null, s: Pick<VaultState, 'extra' | 'moved' | 'assets' | 'backendTree'>): (TreeNode & { asset?: Asset; kind?: string })[] {
  // if backendTree exists, use it
  if (s.backendTree) {
    const findNode = (nodes: TreeNodeDto[], pid: string | null): TreeNodeDto[] | null => {
      if (pid === null) return nodes
      for (const n of nodes) {
        if (n.id === pid) return n.children || []
        if (n.children) {
          const r = findNode(n.children, pid)
          if (r) return r
        }
      }
      return null
    }
    const backendChildren = findNode(s.backendTree, parentId)
    if (backendChildren) {
      // map TreeNodeDto to TreeNode shape
      return backendChildren.map(c => {
        if (c.kind === 'folder') return { id: c.id, name: c.name, children: c.children as any, kind: c.kind } as any
        if (c.kind === 'asset') {
          const a = s.assets.find(x => x.id === c.id)
          return { id: c.id, name: c.name, asset: a || { id: c.id, name: c.name, mime: 'image/*', url: `/api/files/${c.id}`, path: `/api/files/${c.id}`, size: '', folder: parentId || 'root', gid: c.id, note: '' } as Asset, kind: 'asset' } as any
        }
        return { id: c.id, name: c.name, kind: 'note' } as any
      })
    }
    // fallback to empty if parent not found in backend but might be mock folder
  }
  const key = parentId || 'root'
  const base: TreeNode[] = parentId === null ? TREE : (findRawLive(parentId, s as any)?.children ?? [])
  const extra = s.extra[key] || []
  const mv = s.moved
  const kept = [...base, ...extra].filter(n => !(n.id in mv) || mv[n.id] === key)
  const incoming: TreeNode[] = []
  for (const nid of Object.keys(mv)) {
    if (mv[nid] !== key || kept.some(k => k.id === nid)) continue
    const n = findRawLive(nid, s as any)
    if (n && !(n as any).asset) incoming.push(n)
  }
  const assets = s.assets.filter(a => a.folder === key).map(a => ({ id: a.id, name: a.name, asset: a } as any))
  return [...kept, ...incoming, ...assets]
}

export function findParentLive(id: string, s: VaultState): string | null {
  // if backendTree, search there first
  if (s.backendTree) {
    let res: string | null | undefined
    const scan = (nodes: TreeNodeDto[], pid: string | null) => {
      for (const n of nodes) {
        if (res !== undefined) return
        if (n.id === id) { res = pid || 'root'; return }
        if (n.children) scan(n.children, n.id)
      }
    }
    scan(s.backendTree, null)
    if (res !== undefined) return res
  }
  let res: string | null | undefined
  const scan = (pid: string | null) => {
    for (const n of getChildrenLive(pid, s)) {
      if (res !== undefined) return
      if (n.id === id) { res = pid || 'root'; return }
      if ((n as any).children) scan(n.id)
    }
  }
  scan(null)
  return res === undefined ? null : res
}

export function folderOptionsLive(s: VaultState) {
  if (s.backendTree) {
    const out: { id: string; name: string; depth: number }[] = [{ id: 'root', name: 'Vault', depth: 0 }]
    const walk = (nodes: TreeNodeDto[], depth: number) => {
      for (const n of nodes) {
        if (n.kind !== 'folder') continue
        out.push({ id: n.id, name: n.name, depth })
        if (n.children) walk(n.children as TreeNodeDto[], depth + 1)
      }
    }
    walk(s.backendTree, 1)
    return out
  }
  const out: { id: string; name: string; depth: number }[] = [{ id: 'root', name: 'Vault', depth: 0 }]
  const walk = (pid: string | null, depth: number) => {
    for (const n of getChildrenLive(pid, s)) {
      if (!(n as any).children) continue
      out.push({ id: n.id, name: n.name, depth })
      walk(n.id, depth + 1)
    }
  }
  walk(null, 1)
  return out
}
