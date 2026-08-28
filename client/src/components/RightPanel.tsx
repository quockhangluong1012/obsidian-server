import { useVault } from '../store/useVault'

export function RightPanel() {
  const s = useVault()
  if (!s.panel) return null
  return (
    <aside className="w-[268px] shrink-0 flex flex-col gap-0.5 bg-[var(--drw)] border-l border-[var(--bd)] overflow-y-auto overscroll-contain">
      <div className="flex items-center gap-2 h-11 px-4 shrink-0 text-[var(--tx2)] text-[11px] font-medium tracking-[0.1em] uppercase">
        <span className="material-symbols-rounded text-[17px]">format_list_bulleted</span>Mục lục
      </div>
      <div className="px-2.5 pb-4 flex flex-col gap-px">
        <div className="px-2.5 py-1.5 rounded-[6px] text-[13px] font-medium bg-[var(--sel)] text-[var(--pri)] cursor-pointer">Chương 27. Các Định luật Kiến trúc Phần mềm, Nhìn lại</div>
        <div className="px-2.5 py-1.5 pl-[22px] rounded-[6px] text-[13px] cursor-pointer hover:bg-[var(--hov)]">Tám Định luật Kiến trúc Phần mềm</div>
        <div className="px-2.5 py-1.5 pl-[34px] rounded-[6px] text-[13px] text-[var(--tx2)] cursor-pointer hover:bg-[var(--hov)]">Định luật 1. Mọi thứ đều là sự đánh đổi</div>
        <div className="px-2.5 py-1.5 pl-[34px] rounded-[6px] text-[13px] text-[var(--tx2)] cursor-pointer hover:bg-[var(--hov)]">Định luật 2. Tại sao quan trọng hơn cách làm</div>
      </div>

      <div className="h-px mx-4 bg-[var(--bd)] shrink-0" />

      <div className="flex items-center gap-2 h-11 px-4 shrink-0 text-[var(--tx2)] text-[11px] font-medium tracking-[0.1em] uppercase">
        <span className="material-symbols-rounded text-[17px]">link</span>Backlinks
        <div className="flex-1" />
        <span className="px-1.5 py-px rounded-[10px] bg-[var(--sel)] text-[var(--pri)] text-[11px] tracking-normal">0</span>
      </div>
      <div className="mx-2.5 p-[18px_14px] border border-dashed border-[var(--bd)] rounded-lg text-center text-[var(--tx2)] text-[12.5px] leading-[1.6]">Chưa có note nào liên kết tới đây.</div>

      <div className="flex items-center gap-2 h-11 px-4 mt-2.5 shrink-0 text-[var(--tx2)] text-[11px] font-medium tracking-[0.1em] uppercase">
        <span className="material-symbols-rounded text-[17px]">sell</span>Tags
      </div>
      <div className="flex flex-wrap gap-1.5 px-3.5 pb-6">
        <span className="px-2.5 py-0.5 rounded-full border border-[var(--bd)] bg-[var(--bg)] text-xs text-[var(--pri)] cursor-pointer">#kiến-trúc</span>
        <span className="px-2.5 py-0.5 rounded-full border border-[var(--bd)] bg-[var(--bg)] text-xs text-[var(--pri)] cursor-pointer">#dịch-sách</span>
        <span className="px-2.5 py-0.5 rounded-full border border-[var(--bd)] bg-[var(--bg)] text-xs text-[var(--pri)] cursor-pointer">#cần-review</span>
      </div>
    </aside>
  )
}
