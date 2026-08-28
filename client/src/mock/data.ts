export type TreeNode = {
  id: string
  name: string
  children?: TreeNode[]
}

export const TREE: TreeNode[] = [
  { id: 'ai', name: 'AI Trading Research Lab', children: [
    { id: 'ai-1', name: 'Signals', children: [{ id: 'ai-n1', name: 'RSI divergence study' }] },
    { id: 'ai-n2', name: 'Model log' }
  ]},
  { id: 'bt', name: 'Book Translate', children: [
    { id: 'bt-src', name: 'Book to Translate', children: [
      { id: 'bt-src-1', name: 'Fundamental Of Software Architecture (EN)' }
    ]},
    { id: 'bt-out', name: 'Translated Book', children: [
      { id: 'fosa', name: 'Fundamental Of Software Architecture', children: [
        { id: 'ch26', name: 'Chương 26. Kiến trúc sư hiệu quả' },
        { id: 'ch27', name: 'Chương 27. Các Định luật Kiến trúc Phần mềm, Nhìn lại' },
        { id: 'ch28', name: 'Chương 28. Phụ lục thuật ngữ' }
      ]}
    ]}
  ]},
  { id: 'ta', name: 'Trading Analysis', children: [
    { id: 'eur', name: 'EURUSD_2005Q3-2006Q1_D1_001', children: [
      { id: 'eur-n1', name: 'Wyckoff phases' }
    ]}
  ]},
  { id: 'tj', name: 'Trading Journal', children: [
    { id: 'tj00', name: '00 - Inbox', children: [{ id: 'tj00-n', name: 'Ý tưởng setup' }] },
    { id: 'tj01', name: '01 - Dashboard', children: [{ id: 'tj01-n', name: 'Equity curve' }] },
    { id: 'tj02', name: '02 - Trading Knowledge', children: [{ id: 'tj02-n', name: 'Order block' }] },
    { id: 'tj03', name: '03 - Playbooks', children: [{ id: 'tj03-n', name: 'London open' }] },
    { id: 'tj04', name: '04 - Backtesting' },
    { id: 'tj05', name: '05 - Live Trading Journal' },
    { id: 'tj06', name: '06 - Mistake Database' },
    { id: 'tj07', name: '07 - Reviews' },
    { id: 'tj08', name: '08 - Templates' },
    { id: 'tj09', name: '09 - Goal Tracking' },
    { id: 'tj10', name: '10 - Market Analysis' },
    { id: 'claude', name: 'CLAUDE' },
    { id: 'ict', name: 'Lộ trình ICT → FTMO 100K & The5ers 100K' },
    { id: 'readme', name: 'README' }
  ]}
]

export const MD = `# Chương 27. Các Định luật Kiến trúc Phần mềm, Nhìn lại (The Laws of Software Architecture, Revisited)

Khi chúng tôi bắt đầu viết cuốn sách này, chúng tôi đã đặt ra một bộ **tám định luật kiến trúc phần mềm** — những nguyên tắc cốt lõi mà chúng tôi tin rằng mọi kiến trúc sư nên hiểu và áp dụng. Bây giờ, khi cuốn sách đã hoàn thành, chúng tôi muốn **nhìn lại (revisit)** những định luật này trong bối cảnh của tất cả những gì chúng tôi đã trình bày.

Trong chương này, chúng tôi sẽ:

- Tổng kết tám định luật kiến trúc phần mềm
- Kết nối mỗi định luật với các chương cụ thể trong cuốn sách
- Thảo luận về cách áp dụng từng định luật trong thực tế
- Chia sẻ suy nghĩ cuối cùng về vai trò của kiến trúc sư phần mềm

## Tám Định luật Kiến trúc Phần mềm (The Eight Laws of Software Architecture)

Chúng tôi đã giới thiệu tám định luật kiến trúc phần mềm ở đầu cuốn sách. Bây giờ, sau khi đã đi qua tất cả các chương, hãy xem lại chúng trong **Hình 27-1**.

![hinh-27-1.png](/api/files/demo)

### Định luật 1. Mọi thứ trong kiến trúc phần mềm đều là sự đánh đổi

Không có lựa chọn kiến trúc nào chỉ mang lại lợi ích. Mỗi quyết định đều lấy một thuộc tính chất lượng để đổi cho một thuộc tính khác.

> Nếu một kiến trúc sư nghĩ rằng họ đã tìm ra một lựa chọn không có sự đánh đổi, nghĩa là họ chưa nhận ra sự đánh đổi đó.`

export function flatTree(nodes: TreeNode[], path: string[] = []): {id:string; name:string; kind:'folder'|'note'; path:string}[] {
  const out: {id:string; name:string; kind:'folder'|'note'; path:string}[] = []
  for (const n of nodes) {
    const isFolder = !!n.children
    out.push({ id: n.id, name: n.name, kind: isFolder ? 'folder' : 'note', path: path.join(' / ') || 'Vault' })
    if (n.children) out.push(...flatTree(n.children, [...path, n.name]))
  }
  return out
}
export const FLAT = flatTree(TREE)
