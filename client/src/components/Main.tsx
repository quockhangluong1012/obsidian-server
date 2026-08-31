import { useRef, useEffect, useMemo, useState, useCallback } from 'react'
import { useVault, getChildrenLive } from '../store/useVault'
import type { VaultState } from '../store/useVault'
import { useViewport } from '../hooks/useViewport'
import { renderMarkdown } from '../lib/markdown'
import { SvgLightbox } from './SvgLightbox'

const TEXT_ATTACHMENT_MIME = new Set(['application/json', 'text/plain', 'text/markdown', 'text/csv'])

function pathTo(id: string, s: VaultState): string[] {
  const out: string[] = []
  const scan = (parentId: string | null, trail: string[]) => {
    for (const n of getChildrenLive(parentId, s)) {
      if (n.id === id) { out.push(...trail, n.name); return }
      if (n.children) scan(n.id, [...trail, n.name])
    }
  }
  scan(null, [])
  return out
}

export function Main() {
  const s = useVault()
  const { isPhone } = useViewport()
  const mdRef = useRef<HTMLTextAreaElement | null>(null)
  const activeTab = s.openTabs[s.tab] ?? s.openTabs[0]
  const hasTab = !!activeTab
  const cur = activeTab ?? { kind: '', id: '', title: '' }
  const isNew = cur.kind === 'new'
  const isAsset = cur.kind === 'asset'
  const isRealNote = hasTab && !isNew && !isAsset

  const onStyle: React.CSSProperties = { background: 'var(--pri)', color: 'var(--priC)' }
  const offStyle: React.CSSProperties = { background: 'transparent', color: 'var(--tx2)' }

  const livePath = hasTab ? pathTo(cur.id, s) : []
  const crumbNames = isNew ? livePath.slice(0, -1) : livePath

  // fetch note content when active changes
  useEffect(() => {
    if (isRealNote) s.fetchNote(cur.id)
  }, [cur.id, isRealNote])

  const cached = s.noteCache[cur.id]
  const mdValue = s.md ?? cached?.content ?? ''
  const pastedFigs = s.assets.filter((a) => a.note === cur.id)

  const showPreview = isRealNote && s.mode === 'preview'
  const showEditor = isRealNote && s.mode === 'edit'
  const showNew = isNew
  const showAsset = isAsset

  // reading scale for font
  const readingStyle = { fontSize: `calc(18px * ${s.fontScale})` } as React.CSSProperties

  return (
    <main className="flex-1 min-w-0 min-h-0 flex flex-col bg-[var(--bg)] relative">
      {!isPhone && (
        <DesktopTopChrome
          cur={cur}
          isNew={isNew}
          isAsset={isAsset}
          crumbNames={crumbNames}
          onStyle={onStyle}
          offStyle={offStyle}
        />
      )}

      <div id="main-scroll" className="flex-1 min-h-0 overflow-y-auto overscroll-contain relative scroll-pt-16" style={{ paddingBottom: isPhone && (showPreview || showEditor) ? '96px' : undefined }}>
        {isPhone && <ReadingHairline />}
        {!hasTab && (s.treeLoading ? <LoadingState /> : <EmptyState />)}
        {showPreview && <NotePreview md={mdValue} pastedFigs={pastedFigs} />}
        {showEditor && (
          <EditorSurface
            mdRef={mdRef}
            mdValue={mdValue}
            onPaste={handlePasteApi(cur.id, s, mdRef)}
            onChange={(v) => s.setMd(v)}
            isPhone={isPhone}
          />
        )}
        {showNew && (
          <NewNoteSurface cur={cur} livePath={livePath} isPhone={isPhone} onStartEdit={() => s.setMode('edit')} />
        )}
        {showAsset && <AssetArticle assetId={cur.id} />}
      </div>

      {!isPhone && <DesktopStatusBar />}

      {isPhone && (showPreview || showEditor) && (
        <div className="pointer-events-none fixed left-1/2 -translate-x-1/2 z-20 flex justify-center" style={{ bottom: 'calc(14px + var(--safe-b))' }}>
          <div className="pointer-events-auto flex p-1 gap-1 rounded-full bg-[var(--bg)] border border-[var(--bd)] shadow-[0_8px_28px_rgba(16,18,40,.22)] backdrop-blur supports-[backdrop-filter]:bg-[var(--bg)]/90">
            <button
              onClick={() => s.setMode('edit')}
              className="tap flex items-center gap-1.5 h-9 px-4 rounded-full text-[13px] font-medium transition-colors"
              style={s.mode === 'edit' ? onStyle : offStyle}
              aria-pressed={s.mode === 'edit'}
            >
              <span className="material-symbols-rounded text-[18px]">edit_note</span>
              Sửa
            </button>
            <button
              onClick={() => s.setMode('preview')}
              className="tap flex items-center gap-1.5 h-9 px-4 rounded-full text-[13px] font-medium transition-colors"
              style={s.mode === 'preview' ? onStyle : offStyle}
              aria-pressed={s.mode === 'preview'}
            >
              <span className="material-symbols-rounded text-[18px]">visibility</span>
              Đọc
            </button>
          </div>
        </div>
      )}
    </main>
  )
}

function EmptyState() {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-2 text-center px-6">
      <span className="material-symbols-rounded text-[40px] opacity-40">note_stack</span>
      <div className="text-[15px] font-medium text-[var(--tx)]">Chưa có note nào được mở</div>
      <div className="text-[13px] text-[var(--tx2)]">Chọn một note trong thư viện hoặc tạo note mới để bắt đầu.</div>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-2 text-center px-6">
      <span className="material-symbols-rounded text-[32px] opacity-50 animate-spin">progress_activity</span>
      <div className="text-[13px] text-[var(--tx2)]">Đang tải vault...</div>
    </div>
  )
}

function DesktopTopChrome({
  cur,
  isNew,
  isAsset,
  crumbNames,
  onStyle,
  offStyle,
}: {
  cur: { id: string; title: string }
  isNew: boolean
  isAsset: boolean
  crumbNames: string[]
  onStyle: React.CSSProperties
  offStyle: React.CSSProperties
}) {
  const s = useVault()
  return (
    <>
      <div className="flex items-end gap-0.5 h-[42px] shrink-0 px-2 bg-[var(--drw)] border-b border-[var(--bd)] overflow-x-auto overflow-y-hidden">
        {s.openTabs.map((t, i) => (
          <div
            key={t.id + i}
            onClick={() => s.setTab(i)}
            className="flex items-center gap-2 max-w-[290px] h-[34px] px-3.5 pr-2 rounded-t-[8px] cursor-pointer shrink-0 text-[13px]"
            style={{
              background: s.tab === i ? 'var(--bg)' : 'transparent',
              color: s.tab === i ? 'var(--tx)' : 'var(--tx2)',
              borderTop: `2px solid ${s.tab === i ? 'var(--pri)' : 'transparent'}`,
              fontWeight: s.tab === i ? 500 : 400,
            }}
          >
            <span className="overflow-hidden text-ellipsis whitespace-nowrap">{t.title || 'Không có tiêu đề'}</span>
            <span
              onClick={(e) => { e.stopPropagation(); s.closeTab(i) }}
              title="Đóng"
              className="material-symbols-rounded text-base opacity-55 rounded-full hover:bg-[var(--hov)] hover:opacity-100"
            >
              close
            </span>
          </div>
        ))}
        <button
          onClick={() => s.startDraft('note')}
          className="grid place-items-center w-[30px] h-[30px] shrink-0 mb-0.5 rounded-[6px] bg-transparent text-[var(--tx2)] hover:bg-[var(--hov)]"
        >
          <span className="material-symbols-rounded text-[19px]">add</span>
        </button>
      </div>
      <div className="flex items-center gap-3 h-12 shrink-0 px-4 border-b border-[var(--bd)] overflow-hidden">
        <button className="grid place-items-center w-[30px] h-[30px] shrink-0 rounded-full bg-transparent text-[var(--tx2)] hover:bg-[var(--hov)]">
          <span className="material-symbols-rounded text-[19px]">arrow_back</span>
        </button>
        <button className="grid place-items-center w-[30px] h-[30px] shrink-0 rounded-full bg-transparent text-[var(--tx2)] hover:bg-[var(--hov)]">
          <span className="material-symbols-rounded text-[19px]">arrow_forward</span>
        </button>
        <div className="flex-1 min-w-[8em] flex items-center gap-1.5 text-[12.5px] text-[var(--tx2)] overflow-hidden whitespace-nowrap">
          {crumbNames.map((name, idx) => {
            const last = idx === crumbNames.length - 1
            return (
              <span key={idx} className="flex items-center gap-1.5 shrink min-w-[2.5em]">
                <span
                  className="overflow-hidden text-ellipsis whitespace-nowrap cursor-pointer"
                  style={{ color: last && !isNew ? 'var(--tx)' : 'var(--tx2)', fontWeight: last && !isNew ? 500 : 400 }}
                >
                  {name}
                </span>
                {(!last || isNew) && <span className="shrink-0 opacity-45">/</span>}
              </span>
            )
          })}
          {isNew && (
            <input
              autoFocus
              defaultValue={cur.title}
              onChange={(e) => {
                const v = e.target.value
                const tabs = s.openTabs.map((t) => t.id === cur.id ? { ...t, title: v } : t)
                useVault.setState({ openTabs: tabs })
                const extra = { ...s.extra }
                for (const k of Object.keys(extra)) extra[k] = extra[k].map((n) => n.id === cur.id ? { ...n, name: v.trim() || 'Không có tiêu đề' } : n)
                useVault.setState({ extra })
              }}
              placeholder="Tiêu đề note"
              className="flex-1 min-w-[80px] max-w-[340px] h-7 px-2 border border-[var(--pri)] rounded-[6px] bg-[var(--bg)] text-[13px] font-medium text-[var(--tx)] outline-0"
            />
          )}
        </div>
        {!isAsset && (
          <div className="flex shrink-0 p-0.5 gap-0.5 rounded-lg bg-[var(--surf)] border border-[var(--bd)]">
            <div
              onClick={() => s.setMode('edit')}
              title="Chỉnh sửa"
              className="flex items-center gap-1.5 h-7 px-3 rounded-[6px] cursor-pointer text-[12.5px] font-medium"
              style={s.mode === 'edit' ? onStyle : offStyle}
            >
              <span className="material-symbols-rounded text-base">edit_note</span><span>Chỉnh sửa</span>
            </div>
            <div
              onClick={() => s.setMode('preview')}
              title="Xem trước"
              className="flex items-center gap-1.5 h-7 px-3 rounded-[6px] cursor-pointer text-[12.5px] font-medium"
              style={s.mode === 'preview' ? onStyle : offStyle}
            >
              <span className="material-symbols-rounded text-base">visibility</span><span>Xem trước</span>
            </div>
          </div>
        )}
        <button className="grid place-items-center w-[30px] h-[30px] shrink-0 rounded-full bg-transparent text-[var(--tx2)] hover:bg-[var(--hov)]">
          <span className="material-symbols-rounded text-[19px]">more_vert</span>
        </button>
      </div>
    </>
  )
}



function EditorSurface({
  mdRef,
  mdValue,
  onPaste,
  onChange,
  isPhone,
}: {
  mdRef: React.RefObject<HTMLTextAreaElement | null>
  mdValue: string
  onPaste: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void
  onChange: (v: string) => void
  isPhone: boolean
}) {
  return (
    <div className="max-w-[820px] mx-auto px-4 md:px-10 py-5 md:py-9 pb-32">
      <div className="flex items-center gap-2 mb-3 font-mono text-[11px] tracking-[0.08em] uppercase text-[var(--tx2)]">
        <span className="material-symbols-rounded text-[15px]">code</span>markdown source
        <span className="flex items-center gap-1.5 ml-auto normal-case tracking-normal font-sans text-[11.5px] px-2.5 py-0.5 rounded-full bg-[var(--surf)] border border-[var(--bd)]">
          <span className="material-symbols-rounded text-sm text-[var(--pri)]">content_paste</span>Ctrl+V để dán ảnh hoặc SVG
        </span>
      </div>
      <textarea
        ref={mdRef}
        value={mdValue}
        onChange={(e) => onChange(e.target.value)}
        onPaste={onPaste}
        spellCheck={false}
        className="block w-full min-h-[58vh] box-border resize-y border border-[var(--bd)] rounded-[10px] p-4 px-[18px] outline-0 bg-[var(--bg)] m-0 font-mono text-[14px] md:text-sm leading-[1.85] text-[var(--tx)] focus:border-[var(--pri)]"
        style={{ fontSize: isPhone ? '16px' : undefined }}
      />
    </div>
  )
}

function NewNoteSurface({
  cur,
  livePath,
  isPhone,
  onStartEdit,
}: {
  cur: { id: string; title: string }
  livePath: string[]
  isPhone: boolean
  onStartEdit: () => void
}) {
  return (
    <div className="max-w-[760px] mx-auto px-5 md:px-10 py-6 md:py-12 pb-32">
      <div
        className="font-display text-[28px] md:text-[34px] leading-[1.22] font-bold tracking-[-0.015em]"
        style={{ color: cur.title ? 'var(--tx)' : 'var(--tx2)' }}
      >
        {cur.title || 'Không có tiêu đề'}
      </div>
      <div className="flex items-center flex-wrap gap-2.5 my-[18px] mb-[22px] font-mono text-[11px] tracking-[0.07em] uppercase text-[var(--tx2)]">
        <span className="px-2 py-0.5 rounded-[5px] bg-[var(--sel)] text-[var(--pri)]">note mới</span>
        <span>{livePath.slice(0, -1).join(' / ') || 'Vault'}</span>
      </div>
      <div className="flex items-start gap-0.5 text-[16px] md:text-[17px] leading-[1.7] text-[var(--tx2)]">
        <span className="inline-block w-0.5 h-6 bg-[var(--pri)] shrink-0" />
        <span className="pl-2">Bắt đầu viết bằng Markdown. Nội dung tự động lưu.</span>
      </div>
      {isPhone && (
        <button
          onClick={onStartEdit}
          className="tap mt-5 inline-flex items-center gap-2 h-11 px-5 rounded-full bg-[var(--pri)] text-[var(--priC)] font-medium"
        >
          <span className="material-symbols-rounded text-[18px]">edit_note</span>
          Bắt đầu viết
        </button>
      )}
    </div>
  )
}

function AssetArticle({ assetId }: { assetId: string }) {
  const s = useVault()
  const asset = s.assets.find((a) => a.id === assetId)
  const url = asset?.url || `/api/files/${assetId}`
  const name = asset?.name || 'Tệp đính kèm'
  const mime = asset?.mime || 'image/*'
  const isImage = /^image\//.test(mime)
  const [imgFailed, setImgFailed] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)

  useEffect(() => setImgFailed(false), [url])

  return (
    <div className="max-w-[900px] mx-auto px-5 md:px-10 py-6 md:py-12 pb-32">
      <div className="mb-4 flex flex-wrap items-center gap-2 text-[13px] text-[var(--tx2)]">
        <span className="material-symbols-rounded text-lg text-[#C48A2F]">
          {/svg/.test(mime) ? 'shapes' : isImage ? 'image' : 'draft'}
        </span>
        <span className="font-medium text-[var(--tx)]">{name}</span>
        {asset && <span>· {asset.mime} · {asset.size}</span>}
      </div>
      {isImage && !imgFailed ? (
        <>
          <div className="relative group mx-auto max-w-full w-fit">
            <img
              alt={name}
              src={url}
              onError={() => setImgFailed(true)}
              onClick={() => setLightboxOpen(true)}
              className="block max-w-full h-auto rounded-xl border border-[var(--bd)] bg-[var(--surf)] cursor-zoom-in"
              loading="lazy"
            />
            <button
              onClick={() => setLightboxOpen(true)}
              className="absolute bottom-3 right-3 grid place-items-center w-9 h-9 rounded-full bg-white/90 shadow border border-black/5 text-[var(--tx)] opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Phóng to"
            >
              <span className="material-symbols-rounded text-[20px]">zoom_in</span>
            </button>
          </div>
          <div className="text-center mt-3 text-[12px] text-[var(--tx2)] flex items-center justify-center gap-1">
            <span className="material-symbols-rounded text-[14px]">zoom_in</span> Bấm để phóng to, pinch để zoom
          </div>
          <SvgLightbox src={url} alt={name} open={lightboxOpen} onClose={() => setLightboxOpen(false)} />
        </>
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 rounded-[10px] border border-dashed border-[var(--bd)] bg-[var(--surf)] p-10 text-center text-[var(--tx2)]">
          <span className="material-symbols-rounded text-[28px] opacity-70">{isImage ? 'broken_image' : 'draft'}</span>
          <span className="text-[13px]">
            {isImage ? 'Không tải được ảnh — kiểm tra server hoặc đường dẫn tệp.' : `Không hỗ trợ xem trước cho loại tệp này (${mime}).`}
          </span>
        </div>
      )}
    </div>
  )
}

function DesktopStatusBar() {
  return (
    <div className="flex items-center gap-[18px] h-8 shrink-0 px-4 border-t border-[var(--bd)] bg-[var(--surf)] text-[var(--tx2)] text-[11.5px] tracking-[0.02em]">
      <span className="flex items-center gap-1.5"><span className="material-symbols-rounded text-sm">link</span>0 backlinks</span>
      <span>2.813 từ</span>
      <span>14.499 ký tự</span>
      <div className="flex-1" />
      <span className="flex items-center gap-1.5"><span className="material-symbols-rounded text-sm">cloud_done</span>Đã lưu</span>
    </div>
  )
}

function handlePasteApi(
  curId: string,
  s: VaultState,
  mdRef: React.RefObject<HTMLTextAreaElement | null>,
) {
  return async (e: React.ClipboardEvent<HTMLTextAreaElement>): Promise<void> => {
    const dt = e.clipboardData
    if (!dt) return
    const items = Array.from(dt.items || [])
    const pastableMime = (t: string) => /^image\//.test(t) || TEXT_ATTACHMENT_MIME.has(t)
    const fileItem = items.find((it) => it.kind === 'file' && pastableMime(it.type))
    if (fileItem) {
      const file = fileItem.getAsFile()
      if (!file) return
      const isImage = /^image\//.test(file.type)
      e.preventDefault()
      try {
        const att: any = await (s as any).uploadFile(file, curId)
        const url = att?.url || att?.path || `/api/files/${att?.id}`
        insertSnippetWithUrl(s, mdRef, isImage ? `\n\n![](${url})\n` : `\n\n[${file.name}](${url})\n`)
      } catch {
        if (!isImage) return // no meaningful offline preview for non-image attachments
        // fallback to local
        const reader = new FileReader()
        reader.onload = () => {
          const url = reader.result as string
          s.storeAsset(file.name || `pasted-${Date.now()}.png`, file.type || 'image/png', url, curId)
          insertSnippet(s, mdRef, `\n\n![](${ '/api/files/demo' })\n`, url, file.name)
        }
        reader.readAsDataURL(file)
      }
      return
    }
    const text = dt.getData('text/plain') || ''
    if (/^\s*<svg[\s>]/i.test(text)) {
      e.preventDefault()
      try {
        const blob = new Blob([text], { type: 'image/svg+xml' })
        const f = new File([blob], `pasted-${Date.now()}.svg`, { type: 'image/svg+xml' })
        const att: any = await (s as any).uploadFile(f, curId)
        const url = att?.url || `/api/files/${att?.id}`
        insertSnippetWithUrl(s, mdRef, `\n\n![](${url})\n`)
      } catch {
        const url = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(text)))
        s.storeAsset(`pasted-${Date.now()}.svg`, 'image/svg+xml', url, curId)
        insertSnippet(s, mdRef, `\n\n![]( /api/files/demo )\n`, url, 'svg')
      }
    }
  }
}

function handlePasteStatic(
  curId: string,
  s: VaultState,
  mdRef: React.RefObject<HTMLTextAreaElement | null>,
) {
  return (e: React.ClipboardEvent<HTMLTextAreaElement>): void => {
    const dt = e.clipboardData
    if (!dt) return
    const items = Array.from(dt.items || [])
    const fileItem = items.find((it) => it.kind === 'file' && /^image\//.test(it.type))
    if (fileItem) {
      const file = fileItem.getAsFile()
      if (!file) return
      e.preventDefault()
      const reader = new FileReader()
      reader.onload = () => {
        const url = reader.result as string
        s.storeAsset(file.name || `pasted-${Date.now()}.png`, file.type || 'image/png', url, curId)
        insertSnippet(s, mdRef, `\n\n![](${ '/api/files/demo' })\n`, url, file.name)
      }
      reader.readAsDataURL(file)
      return
    }
    const text = dt.getData('text/plain') || ''
    if (/^\s*<svg[\s>]/i.test(text)) {
      e.preventDefault()
      const url = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(text)))
      s.storeAsset(`pasted-${Date.now()}.svg`, 'image/svg+xml', url, curId)
      insertSnippet(s, mdRef, `\n\n![]( /api/files/demo )\n`, url, 'svg')
    }
  }
}

function insertSnippetWithUrl(
  s: VaultState,
  mdRef: React.RefObject<HTMLTextAreaElement | null>,
  snippet: string,
) {
  const el = mdRef.current
  const base = s.md ?? ''
  const pos = el && typeof el.selectionStart === 'number' ? el.selectionStart : base.length
  const next = base.slice(0, pos) + snippet + base.slice(pos)
  s.setMd(next)
  requestAnimationFrame(() => {
    if (!mdRef.current) return
    const p = pos + snippet.length
    mdRef.current.focus()
    mdRef.current.selectionStart = mdRef.current.selectionEnd = p
  })
}

function insertSnippet(
  s: VaultState,
  mdRef: React.RefObject<HTMLTextAreaElement | null>,
  snippet: string,
  _url?: string,
  _name?: string,
) {
  const el = mdRef.current
  const base = s.md ?? ''
  const pos = el && typeof el.selectionStart === 'number' ? el.selectionStart : base.length
  const actualSnippet = snippet.replace('/api/files/demo', '/api/files/' + (s.assets[s.assets.length - 1]?.gid ?? 'demo'))
  const next = base.slice(0, pos) + actualSnippet + base.slice(pos)
  s.setMd(next)
  requestAnimationFrame(() => {
    if (!mdRef.current) return
    const p = pos + actualSnippet.length
    mdRef.current.focus()
    mdRef.current.selectionStart = mdRef.current.selectionEnd = p
  })
}

function ReadingHairline() {
  const [w, setW] = useState(0)
  useEffect(() => {
    const el = document.getElementById('main-scroll')
    if (!el) return
    const onScroll = () => {
      const max = el.scrollHeight - el.clientHeight
      setW(max > 0 ? (el.scrollTop / max) * 100 : 0)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => el.removeEventListener('scroll', onScroll)
  }, [])
  return (
    <div className="read-progress-hairline sticky top-0">
      <div className="read-progress-hairline-fill" style={{ width: `${w}%` }} />
    </div>
  )
}

function NotePreview({ md, pastedFigs }: { md: string; pastedFigs: { name: string; url: string; path: string; folder: string }[] }) {
  const s = useVault()
  const html = useMemo(() => renderMarkdown(md), [md])
  const articleRef = useRef<HTMLDivElement>(null)
  const [lightbox, setLightbox] = useState<{ src?: string; inlineSvg?: string; alt?: string } | null>(null)

  const onArticleClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    const img = target.closest('img') as HTMLImageElement | null
    if (img && img.src) {
      // only for images inside article
      if (articleRef.current?.contains(img)) {
        setLightbox({ src: img.currentSrc || img.src, alt: img.alt || 'Ảnh' })
        return
      }
    }
    const svg = target.closest('svg') as SVGElement | null
    if (svg && articleRef.current?.contains(svg)) {
      setLightbox({ inlineSvg: svg.outerHTML, alt: 'SVG' })
    }
  }, [])

  const [figLightbox, setFigLightbox] = useState<string | null>(null)

  return (
    <div className="prose-measure max-w-[42em] md:max-w-[44em] mx-auto px-4 md:px-6 py-6 md:py-8 pb-32">
      <article
        ref={articleRef}
        onClick={onArticleClick}
        className="font-display md-body"
        style={{ fontSize: `calc(18px * ${s.fontScale})`, lineHeight: 1.85 }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {pastedFigs.map((fg, i) => (
        <figure key={'fig'+i} className="m-0 mb-6 mt-4 group relative">
          <img
            alt={fg.name}
            src={fg.url}
            loading="lazy"
            onClick={() => setFigLightbox(fg.url)}
            className="block max-w-full w-auto h-auto rounded-xl border border-[var(--bd)] bg-[var(--surf)] cursor-zoom-in"
          />
          <button
            onClick={() => setFigLightbox(fg.url)}
            className="absolute bottom-2 right-2 grid place-items-center w-8 h-8 rounded-full bg-white/90 shadow border border-black/5 text-[var(--tx)] opacity-0 group-hover:opacity-100 transition-opacity md:opacity-0"
            aria-label="Phóng to"
          >
            <span className="material-symbols-rounded text-[18px]">zoom_in</span>
          </button>
          <figcaption className="mt-2.5 flex flex-wrap items-center gap-2 text-[12.5px] text-[var(--tx2)]">
            <span className="font-medium">{fg.name}</span>
            <code className="font-mono text-[11.5px] px-1.5 py-0.5 rounded bg-[var(--code)]">{fg.path}</code>
          </figcaption>
        </figure>
      ))}
      <SvgLightbox src={lightbox?.src} inlineSvg={lightbox?.inlineSvg} alt={lightbox?.alt} open={!!lightbox} onClose={() => setLightbox(null)} />
      <SvgLightbox src={figLightbox || undefined} alt="Ảnh đính kèm" open={!!figLightbox} onClose={() => setFigLightbox(null)} />
    </div>
  )
}

