import { useEffect, useState } from 'react'
import { useVault, folderOptionsLive, getChildrenLive } from '../store/useVault'
import type { VaultState, Asset } from '../store/useVault'
import { FLAT } from '../mock/data'
import { useViewport } from '../hooks/useViewport'
import { SvgLightbox } from './SvgLightbox'

function AssetLightboxH(props: { src: string; alt: string; open: boolean; onClose: () => void }) {
  return <SvgLightbox {...props} />
}

const TEXT_MIME = new Set(['application/json', 'text/plain', 'text/markdown', 'text/csv'])

function AssetPreview({ asset }: { asset: Asset }) {
  const isImage = /^image\//.test(asset.mime)
  const isText = TEXT_MIME.has(asset.mime)
  const [imgFailed, setImgFailed] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [text, setText] = useState<string | null>(null)
  const [textError, setTextError] = useState<string | null>(null)

  useEffect(() => {
    setImgFailed(false)
    setText(null)
    setTextError(null)
    if (!isText) return
    let cancelled = false
    fetch(asset.url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.text()
      })
      .then((body) => {
        if (cancelled) return
        if (asset.mime === 'application/json') {
          try { body = JSON.stringify(JSON.parse(body), null, 2) } catch { /* leave as-is if not valid JSON */ }
        }
        setText(body)
      })
      .catch((e) => { if (!cancelled) setTextError(e.message || 'Không tải được nội dung') })
    return () => { cancelled = true }
  }, [asset.url, asset.mime, isText])

  if (isImage && !imgFailed) {
    return (
      <>
        <div className="relative group rounded-[10px] border border-[var(--bd)] bg-[var(--surf)] p-3 grid place-items-center">
          <img
            alt={asset.name}
            src={asset.url}
            onError={() => setImgFailed(true)}
            onClick={() => setLightboxOpen(true)}
            className="max-w-full max-h-[60dvh] md:max-h-[42dvh] h-auto block cursor-zoom-in"
            loading="lazy"
          />
          <button
            onClick={() => setLightboxOpen(true)}
            className="absolute bottom-2 right-2 grid place-items-center w-8 h-8 rounded-full bg-white/90 shadow border border-black/5 text-[var(--tx)] opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="Phóng to"
          >
            <span className="material-symbols-rounded text-[18px]">zoom_in</span>
          </button>
        </div>
        {/* lazy import to avoid cycle - use dynamic */}
        <AssetLightboxH src={asset.url} alt={asset.name} open={lightboxOpen} onClose={() => setLightboxOpen(false)} />
      </>
    )
  }
  if (isImage && imgFailed) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-[10px] border border-dashed border-[var(--bd)] bg-[var(--surf)] p-8 text-center text-[var(--tx2)]">
        <span className="material-symbols-rounded text-[28px] opacity-70">broken_image</span>
        <span className="text-[13px]">Không tải được ảnh — kiểm tra server hoặc đường dẫn tệp.</span>
      </div>
    )
  }
  if (isText) {
    if (textError) {
      return (
        <div className="flex flex-col items-center justify-center gap-2 rounded-[10px] border border-dashed border-[var(--bd)] bg-[var(--surf)] p-8 text-center text-[var(--tx2)]">
          <span className="material-symbols-rounded text-[28px] opacity-70">error</span>
          <span className="text-[13px]">Không tải được nội dung: {textError}</span>
        </div>
      )
    }
    return (
      <pre className="max-h-[60dvh] md:max-h-[42dvh] overflow-auto rounded-[10px] border border-[var(--bd)] bg-[var(--code)] p-3.5 font-mono text-[12.5px] leading-[1.6] whitespace-pre-wrap break-words">
        {text ?? 'Đang tải…'}
      </pre>
    )
  }
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-[10px] border border-dashed border-[var(--bd)] bg-[var(--surf)] p-8 text-center text-[var(--tx2)]">
      <span className="material-symbols-rounded text-[28px] opacity-70">draft</span>
      <span className="text-[13px]">Không hỗ trợ xem trước cho loại tệp này ({asset.mime}).</span>
    </div>
  )
}

export function Overlays() {
  const s = useVault()
  const { isPhone } = useViewport()
  const menuKind = s.menu?.kind ?? 'folder'
  const openAsset = s.assetOpen ? s.assets.find((a) => a.id === s.assetOpen) : null

  const q = s.query.trim().toLowerCase()
  // Prefer backend paletteResults if available, fallback to FLAT
  const paletteResults = s.paletteResults.length
    ? s.paletteResults.slice(0, 8).map((f) => ({
        name: f.name,
        path: f.path || '',
        kind: f.kind,
        icon: f.kind === 'folder' ? 'folder' : 'description',
        col: f.kind === 'folder' ? s.accent : 'var(--tx2)',
        onClick: () =>
          f.kind === 'folder'
            ? useVault.setState({
                folder: f.id,
                palette: false,
                expanded: { ...s.expanded, [f.id]: true },
              })
            : s.openNote(f.id),
      }))
    : FLAT.filter((f) => !q || f.name.toLowerCase().includes(q))
        .slice(0, 8)
        .map((f) => ({
          name: f.name,
          path: f.path,
          kind: f.kind,
          icon: f.kind === 'folder' ? 'folder' : 'description',
          col: f.kind === 'folder' ? s.accent : 'var(--tx2)',
          onClick: () =>
            f.kind === 'folder'
              ? useVault.setState({
                  folder: f.id,
                  palette: false,
                  expanded: { ...s.expanded, [f.id]: true },
                })
              : s.openNote(f.id),
        }))

  const handleRename = async () => {
    const cur = s.menu
    if (!cur) return
    const nv = window.prompt('Tên mới', cur.name)
    if (!nv || !nv.trim() || nv.trim() === cur.name) { s.setMenu(null); return }
    try { await s.renameNode(cur.id, cur.kind as any, nv.trim()); s.setMenu(null) } catch {}
  }
  const handleDelete = async () => {
    const cur = s.menu
    if (!cur) return
    if (!window.confirm(`Xoá ${cur.kind} “${cur.name}”?`)) return
    try { await s.deleteNode(cur.id, cur.kind as any) } catch {}
  }
  const handleDuplicate = async () => {
    const cur = s.menu
    if (!cur || cur.kind !== 'note') return
    s.setMenu(null)
    await s.duplicateNote(cur.id)
  }

  const folderItems = [
    { icon: 'note_add', label: 'Note mới', col: 'var(--tx)', onClick: () => { s.startDraft('note', s.menu!.id); s.setMenu(null) } },
    { icon: 'create_new_folder', label: 'Thư mục con mới', col: 'var(--tx)', onClick: () => { s.startDraft('folder', s.menu!.id); s.setMenu(null) } },
    { icon: 'drive_file_move', label: 'Di chuyển tới…', col: 'var(--tx)', onClick: () => s.setMove({ id: s.menu!.id, name: s.menu!.name, kind: 'folder', path: '', target: null }) },
    { icon: 'drive_file_rename_outline', label: 'Đổi tên', col: 'var(--tx)', onClick: handleRename },
    { icon: 'delete', label: 'Xoá thư mục', col: 'var(--warn)', onClick: handleDelete },
  ]
  const assetItems = [
    { icon: 'visibility', label: 'Xem tệp đính kèm', col: 'var(--tx)', onClick: () => { s.setAssetOpen(s.menu!.id); s.setMenu(null) } },
    { icon: 'drive_file_move', label: 'Di chuyển tới…', col: 'var(--tx)', onClick: () => s.setMove({ id: s.menu!.id, name: s.menu!.name, kind: 'asset', path: (s.assets.find((a) => a.id === s.menu!.id)?.path ?? ''), target: null }) },
    { icon: 'link', label: 'Sao chép đường dẫn', col: 'var(--tx)', onClick: () => {
      const a = s.assets.find((x) => x.id === s.menu!.id)
      if (a && navigator.clipboard) navigator.clipboard.writeText(a.path)
      s.setMenu(null)
      s.showToast('Đã sao chép ' + (a?.path ?? ''))
    } },
    { icon: 'drive_file_rename_outline', label: 'Đổi tên', col: 'var(--tx)', onClick: handleRename },
    { icon: 'delete', label: 'Xoá tệp trên server', col: 'var(--warn)', onClick: handleDelete },
  ]
  const noteItems = [
    { icon: 'drive_file_move', label: 'Di chuyển tới…', col: 'var(--tx)', onClick: () => s.setMove({ id: s.menu!.id, name: s.menu!.name, kind: 'note', path: '', target: null }) },
    { icon: 'drive_file_rename_outline', label: 'Đổi tên', col: 'var(--tx)', onClick: handleRename },
    { icon: 'content_copy', label: 'Nhân bản', col: 'var(--tx)', onClick: handleDuplicate },
    { icon: 'delete', label: 'Xoá note', col: 'var(--warn)', onClick: handleDelete },
  ]
  const menuItems = menuKind === 'folder' ? folderItems : menuKind === 'asset' ? assetItems : noteItems

  const kindLabel: Record<string, string> = { folder: 'Thư mục', note: 'Note', asset: 'Tệp đính kèm' }

  return (
    <>
      {/* toast */}
      {s.toast && (
        <div
          className="fixed left-1/2 -translate-x-1/2 md:left-6 md:translate-x-0 bottom-24 md:bottom-12 z-[80] flex items-center gap-2.5 px-4 py-3 rounded-full md:rounded-[10px] bg-[var(--pri)] text-[var(--priC)] text-[14px] max-w-[calc(100vw-32px)]"
          style={{ boxShadow: '0 6px 20px rgba(20,22,45,.28)' }}
          role="status"
        >
          <span className="material-symbols-rounded text-lg">check_circle</span>
          <span className="flex-1 truncate">{s.toast}</span>
          <span
            onClick={() => useVault.setState({ toast: '' })}
            className="material-symbols-rounded text-[19px] opacity-80 cursor-pointer p-1"
            aria-label="Đóng"
          >
            close
          </span>
        </div>
      )}

      {/* upload */}
      {s.upload && (
        <div
          className="fixed right-3 md:right-5 bottom-[calc(var(--bar-h)+var(--safe-b)+12px)] md:bottom-6 z-[98] w-[min(92vw,360px)] p-3 rounded-xl bg-[var(--bg)] border border-[var(--bd)]"
          style={{ boxShadow: '0 12px 34px rgba(16,18,40,.22)' }}
        >
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-rounded text-xl" style={{ color: s.upload.phase === 'done' ? 'var(--ok)' : s.accent }}>
              {s.upload.phase === 'done' ? 'cloud_done' : 'cloud_upload'}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[14px] md:text-[13.5px] font-medium overflow-hidden text-ellipsis whitespace-nowrap">{s.upload.name}</div>
              <div className="text-[12px] md:text-[11.5px] text-[var(--tx2)]">
                {s.upload.phase === 'done' ? `Đã lưu trên server · ${s.upload.size}` : 'Đang tải lên server…'}
              </div>
            </div>
          </div>
          <div className="mt-2.5 h-[3px] rounded-full bg-[var(--surf)] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: s.upload.phase === 'done' ? '100%' : '62%',
                background: s.upload.phase === 'done' ? 'var(--ok)' : s.accent,
              }}
            />
          </div>
          <code className="block mt-2 font-mono text-[11px] text-[var(--tx2)] overflow-hidden text-ellipsis whitespace-nowrap">
            {s.upload.path}
          </code>
        </div>
      )}

      {/* context menu — phone becomes a bottom action sheet, desktop keeps the floating popover */}
      {s.menu && !isPhone && (
        <div onClick={() => s.setMenu(null)} onContextMenu={(e) => { e.preventDefault(); s.setMenu(null) }} className="fixed inset-0 z-[90]">
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute w-[230px] p-1.5 rounded-lg bg-[var(--bg)] border border-[var(--bd)]"
            style={{ left: s.menu.x, top: s.menu.y, boxShadow: '0 6px 24px rgba(20,22,45,.22)' }}
          >
            <div className="px-3 pt-2 pb-1.5 text-[11px] tracking-[0.06em] uppercase text-[var(--tx2)] overflow-hidden text-ellipsis whitespace-nowrap">
              {s.menu.name}
            </div>
            {menuItems.map((mi, i) => (
              <div
                key={i}
                onClick={mi.onClick}
                className="tap flex items-center gap-3 px-3 py-2.5 md:py-2 rounded-md text-[14px] md:text-[13px] hover:bg-[var(--hov)]"
                style={{ color: mi.col }}
              >
                <span className="material-symbols-rounded text-[20px] md:text-lg opacity-85">{mi.icon}</span>
                {mi.label}
              </div>
            ))}
          </div>
        </div>
      )}
      {s.menu && isPhone && (
        <ActionSheet
          title={s.menu.name}
          onClose={() => s.setMenu(null)}
          items={menuItems}
        />
      )}

      {/* asset viewer */}
      {openAsset && (
        <div onClick={() => s.setAssetOpen(null)} className="fixed inset-0 z-[96] flex items-end md:items-center justify-center md:p-6 bg-[rgba(18,20,38,.5)]">
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full md:w-[560px] md:max-w-full max-h-[92dvh] md:max-h-[86dvh] flex flex-col rounded-t-[22px] md:rounded-[14px] bg-[var(--bg)] border border-[var(--bd)] overflow-hidden"
            style={{ boxShadow: '0 20px 54px rgba(16,18,40,.38)', paddingBottom: 'var(--safe-b)' }}
          >
            <div className="md:hidden self-center w-10 h-1 rounded-full bg-[var(--bd)] mt-2" />
            <div className="flex items-center gap-2.5 p-4 md:p-3.5 px-5 md:px-4 shrink-0 border-b border-[var(--bd)]">
              <span className="material-symbols-rounded text-xl text-[#C48A2F]">attachment</span>
              <div className="min-w-0 flex-1">
                <div className="text-[15px] md:text-[14.5px] font-medium overflow-hidden text-ellipsis whitespace-nowrap">{openAsset.name}</div>
                <div className="text-[12px] md:text-[11.5px] text-[var(--tx2)]">{openAsset.mime} · {openAsset.size}</div>
              </div>
              <span
                onClick={() => s.setAssetOpen(null)}
                className="tap grid place-items-center w-11 h-11 md:w-[34px] md:h-[34px] shrink-0 rounded-full material-symbols-rounded text-[20px] md:text-[19px] text-[var(--tx2)] hover:bg-[var(--hov)]"
              >
                close
              </span>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-3.5">
              <AssetPreview asset={openAsset} />
              <div className="flex flex-col gap-2.5">
                <div className="flex flex-col gap-1">
                  <div className="text-[11px] tracking-[0.06em] uppercase text-[var(--tx2)]">Đường dẫn vật lý (cố định)</div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 min-w-0 font-mono text-[13px] md:text-[12.5px] p-2 md:p-[7px_10px] rounded-[8px] md:rounded-[6px] bg-[var(--code)] overflow-hidden text-ellipsis whitespace-nowrap">
                      {openAsset.path}
                    </code>
                    <span
                      onClick={() => {
                        if (navigator.clipboard) navigator.clipboard.writeText(openAsset.path)
                        s.showToast('Đã sao chép ' + openAsset.path)
                      }}
                      className="tap grid place-items-center w-11 h-11 md:w-[34px] md:h-[34px] shrink-0 rounded-[8px] md:rounded-[6px] border border-[var(--bd)] material-symbols-rounded text-[18px] md:text-[17px] text-[var(--tx2)] hover:bg-[var(--hov)]"
                    >
                      content_copy
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <div className="text-[11px] tracking-[0.06em] uppercase text-[var(--tx2)]">Vị trí hiển thị</div>
                  <div className="flex items-center gap-2 text-[14px] md:text-[13.5px]">
                    <span className="material-symbols-rounded text-[18px] md:text-[17px] text-[var(--pri)]">folder</span>
                    {pathToAsset(openAsset.id) || 'Vault'}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-3 md:p-3 px-5 md:px-4 shrink-0 border-t border-[var(--bd)]">
              <span
                onClick={() => s.setAssetOpen(null)}
                className="tap grid place-items-center h-12 md:h-[38px] px-5 md:px-4 rounded-full md:rounded-lg text-[14px] md:text-[13px] text-[var(--tx2)] hover:bg-[var(--hov)]"
              >
                Đóng
              </span>
              <span
                onClick={() => {
                  const a = openAsset
                  s.setAssetOpen(null)
                  s.setMove({ id: a.id, name: a.name, kind: 'asset', path: a.path, target: null })
                }}
                className="tap flex items-center gap-2 h-12 md:h-[38px] px-5 md:px-4 rounded-full md:rounded-lg text-[14px] md:text-[13px] font-medium bg-[var(--pri)] text-[var(--priC)]"
              >
                <span className="material-symbols-rounded text-[18px] md:text-[17px]">drive_file_move</span>
                Di chuyển tới…
              </span>
            </div>
          </div>
        </div>
      )}

      {/* move dialog */}
      {s.move && (
        <div onClick={() => s.setMove(null)} className="fixed inset-0 z-[97] flex items-end md:items-center justify-center md:p-6 bg-[rgba(18,20,38,.5)]">
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full md:w-[460px] md:max-w-full max-h-[88dvh] md:max-h-[82dvh] flex flex-col rounded-t-[22px] md:rounded-[14px] bg-[var(--bg)] border border-[var(--bd)] overflow-hidden"
            style={{ boxShadow: '0 20px 54px rgba(16,18,40,.38)', paddingBottom: 'var(--safe-b)' }}
          >
            <div className="md:hidden self-center w-10 h-1 rounded-full bg-[var(--bd)] mt-2" />
            <div className="p-5 md:p-4 md:px-[18px] md:pb-3 shrink-0 border-b border-[var(--bd)]">
              <div className="text-[11px] tracking-[0.06em] uppercase text-[var(--tx2)]">{kindLabel[s.move.kind]}</div>
              <div className="mt-1 text-[16px] md:text-[15.5px] font-semibold overflow-hidden text-ellipsis whitespace-nowrap">{s.move.name}</div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-2">
              {folderOptionsLive(s).map((f) => (
                <div
                  key={f.id}
                  onClick={() => s.setMove({ ...s.move!, target: f.id, targetName: f.name })}
                  className="tap flex items-center gap-3 h-12 md:h-[38px] rounded-[8px] md:rounded-[7px] text-[14px] md:text-[13px] pr-4 md:pr-3 hover:bg-[var(--hov)]"
                  style={{
                    paddingLeft: 12 + f.depth * 16,
                    background: s.move?.target === f.id ? 'var(--sel)' : 'transparent',
                    color: s.move?.target === f.id ? 'var(--pri)' : 'var(--tx)',
                  }}
                >
                  <span className="material-symbols-rounded text-[18px] md:text-[17px] text-[var(--pri)] shrink-0">
                    {f.id === 'root' ? 'inventory_2' : 'folder'}
                  </span>
                  <span className="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{f.name}</span>
                  <span className="material-symbols-rounded text-[18px] md:text-[17px] shrink-0">
                    {s.move?.target === f.id ? 'check' : ''}
                  </span>
                </div>
              ))}
            </div>
            <div className="shrink-0 border-t border-[var(--bd)]">
              <div className="flex gap-2 p-3 md:p-3 px-4 md:px-4 text-[13px] md:text-xs leading-[1.55] text-[var(--tx2)] bg-[var(--surf)]">
                <span className="material-symbols-rounded text-[18px] md:text-base shrink-0 text-[var(--pri)]">info</span>
                <span>
                  {s.move.kind === 'asset'
                    ? `Chỉ vị trí hiển thị thay đổi. Đường dẫn vật lý ${s.move.path || ''} giữ nguyên, mọi note đang nhúng tệp này không bị ảnh hưởng.`
                    : 'Chỉ vị trí hiển thị trong cây thư mục thay đổi. Các liên kết tới tệp đính kèm bên trong note giữ nguyên đường dẫn vật lý.'}
                </span>
              </div>
              <div className="flex justify-end gap-2 p-3 md:p-3 px-4 md:px-4">
                <span
                  onClick={() => s.setMove(null)}
                  className="tap grid place-items-center h-12 md:h-[38px] px-5 md:px-4 rounded-full md:rounded-lg text-[14px] md:text-[13px] text-[var(--tx2)] hover:bg-[var(--hov)]"
                >
                  Huỷ
                </span>
                <span
                  onClick={() => s.applyMove()}
                  className="tap grid place-items-center h-12 md:h-[38px] px-6 md:px-[18px] rounded-full md:rounded-lg text-[14px] md:text-[13px] font-medium"
                  style={{
                    background: s.move.target ? 'var(--pri)' : 'var(--bd)',
                    color: s.move.target ? 'var(--priC)' : 'var(--tx2)',
                  }}
                >
                  Di chuyển
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* palette (command + search) */}
      {s.palette && (
        <div
          onClick={() => s.setPalette(false)}
          className="fixed inset-0 z-[95] flex items-end md:items-start justify-center md:pt-[12vh] md:bg-[rgba(18,20,38,.42)]"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full md:w-[620px] md:max-w-[92vw] h-[88dvh] md:h-fit md:max-h-[80vh] flex flex-col rounded-t-[22px] md:rounded-xl bg-[var(--bg)] border border-[var(--bd)] overflow-hidden"
            style={{ boxShadow: '0 18px 50px rgba(16,18,40,.35)', paddingBottom: 'var(--safe-b)' }}
          >
            <div className="md:hidden self-center w-10 h-1 rounded-full bg-[var(--bd)] mt-2" />
            <div className="flex items-center gap-3 px-4 md:px-3.5 h-14 md:h-[58px] shrink-0 border-b border-[var(--bd)]">
              <span className="material-symbols-rounded text-[22px] md:text-xl text-[var(--pri)]">search</span>
              <input
                autoFocus
                value={s.query}
                onChange={(e) => s.setQuery(e.target.value)}
                placeholder="Tìm note, thư mục hoặc lệnh…"
                className="flex-1 min-w-0 border-0 outline-0 bg-transparent text-base text-[var(--tx)]"
                style={{ fontSize: '16px' }}
              />
              <span
                onClick={() => s.setPalette(false)}
                className="tap grid place-items-center w-11 h-11 md:w-9 md:h-9 shrink-0 rounded-full material-symbols-rounded text-[22px] md:text-xl text-[var(--tx2)]"
              >
                close
              </span>
            </div>
            <div className="flex-1 md:max-h-[46vh] overflow-y-auto p-2">
              {paletteResults.map((r, i) => (
                <div
                  key={i}
                  onClick={() => { r.onClick(); if (r.kind === 'note') s.setView?.('reading') }}
                  className="tap flex items-center gap-3 p-3 md:p-2.5 md:px-3 rounded-[8px] md:rounded-lg hover:bg-[var(--hov)]"
                >
                  <span className="material-symbols-rounded text-[20px] md:text-[19px]" style={{ color: r.col }}>{r.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[15px] md:text-sm overflow-hidden text-ellipsis whitespace-nowrap">{r.name}</div>
                    <div className="text-[12px] md:text-[11.5px] text-[var(--tx2)] overflow-hidden text-ellipsis whitespace-nowrap">{r.path}</div>
                  </div>
                  <span className="font-mono text-[11px] text-[var(--tx2)]">{r.kind}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function ActionSheet({
  title,
  items,
  onClose,
}: {
  title: string
  items: { icon: string; label: string; col: string; onClick: () => void }[]
  onClose: () => void
}) {
  return (
    <div onClick={onClose} className="fixed inset-0 z-[90] flex items-end bg-[rgba(18,20,38,.5)]">
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full flex flex-col rounded-t-[22px] bg-[var(--bg)] border-t border-[var(--bd)]"
        style={{ boxShadow: '0 -16px 40px rgba(10,12,24,.28)', paddingBottom: 'var(--safe-b)' }}
      >
        <div className="self-center w-10 h-1 rounded-full bg-[var(--bd)] mt-2" />
        <div className="px-5 pt-3 pb-2 text-[12px] tracking-[0.06em] uppercase text-[var(--tx2)] overflow-hidden text-ellipsis whitespace-nowrap">
          {title}
        </div>
        <div className="flex flex-col p-2">
          {items.map((mi, i) => (
            <button
              key={i}
              onClick={() => { mi.onClick(); onClose() }}
              className="tap flex items-center gap-4 h-14 px-3 rounded-[10px] text-[15px] text-left hover:bg-[var(--hov)]"
              style={{ color: mi.col }}
            >
              <span className="material-symbols-rounded text-[22px] opacity-90">{mi.icon}</span>
              {mi.label}
            </button>
          ))}
          <button
            onClick={onClose}
            className="tap mt-2 h-12 rounded-[10px] text-[14px] text-[var(--tx2)] bg-[var(--surf)]"
          >
            Huỷ
          </button>
        </div>
      </div>
    </div>
  )
}

function pathToAsset(id: string): string {
  const s = useVault.getState() as VaultState
  const out: string[] = []
  const scan = (pid: string | null, trail: string[]) => {
    for (const n of getChildrenLive(pid, s)) {
      if (n.id === id) { out.push(...trail); return }
      if (n.children) scan(n.id, [...trail, n.name])
    }
  }
  scan(null, [])
  return out.join(' / ')
}
