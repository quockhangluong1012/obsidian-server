import { useEffect, useRef, useState, useCallback } from 'react'
import DOMPurify from 'dompurify'

type Props = {
  src?: string
  inlineSvg?: string
  alt?: string
  open: boolean
  onClose: () => void
}

export function SvgLightbox({ src, inlineSvg, alt = 'SVG', open, onClose }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [tx, setTx] = useState(0)
  const [ty, setTy] = useState(0)
  const startRef = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null)
  const pinchRef = useRef<{ dist: number; scale: number; midX: number; midY: number } | null>(null)

  const reset = useCallback(() => {
    setScale(1)
    setTx(0)
    setTy(0)
  }, [])

  useEffect(() => {
    if (open) reset()
  }, [open, reset, src, inlineSvg])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === '+' || e.key === '=') setScale(s => Math.min(8, s + 0.25))
      if (e.key === '-') setScale(s => Math.max(0.25, s - 0.25))
      if (e.key === '0') reset()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, reset])

  // prevent body scroll when open
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  const clampScale = (v: number) => Math.min(8, Math.max(0.25, v))

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.12 : 0.12
    setScale(s => clampScale(s + delta * s))
  }

  const dist = (a: { clientX: number; clientY: number }, b: { clientX: number; clientY: number }) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
  const mid = (a: { clientX: number; clientY: number }, b: { clientX: number; clientY: number }) => ({ x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 })

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const t = e.touches[0]
      startRef.current = { x: t.clientX, y: t.clientY, tx, ty }
    } else if (e.touches.length === 2) {
      const a = e.touches[0], b = e.touches[1]
      pinchRef.current = { dist: dist(a, b), scale, midX: mid(a, b).x, midY: mid(a, b).y }
    }
  }
  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && startRef.current && scale > 1) {
      const t = e.touches[0]
      const dx = t.clientX - startRef.current.x
      const dy = t.clientY - startRef.current.y
      setTx(startRef.current.tx + dx)
      setTy(startRef.current.ty + dy)
    } else if (e.touches.length === 2 && pinchRef.current) {
      const a = e.touches[0], b = e.touches[1]
      const d = dist(a, b)
      const ratio = d / pinchRef.current.dist
      setScale(clampScale(pinchRef.current.scale * ratio))
      // keep midpoint stable-ish by adjusting pan slightly
      const m = mid(a, b)
      const dx = m.x - pinchRef.current.midX
      const dy = m.y - pinchRef.current.midY
      setTx(dx * 0.5)
      setTy(dy * 0.5)
    }
  }
  const onTouchEnd = () => {
    startRef.current = null
    if (pinchRef.current) pinchRef.current = null
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (scale <= 1) return
    const el = e.currentTarget as HTMLElement
    el.setPointerCapture(e.pointerId)
    startRef.current = { x: e.clientX, y: e.clientY, tx, ty }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!startRef.current || scale <= 1) return
    const dx = e.clientX - startRef.current.x
    const dy = e.clientY - startRef.current.y
    setTx(startRef.current.tx + dx)
    setTy(startRef.current.ty + dy)
  }
  const onPointerUp = () => { startRef.current = null }

  const onDoubleClick = () => {
    setScale(s => (s === 1 ? 2 : s > 2 ? 1 : 2))
    if (scale !== 1) { setTx(0); setTy(0) }
  }

  if (!open) return null

  const sanitizedInline = inlineSvg ? DOMPurify.sanitize(inlineSvg, { USE_PROFILES: { svg: true, svgFilters: true } as any }) : null

  return (
    <div
      className="fixed inset-0 z-[99] flex flex-col lightbox-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Xem SVG phóng to"
      onClick={onClose}
    >
      {/* top bar */}
      <div className="flex items-center gap-2 px-3 py-2 shrink-0" style={{ paddingTop: 'calc(8px + var(--safe-t))' }} onClick={e => e.stopPropagation()}>
        <span className="material-symbols-rounded text-[20px] text-white/90">zoom_in</span>
        <span className="text-[13px] text-white/90 flex-1 truncate">{alt}</span>
        <span className="text-[12px] text-white/70 hidden md:inline">{Math.round(scale*100)}%</span>
        <button onClick={onClose} className="grid place-items-center w-9 h-9 rounded-full bg-white/10 text-white hover:bg-white/15" aria-label="Đóng">
          <span className="material-symbols-rounded text-[20px]">close</span>
        </button>
      </div>

      {/* stage */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 flex items-center justify-center p-4 md:p-8 overflow-hidden select-none"
        onWheel={onWheel}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onDoubleClick={onDoubleClick}
        onClick={e => e.stopPropagation()}
        style={{ touchAction: 'none' }}
      >
        <div
          className="lightbox-stage max-w-full max-h-full flex items-center justify-center"
          style={{ transform: `translate(${tx}px, ${ty}px) scale(${scale})`, transformOrigin: 'center center', willChange: 'transform', cursor: scale > 1 ? 'grab' : 'zoom-in' }}
        >
          {sanitizedInline ? (
            <div
              className="max-w-[92vw] max-h-[78vh] [&>svg]:max-w-full [&>svg]:max-h-[78vh] [&>svg]:w-auto [&>svg]:h-auto"
              dangerouslySetInnerHTML={{ __html: sanitizedInline }}
              style={{ background: 'white', borderRadius: 12, padding: 12 }}
            />
          ) : src ? (
            <img
              alt={alt}
              src={src}
              draggable={false}
              className="max-w-[92vw] max-h-[78vh] w-auto h-auto object-contain rounded-xl shadow-2xl bg-white"
              style={{ imageRendering: 'auto' }}
            />
          ) : (
            <div className="text-white/80">Không có nội dung SVG</div>
          )}
        </div>
      </div>

      {/* bottom toolbar */}
      <div className="flex items-center justify-center gap-2 px-4 shrink-0" style={{ paddingBottom: 'calc(16px + var(--safe-b))' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-1 p-1 rounded-full bg-white/95 shadow-xl border border-black/5">
          <button onClick={() => setScale(s => clampScale(s - 0.25))} className="grid place-items-center w-9 h-9 rounded-full hover:bg-black/5 text-[var(--tx)]" aria-label="Thu nhỏ">
            <span className="material-symbols-rounded text-[20px]">remove</span>
          </button>
          <span className="min-w-[56px] text-center text-[13px] font-medium text-[var(--tx)]">{Math.round(scale*100)}%</span>
          <button onClick={() => setScale(s => clampScale(s + 0.25))} className="grid place-items-center w-9 h-9 rounded-full hover:bg-black/5 text-[var(--tx)]" aria-label="Phóng to">
            <span className="material-symbols-rounded text-[20px]">add</span>
          </button>
          <div className="w-px h-6 bg-black/10 mx-1" />
          <button onClick={reset} className="px-3 h-9 rounded-full hover:bg-black/5 text-[13px] font-medium text-[var(--tx)]">1:1</button>
          <button onClick={() => { setScale(1); setTx(0); setTy(0) }} className="px-3 h-9 rounded-full hover:bg-black/5 text-[13px] font-medium text-[var(--tx)]">Vừa khung</button>
        </div>
        {src && (
          <a href={src} download target="_blank" rel="noreferrer" className="grid place-items-center w-11 h-11 rounded-full bg-white/95 shadow border border-black/5 text-[var(--tx)] hover:bg-white" aria-label="Tải SVG" onClick={e=>e.stopPropagation()}>
            <span className="material-symbols-rounded text-[20px]">download</span>
          </a>
        )}
      </div>
    </div>
  )
}
