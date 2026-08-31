import { useState } from 'react'
import { useVault } from '../store/useVault'
import { useViewport } from '../hooks/useViewport'



export function TopBar() {
  const s = useVault()
  const { isPhone } = useViewport()
  const [aaOpen, setAaOpen] = useState(false)
  if (!isPhone) return null

  const cur = s.openTabs[s.tab] ?? s.openTabs[0]
  const title = cur?.title || 'Obsidian Vault'

  return (
    <>
      <header
        className="grid grid-cols-[auto_1fr_auto] items-center gap-2 shrink-0 px-2 bg-[var(--bg)]/92 backdrop-blur border-b border-[var(--bd)] supports-[backdrop-filter]:bg-[var(--bg)]/85"
        style={{ height: 'calc(var(--bar-h) + var(--safe-t))', paddingTop: 'var(--safe-t)' }}
      >
        <div className="flex items-center">
          <button
            onClick={() => s.setDrawer(true)}
            className="tap grid place-items-center w-11 h-11 rounded-full text-[var(--tx)]"
            aria-label="Mở thư viện"
          >
            <span className="material-symbols-rounded text-[22px]">menu</span>
          </button>
        </div>
        <div className="min-w-0 flex flex-col items-center justify-center text-center">
          <div className="text-[11px] tracking-[0.1em] uppercase text-[var(--tx2)] leading-none">
            {!cur ? 'Vault' : cur.kind === 'new' ? 'Note mới' : cur.kind === 'asset' ? 'Tệp đính kèm' : 'Đang đọc'}
          </div>
          <div className="mt-0.5 w-full max-w-full font-display text-[15px] font-medium leading-tight overflow-hidden text-ellipsis whitespace-nowrap text-[var(--tx)]">
            {title}
          </div>
        </div>
        <div className="flex items-center">
          <button
            onClick={() => setAaOpen(true)}
            className="tap grid place-items-center w-11 h-11 rounded-full text-[var(--tx2)]"
            aria-label="Cỡ chữ"
          >
            <span className="material-symbols-rounded text-[20px]">text_fields</span>
          </button>
          <button
            onClick={() => s.setPalette(true)}
            className="tap grid place-items-center w-11 h-11 rounded-full text-[var(--tx2)]"
            aria-label="Tìm kiếm"
          >
            <span className="material-symbols-rounded text-[22px]">search</span>
          </button>
        </div>
      </header>
      {aaOpen && <AaSheet onClose={() => setAaOpen(false)} />}
    </>
  )
}

function AaSheet({ onClose }: { onClose: () => void }) {
  const s = useVault()
  return (
    <div onClick={onClose} className="fixed inset-0 z-[97] flex items-end bg-[rgba(18,20,38,.45)]">
      <div
        onClick={e => e.stopPropagation()}
        className="w-full flex flex-col rounded-t-[22px] bg-[var(--bg)] border-t border-[var(--bd)]"
        style={{ boxShadow: '0 -16px 40px rgba(10,12,24,.28)', paddingBottom: 'var(--safe-b)' }}
      >
        <div className="self-center w-10 h-1 rounded-full bg-[var(--bd)] mt-3" />
        <div className="px-5 pt-3 pb-4">
          <div className="text-[13px] font-semibold">Tuỳ chỉnh đọc</div>
          <div className="text-[12px] text-[var(--tx2)]">Chỉ áp dụng trên thiết bị này</div>
        </div>

        <div className="px-5 pb-4 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <div className="text-[11px] tracking-[0.08em] uppercase text-[var(--tx2)]">Cỡ chữ</div>
            <div className="flex items-center gap-2">
              <button onClick={() => s.setFontScale(Math.max(0.9, +(s.fontScale - 0.05).toFixed(2)))} className="grid place-items-center w-11 h-11 rounded-full border border-[var(--bd)] text-[var(--tx)]">A-</button>
              <div className="flex-1 h-2 rounded-full bg-[var(--surf)] overflow-hidden">
                <div className="h-full bg-[var(--pri)]" style={{ width: `${((s.fontScale - 0.9)/0.25)*100}%` }} />
              </div>
              <button onClick={() => s.setFontScale(Math.min(1.15, +(s.fontScale + 0.05).toFixed(2)))} className="grid place-items-center w-11 h-11 rounded-full border border-[var(--bd)] text-[var(--tx)]">A+</button>
            </div>
            <div className="text-[11px] text-[var(--tx2)] text-center">{Math.round(s.fontScale*18)}px · {s.fontScale===1 ? 'Mặc định' : s.fontScale<1 ? 'Nhỏ' : 'Lớn'}</div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="text-[11px] tracking-[0.08em] uppercase text-[var(--tx2)]">Nền đọc</div>
            <div className="flex gap-2">
              {(['light','paper','dark'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => s.setThemeMode(m)}
                  className="flex-1 h-12 rounded-xl border text-[13px] font-medium capitalize flex flex-col items-center justify-center gap-0.5"
                  style={{
                    background: m==='dark' ? '#13141C' : m==='paper' ? '#F6F0E6' : '#FFFFFF',
                    color: m==='dark' ? '#EDECE4' : '#1E1E24',
                    borderColor: s.themeMode===m ? 'var(--pri)' : 'var(--bd)',
                    boxShadow: s.themeMode===m ? '0 0 0 2px var(--sel)' : 'none'
                  }}
                >
                  <span className="material-symbols-rounded text-[18px]">{m==='dark'?'dark_mode':m==='paper'?'auto_stories':'light_mode'}</span>
                  {m==='light'?'Sáng':m==='paper'?'Giấy':'Tối'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-3 px-5">
          <button onClick={onClose} className="w-full h-12 rounded-full bg-[var(--surf)] text-[var(--tx2)] text-[14px]">Đóng</button>
        </div>
      </div>
    </div>
  )
}


