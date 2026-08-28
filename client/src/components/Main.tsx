import { useRef, useEffect } from 'react'
import { useVault, getChildrenLive } from '../store/useVault'
import type { VaultState } from '../store/useVault'
import { MD } from '../mock/data'
import { useViewport } from '../hooks/useViewport'

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
  const cur = s.openTabs[s.tab] ?? s.openTabs[0] ?? { kind: 'ch27', id: 'ch27', title: '' }
  const isNew = cur.kind === 'new'
  const isMockCh27 = cur.id === 'ch27'
  const isMockWf = cur.id === 'wf'
  const isRealNote = !isMockCh27 && !isMockWf && !isNew

  const onStyle: React.CSSProperties = { background: 'var(--pri)', color: 'var(--priC)' }
  const offStyle: React.CSSProperties = { background: 'transparent', color: 'var(--tx2)' }

  const livePath = pathTo(cur.id, s)
  const crumbNames = (isNew ? livePath.slice(0, -1) : livePath).length
    ? (isNew ? livePath.slice(0, -1) : livePath)
    : cur.kind === 'ch27'
      ? ['Book Translate', 'Translated Book', 'Fundamental Of Software Architecture', 'Chương 27. Các Định luật Kiến trúc Phần mềm, Nhìn lại']
      : cur.kind === 'wf'
        ? ['Trading Journal', 'WORKFLOW_EXPLAINED']
        : []

  // fetch note content when active changes
  useEffect(() => {
    if (isRealNote) s.fetchNote(cur.id)
  }, [cur.id])

  const cached = s.noteCache[cur.id]
  const mdValue = isRealNote ? (s.md ?? cached?.content ?? '') : (s.md ?? MD)
  const pastedFigs = s.assets.filter((a) => a.note === cur.id)

  const showPreview = (isMockCh27 && s.mode === 'preview') || (isRealNote && s.mode === 'preview')
  const showEditor = (isMockCh27 && s.mode === 'edit') || (isRealNote && s.mode === 'edit')
  const showOtherTab = isMockWf
  const showNew = isNew

  return (
    <main className="flex-1 min-w-0 min-h-0 flex flex-col bg-[var(--bg)]">
      {!isPhone && (
        <DesktopTopChrome
          cur={cur}
          isNew={isNew}
          crumbNames={crumbNames}
          onStyle={onStyle}
          offStyle={offStyle}
        />
      )}

      {isPhone && (showPreview || showEditor) && (
        <PhoneEditPreviewToggle onStyle={onStyle} offStyle={offStyle} />
      )}

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain relative">
        {showPreview && (
          isMockCh27
            ? <PreviewArticle pastedFigs={pastedFigs} showProgress={isPhone} />
            : <NotePreview md={mdValue} pastedFigs={pastedFigs} />
        )}
        {showEditor && (
          <EditorSurface
            mdRef={mdRef}
            mdValue={mdValue}
            onPaste={handlePasteApi(cur.id, s, mdRef)}
            onChange={(v) => s.setMd(v)}
            isPhone={isPhone}
          />
        )}
        {showOtherTab && <WorkflowArticle />}
        {showNew && (
          <NewNoteSurface cur={cur} livePath={livePath} isPhone={isPhone} onStartEdit={() => s.setMode('edit')} />
        )}
        {isRealNote && !showPreview && !showEditor && !showNew && !showOtherTab && (
          <NotePreview md={mdValue} pastedFigs={pastedFigs} />
        )}
      </div>

      {!isPhone && <DesktopStatusBar />}
    </main>
  )
}

function DesktopTopChrome({
  cur,
  isNew,
  crumbNames,
  onStyle,
  offStyle,
}: {
  cur: { id: string; title: string }
  isNew: boolean
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
            <span className="material-symbols-rounded text-base opacity-55">close</span>
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
        <button
          onClick={() => s.setPanel(!s.panel)}
          title="Mục lục"
          className="grid place-items-center w-[30px] h-[30px] shrink-0 rounded-full"
          style={{
            background: s.panel ? (s.dark ? 'rgba(142,118,255,.22)' : 'rgba(91,63,217,.14)') : 'transparent',
            color: s.panel ? 'var(--pri)' : 'var(--tx2)',
          }}
        >
          <span className="material-symbols-rounded text-[19px]">format_list_bulleted</span>
        </button>
        <button className="grid place-items-center w-[30px] h-[30px] shrink-0 rounded-full bg-transparent text-[var(--tx2)] hover:bg-[var(--hov)]">
          <span className="material-symbols-rounded text-[19px]">more_vert</span>
        </button>
      </div>
    </>
  )
}

function PhoneEditPreviewToggle({ onStyle, offStyle }: { onStyle: React.CSSProperties; offStyle: React.CSSProperties }) {
  const s = useVault()
  return (
    <div className="flex justify-center shrink-0 py-2 px-4">
      <div className="flex p-1 gap-1 rounded-full bg-[var(--surf)] border border-[var(--bd)] shadow-sm">
        <button
          onClick={() => s.setMode('edit')}
          className="tap flex items-center gap-1.5 h-9 px-4 rounded-full text-[13px] font-medium"
          style={s.mode === 'edit' ? onStyle : offStyle}
          aria-pressed={s.mode === 'edit'}
        >
          <span className="material-symbols-rounded text-[18px]">edit_note</span>
          Sửa
        </button>
        <button
          onClick={() => s.setMode('preview')}
          className="tap flex items-center gap-1.5 h-9 px-4 rounded-full text-[13px] font-medium"
          style={s.mode === 'preview' ? onStyle : offStyle}
          aria-pressed={s.mode === 'preview'}
        >
          <span className="material-symbols-rounded text-[18px]">visibility</span>
          Đọc
        </button>
      </div>
    </div>
  )
}

function PreviewArticle({
  pastedFigs,
  showProgress,
}: {
  pastedFigs: { name: string; url: string; path: string; folder: string }[]
  showProgress: boolean
}) {
  return (
    <article className="font-display max-w-[760px] mx-auto px-5 md:px-10 py-6 md:py-12 pb-32 text-[17px] leading-[1.7]">
      <h1 className="m-0 mb-5 md:mb-7 text-[28px] md:text-[34px] leading-[1.22] font-bold tracking-[-0.015em]">
        Chương 27. Các Định luật Kiến trúc Phần mềm, Nhìn lại (The Laws of Software Architecture, Revisited)
      </h1>
      <p className="m-0 mb-[18px]">
        Khi chúng tôi bắt đầu viết cuốn sách này, chúng tôi đã đặt ra một bộ <strong className="font-bold">tám định luật kiến trúc phần mềm</strong> — những nguyên tắc cốt lõi mà chúng tôi tin rằng mọi kiến trúc sư nên hiểu và áp dụng. Bây giờ, khi cuốn sách đã hoàn thành, chúng tôi muốn <strong className="font-bold">nhìn lại (revisit)</strong> những định luật này trong bối cảnh của tất cả những gì chúng tôi đã trình bày.
      </p>
      <p className="m-0 mb-3">Trong chương này, chúng tôi sẽ:</p>
      <ul className="m-0 mb-[24px] pl-[24px] flex flex-col gap-2 list-disc">
        <li>Tổng kết tám định luật kiến trúc phần mềm</li>
        <li>Kết nối mỗi định luật với các chương cụ thể trong cuốn sách</li>
        <li>Thảo luận về cách áp dụng từng định luật trong thực tế</li>
        <li>Chia sẻ suy nghĩ cuối cùng về vai trò của kiến trúc sư phần mềm</li>
      </ul>
      <h2 className="m-0 mb-4 text-[22px] md:text-[25px] leading-[1.3] font-bold tracking-[-0.01em]">Tám Định luật Kiến trúc Phần mềm (The Eight Laws of Software Architecture)</h2>
      <p className="m-0 mb-5">
        Chúng tôi đã giới thiệu tám định luật kiến trúc phần mềm ở đầu cuốn sách. Bây giờ, hãy xem lại chúng trong <strong className="font-bold">Hình 27-1</strong>.
      </p>
      <figure className="m-0 mb-7">
        <div className="h-[200px] md:h-[230px] border border-[var(--bd)] rounded-lg bg-[repeating-linear-gradient(135deg,var(--surf)_0_9px,var(--bg)_9px_18px)] grid place-items-center">
          <span className="font-mono text-[11.5px] tracking-[0.06em] text-[var(--tx2)] uppercase text-center px-3">hình 27-1 · sơ đồ tám định luật</span>
        </div>
        <figcaption className="mt-2.5 text-center text-[13px] font-medium text-[var(--tx2)]">Tám định luật kiến trúc phần mềm</figcaption>
      </figure>
      <h3 className="m-0 mb-3 text-[18px] md:text-[19px] font-bold">Định luật 1. Mọi thứ trong kiến trúc phần mềm đều là sự đánh đổi</h3>
      <p className="m-0 mb-5">
        Không có lựa chọn kiến trúc nào chỉ mang lại lợi ích. Mỗi quyết định đều lấy một thuộc tính chất lượng để đổi cho một thuộc tính khác, và công việc của kiến trúc sư là làm cho sự đánh đổi đó trở nên hiển nhiên với tất cả các bên liên quan.
      </p>
      <blockquote className="m-0 mb-6 p-3.5 px-[18px] border-l-[3px] border-[var(--pri)] rounded-r-lg bg-[var(--surf)] text-[16px] md:text-base">
        Nếu một kiến trúc sư nghĩ rằng họ đã tìm ra một lựa chọn không có sự đánh đổi, nghĩa là họ chưa nhận ra sự đánh đổi đó.
      </blockquote>
      {pastedFigs.map((fg, i) => (
        <figure key={i} className="m-0 mb-6">
          <img alt={fg.name} src={fg.url} className="block max-w-full w-auto h-auto rounded-lg border border-[var(--bd)] bg-[var(--surf)]" />
          <figcaption className="mt-2.5 flex flex-wrap items-center gap-2 text-[12.5px] text-[var(--tx2)]">
            <span className="font-medium">{fg.name}</span>
            <code className="font-mono text-[11.5px] px-1.5 py-0.5 rounded bg-[var(--code)]">{fg.path}</code>
            <span className="flex items-center gap-1"><span className="material-symbols-rounded text-sm">folder</span>{fg.folder}</span>
          </figcaption>
        </figure>
      ))}
      {showProgress && <ReadingProgress />}
    </article>
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

function WorkflowArticle() {
  return (
    <article className="font-display max-w-[760px] mx-auto px-5 md:px-10 py-6 md:py-12 pb-32 text-[17px] leading-[1.7]">
      <h1 className="m-0 mb-5 text-[26px] md:text-[32px] leading-[1.25] font-bold tracking-[-0.015em]">WORKFLOW_EXPLAINED</h1>
      <p className="m-0 mb-5">
        Quy trình dịch sách gồm bốn bước: đọc bản gốc trong <em>Book to Translate</em>, dịch từng chương sang <em>Translated Book</em>, đối chiếu thuật ngữ, rồi cập nhật trạng thái trong Trading Journal.
      </p>
      <ul className="m-0 pl-[24px] flex flex-col gap-2 list-disc">
        <li>Mỗi chương là một note riêng, đặt tên theo số chương.</li>
        <li>Thuật ngữ chưa thống nhất đánh dấu bằng <code className="font-mono text-sm px-1.5 py-0.5 rounded bg-[var(--code)]">#cần-review</code>.</li>
        <li>Bản dịch xong chuyển sang trạng thái <strong className="font-bold">Done</strong>.</li>
      </ul>
    </article>
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
    const fileItem = items.find((it) => it.kind === 'file' && /^image\//.test(it.type))
    if (fileItem) {
      const file = fileItem.getAsFile()
      if (!file) return
      e.preventDefault()
      try {
        const att: any = await (s as any).uploadFile(file, curId)
        const url = att?.url || att?.path || `/api/files/${att?.id}`
        insertSnippetWithUrl(s, mdRef, `\n\n![](${url})\n`)
      } catch {
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
  const base = s.md ?? MD
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
  const base = s.md ?? MD
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

function NotePreview({ md, pastedFigs }: { md: string; pastedFigs: { name: string; url: string; path: string; folder: string }[] }) {
  // naive markdown preview: render markdown text with image urls preserved
  // For real rendering, replace with marked+DOMPurify if desired.
  // Here we do simple line breaks and show images via pastedFigs.
  const lines = md.split('\n')
  return (
    <article className="font-display max-w-[760px] mx-auto px-5 md:px-10 py-6 md:py-12 pb-32 text-[17px] leading-[1.7] whitespace-pre-wrap break-words">
      {lines.map((line, i) => {
        // detect markdown image: ![](url)
        const imgMatch = line.match(/!\[.*?\]\((\/api\/files\/[^)]+)\)/)
        if (imgMatch) {
          const url = imgMatch[1]
          return (
            <figure key={i} className="my-4">
              <img src={url} alt="" className="block max-w-full w-auto h-auto rounded-lg border border-[var(--bd)] bg-[var(--surf)]" />
            </figure>
          )
        }
        // headings
        if (line.startsWith('# ')) return <h1 key={i} className="text-[28px] font-bold mt-6 mb-3">{line.slice(2)}</h1>
        if (line.startsWith('## ')) return <h2 key={i} className="text-[22px] font-bold mt-5 mb-2">{line.slice(3)}</h2>
        if (line.startsWith('### ')) return <h3 key={i} className="text-[18px] font-bold mt-4 mb-2">{line.slice(4)}</h3>
        if (line.startsWith('> ')) return <blockquote key={i} className="my-3 p-3 px-[18px] border-l-[3px] border-[var(--pri)] rounded-r-lg bg-[var(--surf)]">{line.slice(2)}</blockquote>
        if (!line.trim()) return <div key={i} className="h-3" />
        return <p key={i} className="my-2">{line}</p>
      })}
      {pastedFigs.map((fg, i) => (
        <figure key={'fig'+i} className="m-0 mb-6 mt-4">
          <img alt={fg.name} src={fg.url} className="block max-w-full w-auto h-auto rounded-lg border border-[var(--bd)] bg-[var(--surf)]" />
          <figcaption className="mt-2.5 flex flex-wrap items-center gap-2 text-[12.5px] text-[var(--tx2)]">
            <span className="font-medium">{fg.name}</span>
            <code className="font-mono text-[11.5px] px-1.5 py-0.5 rounded bg-[var(--code)]">{fg.path}</code>
          </figcaption>
        </figure>
      ))}
    </article>
  )
}

function ReadingProgress() {
  const ref = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const scroller = el.closest('.overflow-y-auto') as HTMLElement | null
    if (!scroller) return
    const fill = el.querySelector('.read-progress-fill') as HTMLElement | null
    const onScroll = () => {
      const max = scroller.scrollHeight - scroller.clientHeight
      const pct = max > 0 ? (scroller.scrollTop / max) * 100 : 0
      if (fill) fill.style.height = pct + '%'
    }
    scroller.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => scroller.removeEventListener('scroll', onScroll)
  }, [])
  return (
    <div ref={ref} className="read-progress" aria-hidden>
      <div className="read-progress-fill" />
      <div className="read-progress-tick" style={{ top: '25%' }} />
      <div className="read-progress-tick" style={{ top: '50%' }} />
      <div className="read-progress-tick" style={{ top: '75%' }} />
    </div>
  )
}
