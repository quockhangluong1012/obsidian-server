# Obsidian-lite Web UI

Clone pixel từ `spec/Note Workspace.html` — tập trung bản Web (desktop), chưa làm mobile/PWA/server.

## Stack
- Vite 6 + React 19 + TypeScript
- Tailwind 4 + CSS vars (`src/styles/tokens.css`) — giữ token `bg/surf/drw/bd/tx/tx2/pri/priC/sel/hov/code` như design
- Zustand cho vault state (expanded/moved/assets/mode/lock)
- Fonts: Roboto + Roboto Mono + Material Symbols Rounded (Google Fonts)

## Chạy dev
```bash
cd client
npm install
npm run dev # http://localhost:5173
npm run build && npm run preview
```

## Đã implement (so với SPEC.md:29)
- F-02: cây thư mục lồng nhau, folder rỗng, expand/collapse, thu gọn tất cả
- F-01/F-15/F-16: tạo note/folder inline (draft), đổi tên (placeholder), kéo-thả move (giữ path vật lý /api/files), chuột phải menu (folder/note/asset)
- F-04: toggle Chỉnh sửa / Xem trước, editor textarea + paste ảnh/SVG → lưu asset + chèn `![](/api/files/{id})` + upload chip
- F-07/F-09: asset hiện như node trong cây (icon image/shapes), viewer + move vị trí hiển thị
- F-14: Command palette Ctrl+K
- Right panel: Mục lục/Backlinks/Tags (tĩnh)
- Dark mode toggle, accent #6C4BD1, toast snackbar, lock screen (mặc định unlock cho MVP)

## Chưa làm (để Phase server/mobile)
- API thật / SQLite FTS5 / autosave debounce server
- PWA, responsive phone (780px), inline SVG sanitize thực tế, KaTeX/Mermaid render

## Cấu trúc
```
client/src/
 ├─ mock/data.ts (TREE, MD, FLAT)
 ├─ store/useVault.ts (zustand + helpers getChildrenLive/folderOptionsLive)
 ├─ components/{Sidebar, Main, RightPanel, Overlays, LockScreen}.tsx
 ├─ styles/tokens.css
 ├─ App.tsx + main.tsx
```
