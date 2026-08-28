import { useRef, useState, useEffect } from 'react'
import { useVault, getChildrenLive, findRawLive, folderOptionsLive } from '../store/useVault'
import { TREE, MD } from '../mock/data'

// helper to compute path
function pathTo(id: string, s: any): string[] {
  const out: string[] = []
  const scan = (parentId: string | null, trail: string[]) => {
    for (const n of getChildrenLive(parentId, s)) {
      if (out.length) return
      if (n.id === id) { out.push(...trail, n.name); return }
      if ((n as any).children) scan(n.id, [...trail, n.name])
    }
  }
  scan(null, [])
  return out
}

export function Main() {
  const s = useVault()
  const mdRef = useRef<HTMLTextAreaElement>(null)
  const cur = s.openTabs[s.tab] ?? s.openTabs[0] ?? { kind: 'ch27', id: 'ch27', title: '' }
  const isNew = cur.kind === 'new'
  const c = s.dark ? { pri: s.accent, priC: '#14151F', bg: '#1E1F2B', tx: '#E7E8F0', tx2: '#9A9DB0', bd: '#32333F', surf: '#262735' } : { pri: s.accent, priC: '#FFF', bg: '#FFF', tx: '#22242E', tx2: '#6B6F80', bd: '#E4E6F0', surf: '#F7F8FC' }
  const on = { bg: c.pri, col: c.priC }
  const off = { bg: 'transparent', col: c.tx2 }

  const livePath = pathTo(cur.id, s)
  const crumbPath = isNew ? livePath.slice(0, -1) : livePath
  const crumbs = (crumbPath.length ? crumbPath : cur.kind === 'ch27' ? ['Book Translate','Translated Book','Fundamental Of Software Architecture','Chương 27. Các Định luật Kiến trúc Phần mềm, Nhìn lại'] : cur.kind === 'wf' ? ['Trading Journal','WORKFLOW_EXPLAINED'] : []).map((name,i,arr)=>({
    name, sep: (i < arr.length-1 || isNew) ? '/' : '', col: (i===arr.length-1 && !isNew) ? c.tx : c.tx2, fw: (i===arr.length-1 && !isNew) ? 500 : 400
  }))

  const mdValue = s.md ?? MD
  const pastedFigs = s.assets.filter(a => a.note === cur.id)

  const handlePaste = (e: React.ClipboardEvent) => {
    const dt = e.clipboardData
    if (!dt) return
    const items = Array.from(dt.items || [])
    const fileItem = items.find(it => it.kind === 'file' && /^image\//.test(it.type))
    if (fileItem) {
      const file = fileItem.getAsFile()
      if (!file) return
      e.preventDefault()
      const reader = new FileReader()
      reader.onload = () => {
        const url = reader.result as string
        s.storeAsset(file.name || ('pasted-'+Date.now()+'.png'), file.type || 'image/png', url, cur.id)
        insertSnippet(`\n\n![](${ '/api/files/demo' })\n`, url, file.name)
      }
      reader.readAsDataURL(file)
      return
    }
    const text = dt.getData('text/plain') || ''
    if (/^\s*<svg[\s>]/i.test(text)) {
      e.preventDefault()
      const url = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(text)))
      s.storeAsset('pasted-'+Date.now()+'.svg', 'image/svg+xml', url, cur.id)
      insertSnippet(`\n\n![]( /api/files/demo )\n`, url, 'svg')
    }
  }

  const insertSnippet = (snippet: string, _url?: string, _name?: string) => {
    const el = mdRef.current
    const base = s.md ?? MD
    const pos = el && typeof el.selectionStart === 'number' ? el.selectionStart : base.length
    const actualSnippet = snippet.replace('/api/files/demo', '/api/files/' + (s.assets[s.assets.length-1]?.gid ?? 'demo'))
    // but we already stored asset with gid, use last
    const next = base.slice(0,pos) + actualSnippet + base.slice(pos)
    s.setMd(next)
    requestAnimationFrame(()=>{
      if (!mdRef.current) return
      const p = pos + actualSnippet.length
      mdRef.current.focus()
      mdRef.current.selectionStart = mdRef.current.selectionEnd = p
    })
  }

  // simple md insert using assets after store — we handle via effect? For MVP paste we just append snippet above, ignoring async gid issue; we recompute with actual last asset
  useEffect(()=>{
    // when assets added, ensure markdown contains it? already done
  },[s.assets.length])

  const showPreview = cur.kind === 'ch27' && s.mode === 'preview'
  const showEditor = cur.kind === 'ch27' && s.mode === 'edit'
  const showOtherTab = cur.kind === 'wf'
  const showNew = isNew

  return (
    <main className="flex-1 min-w-0 flex flex-col bg-[var(--bg)]">
      {/* tabs */}
      <div className="flex items-end gap-0.5 h-[42px] shrink-0 px-2 bg-[var(--drw)] border-b border-[var(--bd)] overflow-x-auto overflow-y-hidden">
        {s.openTabs.map((t,i)=>(
          <div key={t.id+i} onClick={()=>s.setTab(i)} className="flex items-center gap-2 max-w-[290px] h-[34px] px-3.5 pr-2 rounded-t-[8px] cursor-pointer shrink-0 text-[13px]" style={{ background: s.tab===i? c.bg:'transparent', color: s.tab===i? c.tx: c.tx2, borderTop: `2px solid ${s.tab===i? c.pri:'transparent'}`, fontWeight: s.tab===i?500:400 }}>{/* */}
            <span className="overflow-hidden text-ellipsis whitespace-nowrap">{t.title || 'Không có tiêu đề'}</span>
            <span className="material-symbols-rounded text-base opacity-55">close</span>
          </div>
        ))}
        <button onClick={()=>s.startDraft('note')} className="grid place-items-center w-[30px] h-[30px] shrink-0 mb-0.5 rounded-[6px] bg-transparent text-[var(--tx2)] hover:bg-[var(--hov)] cursor-pointer"><span className="material-symbols-rounded text-[19px]">add</span></button>
      </div>

      {/* toolbar */}
      <div className="flex items-center gap-3 h-12 shrink-0 px-4 border-b border-[var(--bd)] overflow-hidden">
        <button className="grid place-items-center w-[30px] h-[30px] shrink-0 rounded-full bg-transparent text-[var(--tx2)] hover:bg-[var(--hov)] cursor-pointer"><span className="material-symbols-rounded text-[19px]">arrow_back</span></button>
        <button className="grid place-items-center w-[30px] h-[30px] shrink-0 rounded-full bg-transparent text-[var(--tx2)] hover:bg-[var(--hov)] cursor-pointer"><span className="material-symbols-rounded text-[19px]">arrow_forward</span></button>

        <div className="flex-1 min-w-[8em] flex items-center gap-1.5 text-[12.5px] text-[var(--tx2)] overflow-hidden whitespace-nowrap">
          {crumbs.map((crumb,idx)=>(
            <span key={idx} className="flex items-center gap-1.5 shrink min-w-[2.5em]">
              <span className="overflow-hidden text-ellipsis whitespace-nowrap cursor-pointer" style={{ color: crumb.col, fontWeight: crumb.fw as any }}>{crumb.name}</span>
              <span className="shrink-0 opacity-45">{crumb.sep}</span>
            </span>
          ))}
          {isNew && (
            <input autoFocus defaultValue={cur.title} onChange={(e)=>{
              const v = e.target.value
              const tabs = s.openTabs.map(t=> t.id===cur.id ? {...t, title:v}:t)
              ;(useVault as any).setState({ openTabs: tabs })
              // also update extra node name
              const extra = {...s.extra}
              for (const k of Object.keys(extra)) extra[k]=extra[k].map(n=> n.id===cur.id ? {...n, name: v.trim()||'Không có tiêu đề'}:n)
              ;(useVault as any).setState({ extra })
            }} placeholder="Tiêu đề note" className="flex-1 min-w-[80px] max-w-[340px] h-7 px-2 border border-[var(--pri)] rounded-[6px] bg-[var(--bg)] text-[13px] font-medium text-[var(--tx)] outline-0" />
          )}
        </div>

        <div className="flex shrink-0 p-0.5 gap-0.5 rounded-lg bg-[var(--surf)] border border-[var(--bd)]">
          <div onClick={()=>s.setMode('edit')} title="Chỉnh sửa" className="flex items-center gap-1.5 h-7 px-3 rounded-[6px] cursor-pointer text-[12.5px] font-medium" style={{ background: s.mode==='edit'?on.bg:off.bg, color: s.mode==='edit'?on.col:off.col }}>
            <span className="material-symbols-rounded text-base">edit_note</span><span>Chỉnh sửa</span>
          </div>
          <div onClick={()=>s.setMode('preview')} title="Xem trước" className="flex items-center gap-1.5 h-7 px-3 rounded-[6px] cursor-pointer text-[12.5px] font-medium" style={{ background: s.mode==='preview'?on.bg:off.bg, color: s.mode==='preview'?on.col:off.col }}>
            <span className="material-symbols-rounded text-base">visibility</span><span>Xem trước</span>
          </div>
        </div>

        <button onClick={()=>s.setPanel(!s.panel)} title="Mục lục" className="grid place-items-center w-[30px] h-[30px] shrink-0 rounded-full cursor-pointer" style={{ background: s.panel? (s.dark?'rgba(108,75,209,.26)':'rgba(63,81,181,.16)'): 'transparent', color: s.panel? c.pri : c.tx2 }}>
          <span className="material-symbols-rounded text-[19px]">format_list_bulleted</span>
        </button>
        <button className="grid place-items-center w-[30px] h-[30px] shrink-0 rounded-full bg-transparent text-[var(--tx2)] hover:bg-[var(--hov)] cursor-pointer"><span className="material-symbols-rounded text-[19px]">more_vert</span></button>
      </div>

      {/* content */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
        {showPreview && (
          <article className="max-w-[760px] mx-auto px-10 py-12 pb-24 text-[17px] leading-[1.72]" style={{ textWrap: 'pretty' as any }}>
            <h1 className="m-0 mb-7 text-[34px] leading-[1.24] font-bold tracking-[-0.015em]">Chương 27. Các Định luật Kiến trúc Phần mềm, Nhìn lại (The Laws of Software Architecture, Revisited)</h1>
            <p className="m-0 mb-[22px]">Khi chúng tôi bắt đầu viết cuốn sách này, chúng tôi đã đặt ra một bộ <strong className="font-bold">tám định luật kiến trúc phần mềm</strong> — những nguyên tắc cốt lõi mà chúng tôi tin rằng mọi kiến trúc sư nên hiểu và áp dụng. Bây giờ, khi cuốn sách đã hoàn thành, chúng tôi muốn <strong className="font-bold">nhìn lại (revisit)</strong> những định luật này trong bối cảnh của tất cả những gì chúng tôi đã trình bày. Mỗi định luật sẽ được kết nối với các chương cụ thể, giúp bạn thấy cách chúng hoạt động cùng nhau để tạo thành một bộ khung tư duy hoàn chỉnh cho kiến trúc phần mềm.</p>
            <p className="m-0 mb-3.5">Trong chương này, chúng tôi sẽ:</p>
            <ul className="m-0 mb-[30px] pl-[26px] flex flex-col gap-2 list-disc">
              <li>Tổng kết tám định luật kiến trúc phần mềm</li>
              <li>Kết nối mỗi định luật với các chương cụ thể trong cuốn sách</li>
              <li>Thảo luận về cách áp dụng từng định luật trong thực tế</li>
              <li>Chia sẻ suy nghĩ cuối cùng về vai trò của kiến trúc sư phần mềm</li>
            </ul>
            <h2 className="m-0 mb-[18px] text-[25px] leading-[1.3] font-bold tracking-[-0.01em]">Tám Định luật Kiến trúc Phần mềm (The Eight Laws of Software Architecture)</h2>
            <p className="m-0 mb-[26px]">Chúng tôi đã giới thiệu tám định luật kiến trúc phần mềm ở đầu cuốn sách. Bây giờ, sau khi đã đi qua tất cả các chương, hãy xem lại chúng trong <strong className="font-bold">Hình 27-1</strong>.</p>
            <figure className="m-0 mb-[30px]">
              <div className="h-[230px] border border-[var(--bd)] rounded-lg bg-[repeating-linear-gradient(135deg,var(--surf)_0_9px,var(--bg)_9px_18px)] grid place-items-center">
                <span className="font-mono text-[11.5px] tracking-[0.06em] text-[var(--tx2)] uppercase text-center px-3">hình 27-1 · sơ đồ tám định luật</span>
              </div>
              <figcaption className="mt-2.5 text-center text-[13px] font-medium text-[var(--tx2)]">Tám định luật kiến trúc phần mềm</figcaption>
            </figure>
            <h3 className="m-0 mb-3 text-[19px] font-bold">Định luật 1. Mọi thứ trong kiến trúc phần mềm đều là sự đánh đổi</h3>
            <p className="m-0 mb-5">Không có lựa chọn kiến trúc nào chỉ mang lại lợi ích. Mỗi quyết định đều lấy một thuộc tính chất lượng để đổi cho một thuộc tính khác, và công việc của kiến trúc sư là làm cho sự đánh đổi đó trở nên hiển nhiên với tất cả các bên liên quan.</p>
            <blockquote className="m-0 mb-6 p-3.5 px-[18px] border-l-[3px] border-[var(--pri)] rounded-r-lg bg-[var(--surf)] text-base">Nếu một kiến trúc sư nghĩ rằng họ đã tìm ra một lựa chọn không có sự đánh đổi, nghĩa là họ chưa nhận ra sự đánh đổi đó.</blockquote>
            {pastedFigs.map((fg,i)=>(
              <figure key={i} className="m-0 mb-7">
                <img alt={fg.name} src={fg.url} className="block max-w-full w-auto h-auto rounded-lg border border-[var(--bd)] bg-[var(--surf)]" />
                <figcaption className="mt-2.5 flex flex-wrap items-center gap-2 text-[12.5px] text-[var(--tx2)]">
                  <span className="font-medium">{fg.name}</span>
                  <code className="font-mono text-[11.5px] px-1.5 py-0.5 rounded bg-[var(--code)]">{fg.path}</code>
                  <span className="flex items-center gap-1"><span className="material-symbols-rounded text-sm">folder</span>{fg.folder}</span>
                </figcaption>
              </figure>
            ))}
          </article>
        )}
        {showEditor && (
          <div className="max-w-[820px] mx-auto px-10 py-9 pb-24">
            <div className="flex items-center gap-2 mb-3.5 font-mono text-[11px] tracking-[0.08em] uppercase text-[var(--tx2)]">
              <span className="material-symbols-rounded text-[15px]">code</span>markdown source
              <span className="flex items-center gap-1.5 ml-auto normal-case tracking-normal font-sans text-[11.5px] px-2.5 py-0.5 rounded-full bg-[var(--surf)] border border-[var(--bd)]"><span className="material-symbols-rounded text-sm text-[var(--pri)]">content_paste</span>Ctrl+V để dán ảnh hoặc SVG</span>
            </div>
            <textarea
              ref={mdRef}
              value={mdValue}
              onChange={(e)=>s.setMd(e.target.value)}
              onPaste={handlePaste}
              spellCheck={false}
              className="block w-full min-h-[58vh] box-border resize-y border border-[var(--bd)] rounded-[10px] p-4 px-[18px] outline-0 bg-[var(--bg)] m-0 font-mono text-sm leading-[1.85] text-[var(--tx)] focus:border-[var(--pri)]"
            />
          </div>
        )}
        {showOtherTab && (
          <article className="max-w-[760px] mx-auto px-10 py-12 pb-24 text-[17px] leading-[1.72]">
            <h1 className="m-0 mb-6 text-[32px] leading-[1.25] font-bold tracking-[-0.015em]">WORKFLOW_EXPLAINED</h1>
            <p className="m-0 mb-5">Quy trình dịch sách gồm bốn bước: đọc bản gốc trong <em>Book to Translate</em>, dịch từng chương sang <em>Translated Book</em>, đối chiếu thuật ngữ, rồi cập nhật trạng thái trong Trading Journal.</p>
            <ul className="m-0 pl-[26px] flex flex-col gap-2 list-disc">
              <li>Mỗi chương là một note riêng, đặt tên theo số chương.</li>
              <li>Thuật ngữ chưa thống nhất đánh dấu bằng <code className="font-mono text-sm px-1.5 py-0.5 rounded bg-[var(--code)]">#cần-review</code>.</li>
              <li>Bản dịch xong chuyển sang trạng thái <strong className="font-bold">Done</strong>.</li>
            </ul>
          </article>
        )}
        {showNew && (
          <div className="max-w-[760px] mx-auto px-10 py-12 pb-24">
            <div className="text-[34px] leading-[1.24] font-bold tracking-[-0.015em]" style={{ color: cur.title? c.tx : c.tx2 }}>{cur.title || 'Không có tiêu đề'}</div>
            <div className="flex items-center flex-wrap gap-2.5 my-[22px] mb-[26px] font-mono text-[11px] tracking-[0.07em] uppercase text-[var(--tx2)]">
              <span className="px-2 py-0.5 rounded-[5px] bg-[var(--sel)] text-[var(--pri)]">note mới</span>
              <span>{livePath.slice(0,-1).join(' / ') || 'Vault'}</span>
            </div>
            <div className="flex items-start gap-0.5 text-[17px] leading-[1.72] text-[var(--tx2)]">
              <span className="inline-block w-0.5 h-6 bg-[var(--pri)] shrink-0" />
              <span className="pl-2">Bắt đầu viết bằng Markdown. Nội dung tự động lưu.</span>
            </div>
          </div>
        )}
      </div>

      {/* status */}
      <div className="flex items-center gap-[18px] h-8 shrink-0 px-4 border-t border-[var(--bd)] bg-[var(--surf)] text-[var(--tx2)] text-[11.5px] tracking-[0.02em]">
        <span className="flex items-center gap-1.5"><span className="material-symbols-rounded text-sm">link</span>0 backlinks</span>
        <span>2.813 từ</span>
        <span>14.499 ký tự</span>
        <div className="flex-1" />
        <span className="flex items-center gap-1.5"><span className="material-symbols-rounded text-sm">cloud_done</span>Đã lưu</span>
      </div>
    </main>
  )
}
