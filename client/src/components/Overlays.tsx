import { useVault, folderOptionsLive, getChildrenLive } from '../store/useVault'
import { FLAT } from '../mock/data'

export function Overlays() {
  const s = useVault()
  const menuKind = s.menu?.kind ?? 'folder'
  const openAsset = s.assetOpen ? s.assets.find(a => a.id === s.assetOpen) : null

  const q = s.query.trim().toLowerCase()
  const paletteResults = FLAT.filter(f => !q || f.name.toLowerCase().includes(q)).slice(0, 8).map(f => ({
    name: f.name, path: f.path, kind: f.kind, icon: f.kind==='folder'?'folder':'description', col: f.kind==='folder'? s.accent : '#6B6F80',
    onClick: () => f.kind==='folder' ? (useVault.setState({ folder: f.id, palette:false, expanded: {...s.expanded, [f.id]:true}})) : s.openNote(f.id)
  }))

  const folderItems = [
    { icon:'note_add', label:'Note mới', col:'var(--tx)', onClick:()=> s.startDraft('note', s.menu!.id)},
    { icon:'create_new_folder', label:'Thư mục con mới', col:'var(--tx)', onClick:()=> s.startDraft('folder', s.menu!.id)},
    { icon:'drive_file_move', label:'Di chuyển tới…', col:'var(--tx)', onClick:()=> s.setMove({ id: s.menu!.id, name: s.menu!.name, kind:'folder', path:'', target:null })},
    { icon:'drive_file_rename_outline', label:'Đổi tên', col:'var(--tx)', onClick:()=> s.setMenu(null)},
    { icon:'delete', label:'Xoá thư mục', col:'#D64550', onClick:()=> s.setMenu(null)},
  ]
  const assetItems = [
    { icon:'visibility', label:'Xem tệp đính kèm', col:'var(--tx)', onClick:()=>{ s.setAssetOpen(s.menu!.id); s.setMenu(null)}},
    { icon:'drive_file_move', label:'Di chuyển tới…', col:'var(--tx)', onClick:()=> s.setMove({ id: s.menu!.id, name: s.menu!.name, kind:'asset', path: (s.assets.find(a=>a.id===s.menu!.id)?.path ?? ''), target:null })},
    { icon:'link', label:'Sao chép đường dẫn', col:'var(--tx)', onClick:()=>{ const a=s.assets.find(x=>x.id===s.menu!.id); if(a && navigator.clipboard) navigator.clipboard.writeText(a.path); s.setMenu(null); s.showToast('Đã sao chép '+ (a?.path??''))}},
    { icon:'drive_file_rename_outline', label:'Đổi tên', col:'var(--tx)', onClick:()=>s.setMenu(null)},
    { icon:'delete', label:'Xoá tệp trên server', col:'#D64550', onClick:()=>s.setMenu(null)},
  ]
  const noteItems = [
    { icon:'drive_file_move', label:'Di chuyển tới…', col:'var(--tx)', onClick:()=> s.setMove({ id: s.menu!.id, name: s.menu!.name, kind:'note', path:'', target:null })},
    { icon:'drive_file_rename_outline', label:'Đổi tên', col:'var(--tx)', onClick:()=>s.setMenu(null)},
    { icon:'content_copy', label:'Nhân bản', col:'var(--tx)', onClick:()=>s.setMenu(null)},
    { icon:'delete', label:'Xoá note', col:'#D64550', onClick:()=>s.setMenu(null)},
  ]
  const menuItems = menuKind==='folder' ? folderItems : menuKind==='asset' ? assetItems : noteItems

  const kindLabel: Record<string,string> = { folder:'Thư mục', note:'Note', asset:'Tệp đính kèm' }

  return (
    <>
      {s.toast && (
        <div className="fixed left-6 bottom-12 z-[80] flex items-center gap-2.5 px-4 py-3 rounded-[10px] bg-[var(--pri)] text-[var(--priC)] shadow-[0_6px_20px_rgba(20,22,45,.28)] text-[13.5px] max-w-[380px]">
          <span className="material-symbols-rounded text-lg">check_circle</span>
          <span className="flex-1">{s.toast}</span>
          <span onClick={()=> (useVault.setState({ toast:''}))} className="material-symbols-rounded text-[19px] opacity-80 cursor-pointer p-1">close</span>
        </div>
      )}

      {s.upload && (
        <div className="fixed right-5 bottom-6 z-[98] w-[320px] max-w-[calc(100vw-32px)] p-3 rounded-xl bg-[var(--bg)] border border-[var(--bd)] shadow-[0_12px_34px_rgba(16,18,40,.22)]">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-rounded text-xl" style={{ color: s.upload.phase==='done' ? '#2E9E6B' : s.accent }}>{s.upload.phase==='done' ? 'cloud_done' : 'cloud_upload'}</span>
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-medium overflow-hidden text-ellipsis whitespace-nowrap">{s.upload.name}</div>
              <div className="text-[11.5px] text-[var(--tx2)]">{s.upload.phase==='done' ? `Đã lưu trên server · ${s.upload.size}` : 'Đang tải lên server…'}</div>
            </div>
          </div>
          <div className="mt-2.5 h-[3px] rounded-full bg-[var(--surf)] overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: s.upload.phase==='done'?'100%':'62%', background: s.upload.phase==='done'?'#2E9E6B': s.accent }} />
          </div>
          <code className="block mt-2 font-mono text-[11px] text-[var(--tx2)] overflow-hidden text-ellipsis whitespace-nowrap">{s.upload.path}</code>
        </div>
      )}

      {s.menu && (
        <div onClick={()=>s.setMenu(null)} onContextMenu={(e)=>{e.preventDefault(); s.setMenu(null)}} className="fixed inset-0 z-[90]">
          <div onClick={e=>e.stopPropagation()} className="absolute w-[230px] p-1.5 rounded-lg bg-[var(--bg)] border border-[var(--bd)] shadow-[0_6px_24px_rgba(20,22,45,.22)]" style={{ left: s.menu.x, top: s.menu.y }}>
            <div className="px-3 pt-2 pb-1.5 text-[11px] tracking-[0.06em] uppercase text-[var(--tx2)] overflow-hidden text-ellipsis whitespace-nowrap">{s.menu.name}</div>
            {menuItems.map((mi,i)=>(
              <div key={i} onClick={mi.onClick} className="flex items-center gap-2.5 px-3 py-2 rounded-md text-[13.5px] cursor-pointer hover:bg-[var(--hov)]" style={{ color: mi.col }}>
                <span className="material-symbols-rounded text-lg opacity-85">{mi.icon}</span>{mi.label}
              </div>
            ))}
          </div>
        </div>
      )}

      {openAsset && (
        <div onClick={()=>s.setAssetOpen(null)} className="fixed inset-0 z-[96] flex items-center justify-center p-6 bg-[rgba(18,20,38,.5)]">
          <div onClick={e=>e.stopPropagation()} className="w-[560px] max-w-full max-h-[86dvh] flex flex-col rounded-[14px] bg-[var(--bg)] border border-[var(--bd)] shadow-[0_20px_54px_rgba(16,18,40,.38)] overflow-hidden">
            <div className="flex items-center gap-2.5 p-3.5 px-4 shrink-0 border-b border-[var(--bd)]">
              <span className="material-symbols-rounded text-xl text-[#C48A2F]">attachment</span>
              <div className="min-w-0 flex-1">
                <div className="text-[14.5px] font-medium overflow-hidden text-ellipsis whitespace-nowrap">{openAsset.name}</div>
                <div className="text-[11.5px] text-[var(--tx2)]">{openAsset.mime} · {openAsset.size}</div>
              </div>
              <span onClick={()=>s.setAssetOpen(null)} className="grid place-items-center w-[34px] h-[34px] shrink-0 rounded-full material-symbols-rounded text-[19px] text-[var(--tx2)] cursor-pointer hover:bg-[var(--hov)]">close</span>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-3.5">
              <div className="rounded-[10px] border border-[var(--bd)] bg-[var(--surf)] p-3 grid place-items-center">
                <img alt={openAsset.name} src={openAsset.url} className="max-w-full max-h-[42dvh] h-auto block" />
              </div>
              <div className="flex flex-col gap-2.5">
                <div className="flex flex-col gap-1">
                  <div className="text-[11px] tracking-[0.06em] uppercase text-[var(--tx2)]">Đường dẫn vật lý (cố định)</div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 min-w-0 font-mono text-[12.5px] p-[7px_10px] rounded-[6px] bg-[var(--code)] overflow-hidden text-ellipsis whitespace-nowrap">{openAsset.path}</code>
                    <span onClick={()=>{ if(navigator.clipboard) navigator.clipboard.writeText(openAsset.path); s.showToast('Đã sao chép '+openAsset.path) }} className="grid place-items-center w-[34px] h-[34px] shrink-0 rounded-[6px] border border-[var(--bd)] material-symbols-rounded text-[17px] text-[var(--tx2)] cursor-pointer hover:bg-[var(--hov)]">content_copy</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <div className="text-[11px] tracking-[0.06em] uppercase text-[var(--tx2)]">Vị trí hiển thị</div>
                  <div className="flex items-center gap-2 text-[13.5px]"><span className="material-symbols-rounded text-[17px] text-[var(--pri)]">folder</span>{pathToAsset(openAsset.id) || 'Vault'}</div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-3 px-4 shrink-0 border-t border-[var(--bd)]">
              <span onClick={()=>s.setAssetOpen(null)} className="grid place-items-center h-[38px] px-4 rounded-lg text-[13.5px] text-[var(--tx2)] cursor-pointer hover:bg-[var(--hov)]">Đóng</span>
              <span onClick={()=>{ const a=openAsset; s.setAssetOpen(null); s.setMove({ id: a.id, name: a.name, kind:'asset', path: a.path, target:null }) }} className="flex items-center gap-1.5 h-[38px] px-4 rounded-lg text-[13.5px] font-medium text-[var(--priC)] bg-[var(--pri)] cursor-pointer"><span className="material-symbols-rounded text-[17px]">drive_file_move</span>Di chuyển tới…</span>
            </div>
          </div>
        </div>
      )}

      {s.move && (
        <div onClick={()=>s.setMove(null)} className="fixed inset-0 z-[97] flex items-center justify-center p-6 bg-[rgba(18,20,38,.5)]">
          <div onClick={e=>e.stopPropagation()} className="w-[460px] max-w-full max-h-[82dvh] flex flex-col rounded-[14px] bg-[var(--bg)] border border-[var(--bd)] shadow-[0_20px_54px_rgba(16,18,40,.38)] overflow-hidden">
            <div className="p-4 px-[18px] pb-3 shrink-0 border-b border-[var(--bd)]">
              <div className="text-[11px] tracking-[0.06em] uppercase text-[var(--tx2)]">{kindLabel[s.move.kind]}</div>
              <div className="mt-1 text-[15.5px] font-semibold overflow-hidden text-ellipsis whitespace-nowrap">{s.move.name}</div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-2">
              {folderOptionsLive(s as any).map(f=>(
                <div key={f.id} onClick={()=> s.setMove({ ...s.move!, target: f.id, targetName: f.name })} className="flex items-center gap-2.5 h-[38px] rounded-[7px] cursor-pointer text-[13.5px] pr-3 hover:bg-[var(--hov)]" style={{ paddingLeft: 12+f.depth*16, background: s.move?.target===f.id ? 'var(--sel)' : 'transparent', color: s.move?.target===f.id ? 'var(--pri)' : 'var(--tx)' }}>
                  <span className="material-symbols-rounded text-[17px] text-[var(--pri)] shrink-0">{f.id==='root'?'inventory_2':'folder'}</span>
                  <span className="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{f.name}</span>
                  <span className="material-symbols-rounded text-[17px] shrink-0">{s.move?.target===f.id?'check':''}</span>
                </div>
              ))}
            </div>
            <div className="shrink-0 border-t border-[var(--bd)]">
              <div className="flex gap-2 p-3 px-4 text-xs leading-[1.55] text-[var(--tx2)] bg-[var(--surf)]">
                <span className="material-symbols-rounded text-base shrink-0 text-[var(--pri)]">info</span>
                <span>{s.move.kind==='asset' ? `Chỉ vị trí hiển thị thay đổi. Đường dẫn vật lý ${s.move.path||''} giữ nguyên, mọi note đang nhúng tệp này không bị ảnh hưởng.` : 'Chỉ vị trí hiển thị trong cây thư mục thay đổi. Các liên kết tới tệp đính kèm bên trong note giữ nguyên đường dẫn vật lý.'}</span>
              </div>
              <div className="flex justify-end gap-2 p-3 px-4">
                <span onClick={()=>s.setMove(null)} className="grid place-items-center h-[38px] px-4 rounded-lg text-[13.5px] text-[var(--tx2)] cursor-pointer hover:bg-[var(--hov)]">Huỷ</span>
                <span onClick={()=>s.applyMove()} className="grid place-items-center h-[38px] px-[18px] rounded-lg text-[13.5px] font-medium cursor-pointer" style={{ background: s.move.target? 'var(--pri)':'var(--bd)', color: s.move.target? 'var(--priC)':'var(--tx2)' }}>Di chuyển</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {s.palette && (
        <div onClick={()=>s.setPalette(false)} className="fixed inset-0 z-[95] flex justify-center pt-[12vh] bg-[rgba(18,20,38,.42)]">
          <div onClick={e=>e.stopPropagation()} className="w-[620px] max-w-[92vw] h-fit rounded-xl bg-[var(--bg)] border border-[var(--bd)] shadow-[0_18px_50px_rgba(16,18,40,.35)] overflow-hidden">
            <div className="flex items-center gap-3 px-3.5 h-[58px] shrink-0 border-b border-[var(--bd)]">
              <span className="material-symbols-rounded text-xl text-[var(--pri)]">search</span>
              <input autoFocus value={s.query} onChange={e=>s.setQuery(e.target.value)} placeholder="Tìm note, thư mục hoặc lệnh…" className="flex-1 min-w-0 border-0 outline-0 bg-transparent text-base text-[var(--tx)]" />
              <span onClick={()=>s.setPalette(false)} className="grid place-items-center w-9 h-9 shrink-0 rounded-full material-symbols-rounded text-xl text-[var(--tx2)] cursor-pointer">close</span>
            </div>
            <div className="max-h-[46vh] overflow-y-auto p-2">
              {paletteResults.map((r,i)=>(
                <div key={i} onClick={r.onClick} className="flex items-center gap-3 p-2.5 px-3 rounded-lg cursor-pointer hover:bg-[var(--hov)]">
                  <span className="material-symbols-rounded text-[19px]" style={{ color: r.col }}>{r.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm overflow-hidden text-ellipsis whitespace-nowrap">{r.name}</div>
                    <div className="text-[11.5px] text-[var(--tx2)] overflow-hidden text-ellipsis whitespace-nowrap">{r.path}</div>
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

function pathToAsset(id: string) {
  const s: any = (useVault as any).getState()
  const out: string[] = []
  const scan = (pid: string|null, trail: string[]) => {
    for (const n of getChildrenLive(pid, s)) {
      if (out.length) return
      if (n.id===id) { out.push(...trail); return }
      if ((n as any).children) scan(n.id, [...trail, n.name])
    }
  }
  scan(null, [])
  return out.join(' / ')
}
