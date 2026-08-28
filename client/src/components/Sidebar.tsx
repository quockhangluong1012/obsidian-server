import { useRef, useState } from 'react'
import { useVault, getChildrenLive, findParentLive, type VaultState } from '../store/useVault'
import { FLAT } from '../mock/data'

type Kind = 'folder' | 'note' | 'asset'

export function Sidebar() {
  return (
    <aside className="hidden md:flex w-[294px] shrink-0 flex-col bg-[var(--drw)] border-r border-[var(--bd)]">
      <SidebarBody />
    </aside>
  )
}

export function SidebarBody() {
  const s = useVault()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const rows = buildRows(s, hoveredId, setHoveredId)
  const count = (() => {
    if (s.backendTree) {
      let notes = 0, folders = 0
      const walk = (nodes: any[]) => {
        for (const n of nodes) {
          if (n.kind === 'note') notes++
          else if (n.kind === 'folder') { folders++; if (n.children) walk(n.children) }
          else if (n.children) walk(n.children)
        }
      }
      walk(s.backendTree)
      return `${notes} notes · ${folders} thư mục`
    }
    return `${FLAT.filter((f) => f.kind === 'note').length} notes · ${FLAT.filter((f) => f.kind === 'folder').length} thư mục`
  })()
  const vaultCount = s.treeLoading && !s.backendTree ? 'Đang tải...' : count
  return (
    <>
      <div className="hidden md:flex items-center gap-0.5 h-[52px] px-1.5 pl-[14px] shrink-0">
        <span className="material-symbols-rounded text-[20px] text-[var(--pri)]">folder_open</span>
        <span className="text-[14px] font-medium tracking-[0.01em] ml-2 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
          Obsidian Vault
        </span>
        <button
          onClick={() => s.setPalette(true)}
          title="Tìm kiếm"
          className="tap grid place-items-center w-8 h-8 rounded-full bg-transparent text-[var(--tx2)] hover:bg-[var(--hov)] hover:text-[var(--pri)]"
        >
          <span className="material-symbols-rounded text-[19px]">search</span>
        </button>
        <button
          onClick={() => s.lockVault()}
          title="Khoá vault"
          className="tap grid place-items-center w-8 h-8 rounded-full bg-transparent text-[var(--tx2)] hover:bg-[var(--hov)] hover:text-[var(--pri)]"
        >
          <span className="material-symbols-rounded text-[19px]">lock</span>
        </button>
        <button
          onClick={() => s.toggleDark()}
          title="Đổi chế độ màu"
          className="tap grid place-items-center w-8 h-8 rounded-full bg-transparent text-[var(--tx2)] hover:bg-[var(--hov)] hover:text-[var(--pri)]"
        >
          <span className="material-symbols-rounded text-[19px]">{s.dark ? 'light_mode' : 'dark_mode'}</span>
        </button>
      </div>

      <div
        className="md:hidden flex items-center gap-2 px-4 shrink-0"
        style={{ height: 'calc(var(--bar-h) + var(--safe-t))', paddingTop: 'var(--safe-t)' }}
      >
        <span className="material-symbols-rounded text-[22px] text-[var(--pri)]">folder_open</span>
        <span className="font-display text-[18px] font-semibold flex-1">Obsidian Vault</span>
        <button
          onClick={() => s.lockVault()}
          className="tap grid place-items-center w-11 h-11 rounded-full text-[var(--tx2)]"
          aria-label="Khoá vault"
        >
          <span className="material-symbols-rounded text-[22px]">lock</span>
        </button>
      </div>

      <div className="flex items-center gap-1 px-2.5 pb-2.5 shrink-0">
        <button
          onClick={() => { s.startDraft('note'); s.setView('reading') }}
          className="tap flex items-center gap-1.5 h-11 md:h-8 px-3 rounded-[8px] md:rounded-[6px] bg-[var(--pri)] text-[var(--priC)] text-[14px] md:text-[12.5px] font-medium tracking-[0.02em]"
          style={{ boxShadow: '0 1px 3px rgba(31,34,60,.2)' }}
        >
          <span className="material-symbols-rounded text-[18px]">note_add</span>
          Note mới
        </button>
        <button
          onClick={() => s.startDraft('folder')}
          title="Thư mục mới"
          className="tap grid place-items-center w-11 h-11 md:w-8 md:h-8 rounded-[8px] md:rounded-[6px] border border-[var(--bd)] bg-transparent text-[var(--tx2)] hover:bg-[var(--hov)] hover:text-[var(--pri)]"
        >
          <span className="material-symbols-rounded text-[18px]">create_new_folder</span>
        </button>
        <div className="flex-1" />
        <button
          title="Sắp xếp"
          className="tap hidden md:grid place-items-center w-8 h-8 rounded-[6px] bg-transparent text-[var(--tx2)] hover:bg-[var(--hov)]"
        >
          <span className="material-symbols-rounded text-[18px]">sort</span>
        </button>
        <button
          onClick={() => s.collapseAll()}
          title="Thu gọn tất cả"
          className="tap grid place-items-center w-11 h-11 md:w-8 md:h-8 rounded-[8px] md:rounded-[6px] bg-transparent text-[var(--tx2)] hover:bg-[var(--hov)]"
        >
          <span className="material-symbols-rounded text-[18px]">unfold_less</span>
        </button>
      </div>

      <div
        ref={scrollRef}
        onDragOver={(e) => {
          if (!s.drag) return
          const parent = findParentLive(s.drag.id, s)
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
          const p = findParentLive(d.id, s)
          if (p === 'root') { s.setOver(null); s.setDrag(null); return }
          s.setOver(null); s.setDrag(null)
          s.moveNode(d.id, d.kind, 'root', d.name, 'Vault')
        }}
        className="flex-1 overflow-y-auto overscroll-contain px-2 pb-5 rounded-lg"
        style={{ boxShadow: s.over === 'root' ? `inset 0 0 0 2px var(--pri)` : 'none' }}
      >
        {rows}
      </div>

      <div className="flex items-center gap-2 h-12 md:h-10 px-4 md:px-3.5 shrink-0 border-t border-[var(--bd)] text-[var(--tx2)] text-xs">
        <span className="material-symbols-rounded text-[16px]">database</span>
        <span className="flex-1">{vaultCount}</span>
        <span className="material-symbols-rounded text-[17px] cursor-pointer">settings</span>
      </div>
    </>
  )
}

type DraftNonNull = { kind: 'folder' | 'note'; parent: string | null; name: string; error: string }

function buildRows(s: VaultState, hoveredId: string | null, setHoveredId: (id: string | null) => void): React.ReactElement[] {
  const out: React.ReactElement[] = []
  const exp = s.expanded
  const dense = s.density === 'compact'
  const step = dense ? 12 : 16
  const dragging = s.drag
  const draft: DraftNonNull | null = s.draft
  const isTouch = () => window.matchMedia('(hover: none)').matches
  const draftRow = (depth: number, key: string): void => {
    if (!draft) return
    const d = draft
    const refCb = (el: HTMLInputElement | null) => { if (el) el.focus() }
    out.push(
      <div key={key} className="flex flex-col gap-1 py-0.5 pb-1.5">
        <div
          className="flex items-center gap-2 h-12 md:h-[30px] rounded-[8px] md:rounded-[6px] pr-1.5 bg-[var(--bg)] border"
          style={{
            paddingLeft: 6 + depth * step,
            borderColor: d.error ? 'var(--warn)' : 'var(--pri)',
            boxShadow: `0 0 0 3px ${d.error ? 'rgba(194,65,12,.14)' : 'var(--sel)'}`,
            paddingBottom: 5,
          }}
        >
          <span className="w-4 shrink-0" />
          <span className="material-symbols-rounded text-[18px] md:text-[17px] shrink-0 text-[var(--pri)]">
            {d.kind === 'folder' ? 'create_new_folder' : 'note_add'}
          </span>
          <input
            ref={refCb}
            defaultValue={d.name}
            onChange={(e) => s.setDraft({ kind: d.kind, parent: d.parent, name: e.target.value, error: '' })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); s.commitDraft() }
              if (e.key === 'Escape') { e.preventDefault(); s.cancelDraft() }
            }}
            onBlur={() => s.commitDraft()}
            placeholder={d.kind === 'folder' ? 'Tên thư mục mới' : 'Tên note mới'}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            className="flex-1 min-w-0 border-0 outline-0 bg-transparent text-[15px] md:text-[13.5px] text-[var(--tx)]"
          />
        </div>
        <div
          className="flex items-center gap-1.5 text-[12px] md:text-[11.5px]"
          style={{ paddingLeft: 6 + depth * step, color: d.error ? 'var(--warn)' : 'var(--tx2)',
            paddingBottom: 5, fontSize: 12
           }}
        >
          <span className="material-symbols-rounded text-[15px] md:text-[14px]">{d.error ? 'error' : 'keyboard_return'}</span>
          {d.error || 'Enter để lưu · Esc để huỷ'}
        </div>
      </div>,
    )
  }

  const canDropOn = (targetId: string): boolean => {
    const dd = s.drag
    if (!dd) return false
    if (dd.id === targetId) return false
    const parent = findParentLive(dd.id, s)
    if (parent === targetId) return false
    if (dd.kind === 'folder') {
      let hit = false
      const walk = (pid: string | null): void => {
        for (const n of getChildrenLive(pid, s)) {
          if (hit) return
          if (n.id === targetId) { hit = true; return }
          if (n.children) walk(n.id)
        }
      }
      walk(dd.id)
      if (hit) return false
    }
    return true
  }

  const walk = (parentId: string | null, depth: number): void => {
    const children = getChildrenLive(parentId, s)
    children.forEach((n, idx) => {
      const isFolder = !!n.children
      const isAsset = !!n.asset
      const assetMime = isAsset ? (n.asset?.mime ?? '') : ''
      const kind: Kind = isFolder ? 'folder' : isAsset ? 'asset' : 'note'
      const open = !!exp[n.id]
      const active = s.active === n.id || (isAsset && s.assetOpen === n.id)
      const marked = isFolder && s.folder === n.id
      const k = `${parentId || 'root'}-${n.id}-${idx}`

      out.push(
        <div
          key={k}
          onClick={() => {
            if (isFolder) { s.toggle(n.id); useVault.setState({ folder: n.id }) }
            else if (isAsset) { s.openAsset(n.id); s.setView('reading') }
            else { s.openNote(n.id); s.setView('reading') }
          }}
          onContextMenu={(e) => {
            e.preventDefault()
            const vw = window.innerWidth
            useVault.setState({
              folder: isFolder ? n.id : s.folder,
              menu: {
                x: Math.min(e.clientX, Math.max(0, vw - 246)),
                y: e.clientY,
                name: n.name,
                id: n.id,
                kind,
              },
            })
          }}
          onMouseEnter={() => { if (!isTouch()) setHoveredId(n.id) }}
          onMouseLeave={() => { if (hoveredId === n.id) setHoveredId(null) }}
          draggable
          onDragStart={(e) => {
            if (e.dataTransfer) {
              e.dataTransfer.effectAllowed = 'move'
              try { e.dataTransfer.setData('text/plain', n.id) } catch {}
            }
            s.setMenu(null)
            s.setDrag({ id: n.id, name: n.name, kind })
          }}
          onDragEnd={() => { s.setDrag(null); s.setOver(null) }}
          onDragOver={isFolder ? (e) => {
            if (!canDropOn(n.id)) return
            e.preventDefault(); e.stopPropagation()
            if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
            if (s.over !== n.id) s.setOver(n.id)
          } : (e) => {
            if (!s.drag) return
            e.stopPropagation()
            if (s.over) s.setOver(null)
          }}
          onDragLeave={isFolder ? () => { if (s.over === n.id) s.setOver(null) } : undefined}
          onDrop={isFolder ? (e) => {
            e.preventDefault(); e.stopPropagation()
            const dd = s.drag
            if (!dd || !canDropOn(n.id)) { s.setDrag(null); s.setOver(null); return }
            s.setDrag(null); s.setOver(null)
            s.moveNode(dd.id, dd.kind, n.id, dd.name, n.name)
          } : undefined}
          className="tap flex items-center gap-2 md:gap-[5px] h-12 md:h-[30px] rounded-[8px] md:rounded-[6px] cursor-pointer pr-2 select-none"
          style={{
            paddingLeft: 6 + depth * step,
            background: active
              ? 'var(--sel)'
              : marked
                ? 'var(--hov)'
                : !active && hoveredId === n.id && !dragging
                  ? 'var(--hov)'
                  : 'transparent',
            color: active ? 'var(--pri)' : 'var(--tx)',
            fontWeight: active || isFolder ? 500 : 400,
            fontSize: '15px',
            opacity: dragging && dragging.id === n.id ? 0.42 : 1,
            boxShadow: isFolder && s.over === n.id ? `inset 0 0 0 2px var(--pri)` : 'none',
            transition: 'background-color .12s ease',
          }}
        >
          <span
            className="material-symbols-rounded text-[18px] md:text-[16px] w-4 shrink-0 opacity-80 transition-transform duration-150"
            style={{ transform: `rotate(${isFolder && open ? 90 : 0}deg)` }}
          >
            {isFolder ? 'chevron_right' : ''}
          </span>
          <span
            className="material-symbols-rounded text-[19px] md:text-[17px] shrink-0"
            style={{ color: isFolder ? 'var(--pri)' : isAsset ? '#C48A2F' : 'var(--tx2)' }}
          >
            {isFolder
              ? (open ? 'folder_open' : 'folder')
              : isAsset
                ? (/svg/.test(assetMime) ? 'shapes' : /^image\//.test(assetMime) ? 'image' : /json|text/.test(assetMime) ? 'code' : 'draft')
                : 'description'}
          </span>
          <span className="overflow-hidden text-ellipsis whitespace-nowrap">{n.name}</span>
        </div>,
      )
      if (isFolder && open) walk(n.id, depth + 1)
    })
    if (draft && draft.parent === parentId) draftRow(depth, `${parentId || 'root'}-draft`)
    else if (parentId && exp[parentId] && children.length === 0) {
      out.push(
        <div
          key={`${parentId}-empty`}
          className="py-1 pr-2 text-xs text-[var(--tx2)] opacity-80"
          style={{ paddingLeft: 6 + depth * step }}
        >
          Thư mục trống
        </div>,
      )
    }
  }
  walk(null, 0)
  return out
}
