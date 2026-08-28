import { useVault } from '../store/useVault'

type Props = { forceOpen?: boolean }

export function RightPanel({ forceOpen = false }: Props) {
  const s = useVault()
  if (!forceOpen && !s.panel) return null

  return (
    <aside className="w-full md:w-[268px] md:shrink-0 flex flex-col gap-0.5 bg-[var(--drw)] md:border-l border-[var(--bd)] overflow-y-auto overscroll-contain">
      <div className="flex items-center gap-2 h-14 md:h-11 px-5 md:px-4 shrink-0 text-[var(--tx2)] text-[11px] font-medium tracking-[0.1em] uppercase">
        <span className="material-symbols-rounded text-[18px] md:text-[17px]">format_list_bulleted</span>
        Mục lục
      </div>
      <div className="px-3 md:px-2.5 pb-4 flex flex-col gap-px">
        <div className="px-3 md:px-2.5 py-2.5 md:py-1.5 rounded-[8px] md:rounded-[6px] text-[15px] md:text-[13px] font-medium bg-[var(--sel)] text-[var(--pri)]">
          Chương 27. Các Định luật Kiến trúc Phần mềm, Nhìn lại
        </div>
        <div className="px-3 md:px-2.5 py-2.5 md:py-1.5 pl-6 md:pl-[22px] rounded-[8px] md:rounded-[6px] text-[15px] md:text-[13px] hover:bg-[var(--hov)]">
          Tám Định luật Kiến trúc Phần mềm
        </div>
        <div className="px-3 md:px-2.5 py-2.5 md:py-1.5 pl-8 md:pl-[34px] rounded-[8px] md:rounded-[6px] text-[14px] md:text-[13px] text-[var(--tx2)] hover:bg-[var(--hov)]">
          Định luật 1. Mọi thứ đều là sự đánh đổi
        </div>
        <div className="px-3 md:px-2.5 py-2.5 md:py-1.5 pl-8 md:pl-[34px] rounded-[8px] md:rounded-[6px] text-[14px] md:text-[13px] text-[var(--tx2)] hover:bg-[var(--hov)]">
          Định luật 2. Tại sao quan trọng hơn cách làm
        </div>
      </div>

      <div className="h-px mx-5 md:mx-4 bg-[var(--bd)] shrink-0" />

      <div className="flex items-center gap-2 h-14 md:h-11 px-5 md:px-4 shrink-0 text-[var(--tx2)] text-[11px] font-medium tracking-[0.1em] uppercase">
        <span className="material-symbols-rounded text-[18px] md:text-[17px]">link</span>
        Backlinks
        <div className="flex-1" />
        <span className="px-1.5 py-px rounded-[10px] bg-[var(--sel)] text-[var(--pri)] text-[11px] tracking-normal">0</span>
      </div>
      <div className="mx-4 md:mx-2.5 p-5 md:p-[18px_14px] border border-dashed border-[var(--bd)] rounded-lg text-center text-[var(--tx2)] text-[13px] md:text-[12.5px] leading-[1.6]">
        Chưa có note nào liên kết tới đây.
      </div>

      <div className="flex items-center gap-2 h-14 md:h-11 px-5 md:px-4 mt-2.5 shrink-0 text-[var(--tx2)] text-[11px] font-medium tracking-[0.1em] uppercase">
        <span className="material-symbols-rounded text-[18px] md:text-[17px]">sell</span>
        Tags
      </div>
      <div className="flex flex-wrap gap-2 px-5 md:px-3.5 pb-8">
        <span className="px-3 py-1 rounded-full border border-[var(--bd)] bg-[var(--bg)] text-[13px] md:text-xs text-[var(--pri)]">#kiến-trúc</span>
        <span className="px-3 py-1 rounded-full border border-[var(--bd)] bg-[var(--bg)] text-[13px] md:text-xs text-[var(--pri)]">#dịch-sách</span>
        <span className="px-3 py-1 rounded-full border border-[var(--bd)] bg-[var(--bg)] text-[13px] md:text-xs text-[var(--pri)]">#cần-review</span>
      </div>
    </aside>
  )
}
