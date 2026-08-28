import { useVault } from '../store/useVault'
import { useViewport } from '../hooks/useViewport'

type View = 'library' | 'reading' | 'outline'

const TABS: { id: View; icon: string; label: string }[] = [
  { id: 'library', icon: 'account_tree', label: 'Thư viện' },
  { id: 'reading', icon: 'menu_book', label: 'Đọc' },
  { id: 'outline', icon: 'format_list_bulleted', label: 'Mục lục' },
]

export function TopBar() {
  const s = useVault()
  const { isPhone } = useViewport()
  if (!isPhone) return null

  const cur = s.openTabs[s.tab] ?? s.openTabs[0]
  const title = cur?.title || 'Obsidian Vault'

  return (
    <header
      className="grid grid-cols-[auto_1fr_auto] items-center gap-2 shrink-0 px-2 bg-[var(--bg)] border-b border-[var(--bd)]"
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
          onClick={() => s.setPalette(true)}
          className="tap grid place-items-center w-11 h-11 rounded-full text-[var(--tx2)]"
          aria-label="Tìm kiếm"
        >
          <span className="material-symbols-rounded text-[22px]">search</span>
        </button>
        <button
          onClick={() => s.toggleDark()}
          className="tap grid place-items-center w-11 h-11 rounded-full text-[var(--tx2)]"
          aria-label={s.dark ? 'Chế độ sáng' : 'Chế độ tối'}
        >
          <span className="material-symbols-rounded text-[22px]">{s.dark ? 'light_mode' : 'dark_mode'}</span>
        </button>
      </div>
    </header>
  )
}

export function TabBar() {
  const s = useVault()
  const { isPhone } = useViewport()
  if (!isPhone) return null
  return (
    <nav
      className="flex shrink-0 bg-[var(--bg)] border-t border-[var(--bd)]"
      style={{ height: 'calc(var(--bar-h) + var(--safe-b))', paddingBottom: 'var(--safe-b)' }}
      aria-label="Điều hướng chính"
    >
      {TABS.map((t) => {
        const active = s.view === t.id
        return (
          <button
            key={t.id}
            onClick={() => s.setView(t.id)}
            className="tap flex-1 flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium"
            style={{ color: active ? 'var(--pri)' : 'var(--tx2)' }}
            aria-pressed={active}
          >
            <span
              className="material-symbols-rounded text-[24px]"
              style={{ fontVariationSettings: active ? `'FILL' 1, 'wght' 500` : `'FILL' 0, 'wght' 400` }}
            >
              {t.icon}
            </span>
            <span>{t.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
