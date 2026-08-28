import { useRef, useState } from 'react'
import { useVault, getChildrenLive } from '../store/useVault'
import { TREE, FLAT } from '../mock/data'

export function Sidebar() {
  const s = useVault()
  const scrollRef = useRef<HTMLDivElement>(null)

  // build rows like original rows()
  const rows = buildRows(s)
  const vaultCount = `${FLAT.filter(f => f.kind === 'note').length} notes · ${FLAT.filter(f => f.kind === 'folder').length} thư mục`

  const c = colors(s.accent, s.dark)

  return (
    <aside className="w-[294px] shrink-0 flex flex-col bg-[var(--drw)] border-r border-[var(--bd)]">
      {/* header */}
      <div className="flex items-center gap-0.5 h-[52px] px-1.5 pl-[14px] shrink-0">
        <span className="material-symbols-rounded text-[20px] text-[var(--pri)]">folder_open</span>
        <span className="text-[14px] font-medium tracking-[0.01em] ml-2 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">Obsidian Vault</span>
        <button onClick={() => s.setPalette(true)} title="Tìm kiếm" className="grid place-items-center w-8 h-8 rounded-full bg-transparent text-[var(--tx2)] hover:bg-[var(--hov)] hover:text-[var(--pri)] cursor-pointer">
          <span className="material-symbols-rounded text-[19px]">search</span>
        </button>
        <button onClick={() => s.lockVault()} title="Khoá vault" className="grid place-items-center w-8 h-8 rounded-full bg-transparent text-[var(--tx2)] hover:bg-[var(--hov)] hover:text-[var(--pri)] cursor-pointer">
          <span className="material-symbols-rounded text-[19px]">lock</span>
        </button>
        <button onClick={() => s.toggleDark()} title="Đổi chế độ màu" className="grid place-items-center w-8 h-8 rounded-full bg-transparent text-[var(--tx2)] hover:bg-[var(--hov)] hover:text-[var(--pri)] cursor-pointer">
          <span className="material-symbols-rounded text-[19px]">{s.dark ? 'light_mode' : 'dark_mode'}</span>
        </button>
      </div>

      {/* actions */}
      <div className="flex items-center gap-1 px-2.5 pb-2.5 shrink-0">
        <button onClick={() => s.startDraft('note')} className="flex items-center gap-1.5 h-8 px-3 rounded-[6px] bg-[var(--pri)] text-[var(--priC)] text-[12.5px] font-medium tracking-[0.02em] shadow-[0_1px_3px_rgba(31,34,60,.2)] hover:brightness-[1.08] cursor-pointer">
          <span className="material-symbols-rounded text-[17px]">note_add</span>Note mới
        </button>
        <button onClick={() => s.startDraft('folder')} title="Thư mục mới" className="grid place-items-center w-8 h-8 rounded-[6px] border border-[var(--bd)] bg-transparent text-[var(--tx2)] hover:bg-[var(--hov)] hover:text-[var(--pri)] cursor-pointer">
          <span className="material-symbols-rounded text-[17px]">create_new_folder</span>
        </button>
        <div className="flex-1" />
        <button title="Sắp xếp" className="grid place-items-center w-8 h-8 rounded-[6px] bg-transparent text-[var(--tx2)] hover:bg-[var(--hov)] cursor-pointer"><span className="material-symbols-rounded text-[18px]">sort</span></button>
        <button onClick={() => s.collapseAll()} title="Thu gọn tất cả" className="grid place-items-center w-8 h-8 rounded-[6px] bg-transparent text-[var(--tx2)] hover:bg-[var(--hov)] cursor-pointer"><span className="material-symbols-rounded text-[18px]">unfold_less</span></button>
      </div>

      {/* tree */}
      <div
        ref={scrollRef}
        onDragOver={(e) => {
          if (!s.drag) return
          const parent = findParentLive(s.drag.id)
          if (parent === 'root') return
          e.preventDefault()
          if (s.over !== 'root') s.setOver('root')
        }}
        onDragLeave={(e) => {
          if ((e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) return
          if (s.over === 'root') s.setOver(null)
        }}
        onDrop={(e) => {
          e.preventDefault()
          const d = s.drag
          if (!d) { s.setOver(null); s.setDrag(null); return }
          const p = findParentLive(d.id)
          if (p === 'root') { s.setOver(null); s.setDrag(null); return }
          s.setOver(null); s.setDrag(null)
          s.moveNode(d.id, d.kind, 'root', d.name, 'Vault')
        }}
        className="flex-1 overflow-y-auto overscroll-contain px-2 pb-5 rounded-lg"
        style={{ boxShadow: s.over === 'root' ? `inset 0 0 0 2px ${c.pri}` : 'none' }}
      >
        {rows.map((row: any, i: number) => (
          <div key={i}>
            {row.isNode && (
              <div
                onClick={row.onClick}
                onContextMenu={row.onCtx}
                draggable={row.draggable}
                onDragStart={row.onDragStart}
                onDragEnd={row.onDragEnd}
                onDragOver={row.onDragOver}
                onDragLeave={row.onDragLeave}
                onDrop={row.onDrop}
                className="flex items-center gap-[5px] h-[30px] rounded-[6px] cursor-pointer pr-2 select-none"
                style={{ paddingLeft: row.pad, background: row.bg, color: row.col, fontWeight: row.fw, fontSize: '13.5px', opacity: row.opacity, boxShadow: row.ring }}
              >
                <span className="material-symbols-rounded text-[16px] w-4 shrink-0 opacity-80 transition-transform duration-150" style={{ transform: `rotate(${row.rot}deg)` }}>{row.chev}</span>
                <span className="material-symbols-rounded text-[17px] shrink-0" style={{ color: row.iconCol }}>{row.icon}</span>
                <span className="overflow-hidden text-ellipsis whitespace-nowrap">{row.name}</span>
              </div>
            )}
            {row.isDraft && (
              <div className="flex flex-col gap-1 py-0.5 pb-1.5">
                <div className="flex items-center gap-[5px] h-[30px] rounded-[6px] pr-1.5 bg-[var(--bg)] border shadow-[0_0_0_3px_var(--sel)]" style={{ paddingLeft: row.pad, borderColor: row.bdCol, boxShadow: `0 0 0 3px ${row.ring}` }}>
                  <span className="w-4 shrink-0" />
                  <span className="material-symbols-rounded text-[17px] shrink-0 text-[var(--pri)]">{row.icon}</span>
                  <input
                    ref={row.inputRef}
                    defaultValue={row.value}
                    onChange={row.onInput}
                    onKeyDown={row.onKey}
                    onBlur={row.onBlur}
                    placeholder={row.placeholder}
                    autoCapitalize="off"
                    autoCorrect="off"
                    className="flex-1 min-w-0 border-0 outline-0 bg-transparent text-[13.5px] text-[var(--tx)]"
                  />
                </div>
                <div className="flex items-center gap-1.5 text-[11.5px]" style={{ paddingLeft: row.pad, color: row.hintCol }}>
                  <span className="material-symbols-rounded text-[14px]">{row.hintIcon}</span>{row.hint}
                </div>
              </div>
            )}
            {row.isEmpty && (
              <div className="py-1 pr-2 text-xs text-[var(--tx2)] opacity-80" style={{ paddingLeft: row.pad }}>Thư mục trống</div>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 h-10 px-3.5 shrink-0 border-t border-[var(--bd)] text-[var(--tx2)] text-xs">
        <span className="material-symbols-rounded text-[16px]">database</span>
        <span className="flex-1">{vaultCount}</span>
        <span className="material-symbols-rounded text-[17px] cursor-pointer">settings</span>
      </div>
    </aside>
  )
}

// helpers extracted from original template logic
function colors(accent: string, dark: boolean) {
  const a = accent || '#6C4BD1'
  if (dark) return { bg: '#1E1F2B', surf: '#262735', drw: '#191A24', bd: '#32333F', tx: '#E7E8F0', tx2: '#9A9DB0', pri: a, priC: '#14151F', hov: 'rgba(255,255,255,.06)', sel: 'rgba(108,75,209,.26)', code: '#2B2C3A' }
  return { bg: '#FFFFFF', surf: '#F7F8FC', drw: '#F1F2F8', bd: '#E4E6F0', tx: '#22242E', tx2: '#6B6F80', pri: a, priC: '#FFFFFF', hov: 'rgba(63,81,181,.08)', sel: 'rgba(63,81,181,.16)', code: '#F2F3F9' }
}

function findParentLive(id: string): string | null {
  // use useVault.getState helpers? quick scan via store
  const s: any = (useVault as any).getState()
  const getChildren = (pid: string | null): any[] => {
    const key = pid || 'root'
    const base: any[] = pid === null ? TREE : ((findRaw(pid)?.children || []))
    const extra = s.extra[key] || []
    const mv = s.moved
    const kept = [...base, ...extra].filter((n: any) => !(n.id in mv) || mv[n.id] === key)
    const incoming: any[] = []
    for (const nid of Object.keys(mv)) {
      if (mv[nid] !== key || kept.some((k: any) => k.id === nid)) continue
      const n = findRaw(nid)
      if (n) incoming.push(n)
    }
    const assets = (s.assets as any[]).filter((a: any) => a.folder === key).map((a: any) => ({ id: a.id, name: a.name, asset: a }))
    return [...kept, ...incoming, ...assets]
  }
  let res: string | null | undefined
  const scan = (pid: string | null) => {
    for (const n of getChildren(pid)) {
      if (res !== undefined) return
      if (n.id === id) { res = pid || 'root'; return }
      if (n.children) scan(n.id)
    }
  }
  scan(null)
  return res === undefined ? null : res
}
function findRaw(id: string): any {
  const s: any = (useVault as any).getState()
  let found: any = null
  const scan = (list: any[]) => list.forEach((n: any) => {
    if (found) return
    if (n.id === id) { found = n; return }
    if (n.children) scan(n.children)
  })
  scan(TREE)
  if (!found) Object.keys(s.extra).forEach(k => (s.extra[k] as any[]).forEach((n: any) => { if (n.id === id) found = n }))
  if (!found) { const a = (s.assets as any[]).find((x: any) => x.id === id); if (a) found = { id: a.id, name: a.name, asset: a } }
  return found
}

function buildRows(s: any) {
  const c = colors(s.accent, s.dark)
  const out: any[] = []
  const exp = s.expanded
  const dense = s.density === 'compact'
  const step = dense ? 12 : 15
  const dragging = s.drag
  const d = s.draft

  const draftRow = (depth: number) => out.push({
    isDraft: true,
    pad: 6 + depth * step,
    icon: d.kind === 'folder' ? 'create_new_folder' : 'note_add',
    value: d.name,
    placeholder: d.kind === 'folder' ? 'Tên thư mục mới' : 'Tên note mới',
    bdCol: d.error ? '#D64550' : c.pri,
    ring: d.error ? 'rgba(214,69,80,.14)' : c.sel,
    hint: d.error || 'Enter để lưu · Esc để huỷ',
    hintIcon: d.error ? 'error' : 'keyboard_return',
    hintCol: d.error ? '#D64550' : c.tx2,
    inputRef: (el: HTMLInputElement | null) => { if (el) { el.focus(); } },
    onInput: (e: any) => s.setDraft({ ...s.draft, name: e.target.value, error: '' }),
    onKey: (e: any) => {
      if (e.key === 'Enter') { e.preventDefault(); s.commitDraft() }
      if (e.key === 'Escape') { e.preventDefault(); s.cancelDraft() }
    },
    onBlur: () => s.commitDraft()
  })

  // helpers inside
  const getChildren = (pid: string | null): any[] => {
    const key = pid || 'root'
    const base: any[] = pid === null ? TREE : ((findRaw(pid)?.children || []))
    const extra = s.extra[key] || []
    const mv = s.moved
    const kept = [...base, ...extra].filter((n: any) => !(n.id in mv) || mv[n.id] === key)
    const incoming: any[] = []
    for (const nid of Object.keys(mv)) {
      if (mv[nid] !== key || kept.some((k: any) => k.id === nid)) continue
      const n = findRaw(nid)
      if (n && !(n as any).asset) incoming.push(n)
    }
    const assets = (s.assets as any[]).filter((a: any) => a.folder === key).map((a: any) => ({ id: a.id, name: a.name, asset: a }))
    return [...kept, ...incoming, ...assets]
  }

  const canDropOn = (targetId: string) => {
    const dd = s.drag
    if (!dd) return false
    if (dd.id === targetId) return false
    const parent = findParentLive(dd.id)
    if (parent === targetId) return false
    if (dd.kind === 'folder') {
      // check isInside
      let hit = false
      const walk = (pid: string | null) => getChildren(pid).forEach((n: any) => {
        if (hit) return
        if (n.id === targetId) { hit = true; return }
        if (n.children) walk(n.id)
      })
      walk(dd.id)
      if (hit) return false
    }
    return true
  }

  const walk = (parentId: string | null, depth: number) => {
    getChildren(parentId).forEach((n: any) => {
      const isFolder = !!n.children
      const isAsset = !!n.asset
      const kind: 'folder' | 'note' | 'asset' = isFolder ? 'folder' : isAsset ? 'asset' : 'note'
      const open = !!exp[n.id]
      const active = s.active === n.id || (isAsset && s.assetOpen === n.id)
      const marked = isFolder && s.folder === n.id
      out.push({
        isNode: true,
        id: n.id,
        name: n.name,
        pad: 6 + depth * step,
        chev: isFolder ? 'chevron_right' : '',
        rot: isFolder && open ? 90 : 0,
        icon: isFolder ? (open ? 'folder_open' : 'folder') : isAsset ? (/svg/.test(n.asset.mime) ? 'shapes' : 'image') : 'description',
        iconCol: isFolder ? c.pri : isAsset ? '#C48A2F' : c.tx2,
        bg: active ? c.sel : (marked ? c.hov : 'transparent'),
        col: active ? c.pri : c.tx,
        fw: active || isFolder ? 500 : 400,
        draggable: true,
        opacity: dragging && dragging.id === n.id ? .42 : 1,
        ring: isFolder && s.over === n.id ? `inset 0 0 0 2px ${c.pri}` : 'none',
        onClick: () => {
          if (isFolder) { s.toggle(n.id); (useVault as any).setState({ folder: n.id }) }
          else if (isAsset) s.setAssetOpen(n.id)
          else s.openNote(n.id)
        },
        onDragStart: (e: any) => {
          if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', n.id) } catch {} }
          s.setMenu(null); s.setDrag({ id: n.id, name: n.name, kind })
        },
        onDragEnd: () => { s.setDrag(null); s.setOver(null) },
        onDragOver: isFolder ? (e: any) => {
          if (!canDropOn(n.id)) return
          e.preventDefault(); e.stopPropagation()
          if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
          if (s.over !== n.id) { s.setOver(n.id); }
        } : (e: any) => {
          if (!s.drag) return
          e.stopPropagation()
          if (s.over) s.setOver(null)
        },
        onDragLeave: isFolder ? () => { if (s.over === n.id) s.setOver(null) } : undefined,
        onDrop: isFolder ? (e: any) => {
          e.preventDefault(); e.stopPropagation()
          const dd = s.drag
          if (!dd || !canDropOn(n.id)) { s.setDrag(null); s.setOver(null); return }
          s.setDrag(null); s.setOver(null)
          s.moveNode(dd.id, dd.kind, n.id, dd.name, n.name)
        } : undefined,
        onCtx: (e: any) => {
          e.preventDefault()
          const vw = window.innerWidth
          ;(useVault as any).setState({ folder: isFolder ? n.id : s.folder, menu: { x: Math.min(e.clientX, Math.max(0, vw - 246)), y: e.clientY, name: n.name, id: n.id, kind } })
        }
      })
      if (isFolder && open) walk(n.id, depth + 1)
    })
    if (d && d.parent === parentId) draftRow(depth)
    else if (parentId && exp[parentId] && getChildren(parentId).length === 0) {
      out.push({ isEmpty: true, pad: 6 + depth * step })
    }
  }
  walk(null, 0)
  return out
}
