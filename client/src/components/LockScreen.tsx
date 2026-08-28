import { useVault } from '../store/useVault'

export function LockScreen() {
  const s = useVault()
  if (!s.locked) return null
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-[var(--drw)] text-[var(--tx)]">
      <div className="w-[380px] max-w-full flex flex-col gap-[26px]">
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2 text-[var(--pri)]">
            <span className="material-symbols-rounded text-[26px]">shield_lock</span>
            <span className="text-[15px] font-medium tracking-[0.01em] text-[var(--tx)]">Obsidian Vault</span>
          </div>
          <div className="text-[26px] leading-[1.25] font-bold tracking-[-0.015em]">Nhập key để mở vault</div>
          <div className="text-[13.5px] leading-[1.6] text-[var(--tx2)]">Vault này được bảo vệ bằng một key duy nhất. Key được lưu trên thiết bị sau khi mở khoá.</div>
        </div>
        <div className="flex flex-col gap-2">
          <label className="font-mono text-[11px] tracking-[0.08em] uppercase text-[var(--tx2)]">Key</label>
          <div className="flex items-center gap-1.5 h-12 px-1.5 pl-3.5 rounded-[10px] bg-[var(--bg)] border" style={{ borderColor: s.keyError ? '#D64550' : 'var(--bd)' }}>
            <span className="material-symbols-rounded text-[19px] shrink-0 text-[var(--tx2)]">key</span>
            <input autoFocus value={s.keyValue} onChange={e=>s.setKeyValue(e.target.value)} onKeyDown={e=>{ if(e.key==='Enter') s.submitKey() }} type={s.reveal ? 'text' : 'password'} placeholder="••••••••" autoComplete="off" spellCheck={false} className="flex-1 min-w-0 h-full border-0 outline-0 bg-transparent text-[15px] tracking-[0.04em] text-[var(--tx)]" />
            <button onClick={()=>s.setReveal(!s.reveal)} title="Hiện / ẩn key" className="grid place-items-center w-9 h-9 shrink-0 rounded-lg bg-transparent text-[var(--tx2)] hover:bg-[var(--hov)] hover:text-[var(--pri)] cursor-pointer"><span className="material-symbols-rounded text-[19px]">{s.reveal ? 'visibility_off' : 'visibility'}</span></button>
          </div>
          {s.keyError && (
            <div className="flex items-center gap-1.5 text-[12.5px] text-[#D64550]">
              <span className="material-symbols-rounded text-base">error</span>
              <span>Key không đúng. Thử lại.</span>
            </div>
          )}
        </div>
        <button onClick={()=>s.submitKey()} className="flex items-center justify-center gap-2 h-12 rounded-[10px] text-[14.5px] font-medium cursor-pointer" style={{ background: s.keyValue.trim() ? 'var(--pri)' : 'var(--bd)', color: s.keyValue.trim() ? 'var(--priC)' : 'var(--tx2)' }}>
          <span className="material-symbols-rounded text-[19px]">lock_open</span>Mở khoá
        </button>
      </div>
    </div>
  )
}
