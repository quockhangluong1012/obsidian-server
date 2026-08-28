import { create } from 'zustand'
import { TREE, type TreeNode } from '../mock/data'

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
  commitDraft: () => void
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
  moveNode: (id: string, kind: 'folder' | 'note' | 'asset', target: string, name: string, targetName: string) => void
  applyMove: () => void
  showToast: (t: string) => void
  setOverRoot: (v: string | null) => void
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
    let idx = s.openTabs.findIndex(t => t.id === id)
    let tabs = s.openTabs.slice()
    if (idx < 0) {
      // find name from tree
      const find = (nodes: TreeNode[]): TreeNode | null => {
        for (const n of nodes) {
          if (n.id === id) return n
          if (n.children) { const f = find(n.children); if (f) return f }
        }
        return null
      }
      const node = find(TREE)
      const title = node?.name ?? 'Note mới'
      tabs.push({ id, kind: 'note', title, parent: s.folder })
      idx = tabs.length - 1
    }
    set({ active: id, openTabs: tabs, tab: idx, palette: false })
  },
  setTab: (i) => {
    const t = get().openTabs[i]
    if (t) set({ tab: i, active: t.id })
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
  commitDraft: () => {
    const s = get()
    const d = s.draft
    if (!d) return
    const name = d.name.trim()
    if (!name) { set({ draft: null }); return }
    // check clash via childrenOf logic simplified here — we compute live
    const children = getChildrenLive(d.parent, s)
    if (children.some(n => n.name.toLowerCase() === name.toLowerCase())) {
      set({ draft: { ...d, error: 'Tên này đã tồn tại trong thư mục.' } }); return
    }
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
      get().showToast(`Đã tạo thư mục “${name}”`)
    } else {
      const tabs = [...s.openTabs, { id, kind: 'new', title: name, parent: d.parent }]
      set({ extra, expanded: exp, draft: null, seq: s.seq + 1, openTabs: tabs, tab: tabs.length - 1, active: id, mode: 'edit' as const })
      get().showToast(`Đã tạo note “${name}”`)
    }
  },
  setPalette: (v) => set({ palette: v, query: v ? '' : get().query }),
  setQuery: (q) => set({ query: q }),
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
  setMd: (v) => set({ md: v }),
  storeAsset: (name, mime, url, curNoteId) => {
    const s = get()
    const gid = guid()
    const size = fmtSize(bytesOfDataUrl(url))
    // parent = parentOf(curNoteId) — simplified: use folder state
    const folder = s.folder ? s.folder : 'root'
    // need parentOf logic for notes: find parent in live tree
    // fallback to folder
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
    // insert into md
    const base = s.md ?? ''
    // caller will handle insert; we just store
    setTimeout(() => {
      const cur = get()
      if (cur.upload) set({ upload: { ...cur.upload, phase: 'done' } })
      setTimeout(() => set({ upload: null }), 5200)
    }, 800)
    // toast
    get().showToast(`Đã dán ${name}`)
    void base
  },
  moveNode: (id, kind, target, name, targetName) => {
    const s = get()
    if (kind === 'asset') {
      set({
        assets: s.assets.map(a => a.id === id ? { ...a, folder: target } : a),
        expanded: { ...s.expanded, [target]: true },
        move: null,
      })
      get().showToast(`Đã chuyển “${name}” sang ${targetName} · liên kết trong note không đổi`)
    } else {
      set({
        moved: { ...s.moved, [id]: target },
        expanded: { ...s.expanded, [target]: true },
        move: null,
      })
      get().showToast(`Đã chuyển “${name}” sang ${targetName}`)
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
}))

// helpers for live tree — reused outside
export function findRawLive(id: string, s: Pick<VaultState,'extra'|'assets'>): TreeNode | null {
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

export function getChildrenLive(parentId: string | null, s: Pick<VaultState,'extra'|'moved'|'assets'>): (TreeNode & {asset?:Asset})[] {
  const key = parentId || 'root'
  const base: TreeNode[] = parentId === null ? TREE : (findRawLive(parentId, s)?.children ?? [])
  const extra = s.extra[key] || []
  const mv = s.moved
  const kept = [...base, ...extra].filter(n => !(n.id in mv) || mv[n.id] === key)
  const incoming: TreeNode[] = []
  for (const nid of Object.keys(mv)) {
    if (mv[nid] !== key || kept.some(k => k.id === nid)) continue
    const n = findRawLive(nid, s)
    if (n && !(n as any).asset) incoming.push(n)
  }
  const assets = s.assets.filter(a => a.folder === key).map(a => ({ id: a.id, name: a.name, asset: a } as any))
  return [...kept, ...incoming, ...assets]
}

export function findParentLive(id: string, s: VaultState): string | null {
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
  const out: {id:string; name:string; depth:number}[] = [{ id: 'root', name: 'Vault', depth: 0 }]
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
