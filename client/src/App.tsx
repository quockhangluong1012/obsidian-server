import { useEffect } from 'react'
import { Sidebar } from './components/Sidebar'
import { Main } from './components/Main'
import { RightPanel } from './components/RightPanel'
import { Overlays } from './components/Overlays'
import { LockScreen } from './components/LockScreen'
import { useVault } from './store/useVault'

export default function App() {
  const s = useVault()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        s.setPalette(!s.palette)
      }
      if (e.key === 'Escape') {
        if (s.palette) s.setPalette(false)
        if (s.menu) s.setMenu(null)
        if (s.move) s.setMove(null)
        if (s.assetOpen) s.setAssetOpen(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [s.palette, s.menu, s.move, s.assetOpen])

  const themeVars = {
    '--bg': s.dark ? '#1E1F2B' : '#FFFFFF',
    '--surf': s.dark ? '#262735' : '#F7F8FC',
    '--drw': s.dark ? '#191A24' : '#F1F2F8',
    '--bd': s.dark ? '#32333F' : '#E4E6F0',
    '--tx': s.dark ? '#E7E8F0' : '#22242E',
    '--tx2': s.dark ? '#9A9DB0' : '#6B6F80',
    '--pri': s.accent,
    '--priC': s.dark ? '#14151F' : '#FFFFFF',
    '--hov': s.dark ? 'rgba(255,255,255,.06)' : 'rgba(63,81,181,.08)',
    '--sel': s.dark ? 'rgba(108,75,209,.26)' : 'rgba(63,81,181,.16)',
    '--code': s.dark ? '#2B2C3A' : '#F2F3F9',
  } as React.CSSProperties

  return (
    <div style={themeVars} className={s.dark ? 'dark' : ''}>
      <LockScreen />
      <div className="flex h-[100dvh] w-full bg-[var(--bg)] text-[var(--tx)] font-sans overflow-hidden">
        <Sidebar />
        <Main />
        <RightPanel />
      </div>
      <Overlays />
    </div>
  )
}
