import { useEffect, useState } from 'react'
import { Sidebar, SidebarBody } from './components/Sidebar'
import { Main } from './components/Main'
import { Overlays } from './components/Overlays'
import { LockScreen } from './components/LockScreen'
import { TopBar } from './components/MobileChrome'
import { useViewport } from './hooks/useViewport'
import { useVault } from './store/useVault'
export default function App() {
  const s = useVault()
  const { isPhone } = useViewport()

  useEffect(() => {
    // initial backend sync
    s.loadTree().catch(() => {})
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if ((e.ctrlKey || e.metaKey) && k === 'k') {
        e.preventDefault()
        s.setPalette(!s.palette)
        return
      }
      if (e.key === 'Escape') {
        if (s.palette) s.setPalette(false)
        if (s.menu) s.setMenu(null)
        if (s.move) s.setMove(null)
        if (s.assetOpen) s.setAssetOpen(null)
        if (s.drawer) s.setDrawer(false)
        return
      }
      // mobile-friendly back gesture: swipe-right is OS, but browser back is also a key on Android
      if (isPhone && e.key === 'GoBack' as unknown as string) {
        if (s.drawer) s.setDrawer(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [s.palette, s.menu, s.move, s.assetOpen, s.drawer, isPhone])

  const paperVars = s.themeMode === 'paper' && !s.dark ? {
    '--bg': '#FFFBF0',
    '--surf': '#F7F2E8',
    '--drw': '#F7F2E8',
    '--bd': '#E8E0D0',
    '--tx': '#1E1E24',
    '--tx2': '#5A5A6A',
    '--code': '#F4F0E6',
  } as React.CSSProperties : {}
  const themeVars = {
    '--bg': s.dark ? '#13141C' : '#FFFFFF',
    '--surf': s.dark ? '#1B1D27' : '#F7F7F8',
    '--drw': s.dark ? '#161823' : '#F4F4F5',
    '--bd': s.dark ? '#2A2C38' : '#E4E4E7',
    '--tx': s.dark ? '#EDECE4' : '#1A1A22',
    '--tx2': s.dark ? '#8E8F9A' : '#6B6B78',
    '--pri': s.accent,
    '--priC': s.dark ? '#13141C' : '#FFFFFF',
    '--hov': s.dark ? 'rgba(255,255,255,.06)' : 'rgba(91,63,217,.08)',
    '--sel': s.dark ? 'rgba(142,118,255,.22)' : 'rgba(91,63,217,.14)',
    '--code': s.dark ? '#21232F' : '#F4F4F5',
    ...paperVars,
    '--reading-scale': String(s.fontScale),
  } as React.CSSProperties

  return (
    <div style={themeVars} className={s.dark ? 'dark' : ''}>
      <LockScreen />
      {isPhone ? <PhoneShell /> : <DesktopShell />}
      <Overlays />
    </div>
  )
}

function DesktopShell() {
  return (
    <div className="flex h-[100dvh] w-full bg-[var(--bg)] text-[var(--tx)] font-sans overflow-hidden">
      <Sidebar />
      <Main />
    </div>
  )
}

function PhoneShell() {
  const s = useVault()
  return (
    <div className="flex flex-col h-[100dvh] w-full bg-[var(--bg)] text-[var(--tx)] font-sans overflow-hidden">
      <TopBar />
      <div className="flex-1 min-h-0 relative">
        <div className="absolute inset-0 flex flex-col">
          <Main />
        </div>
      </div>
      {s.drawer && <Drawer />}
    </div>
  )
}

function ReadingProgress() {
  const { isPhone } = useViewport()
  const [w, setW] = useState(0)
  useEffect(() => {
    const el = document.getElementById('main-scroll')
    if (!el || !isPhone) return
    const onScroll = () => {
      const max = el.scrollHeight - el.clientHeight
      setW(max > 0 ? (el.scrollTop / max) * 100 : 0)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => el.removeEventListener('scroll', onScroll)
  }, [isPhone])
  if (!isPhone) return null
  return (
    <div className="read-progress-hairline" aria-hidden>
      <div className="read-progress-hairline-fill" style={{ width: `${w}%` }} />
    </div>
  )
}

function Drawer() {
  const s = useVault()
  return (
    <>
      <div className="drawer-backdrop" onClick={() => s.setDrawer(false)} />
      <div className="drawer" role="dialog" aria-label="Thư viện">
        <SidebarBody />
      </div>
    </>
  )
}



