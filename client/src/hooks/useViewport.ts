import { useEffect, useState } from 'react'

// Tailwind v4 default sm breakpoint = 640px. We treat <640px as phone.
const PHONE_MAX = 640

export function useViewport() {
  const [w, setW] = useState<number>(() =>
    typeof window === 'undefined' ? 1280 : window.innerWidth,
  )
  useEffect(() => {
    const on = () => setW(window.innerWidth)
    window.addEventListener('resize', on)
    window.addEventListener('orientationchange', on)
    return () => {
      window.removeEventListener('resize', on)
      window.removeEventListener('orientationchange', on)
    }
  }, [])
  return { width: w, isPhone: w < PHONE_MAX, isDesktop: w >= PHONE_MAX }
}
