# SPEC — Obsidian-lite

Web app ghi chú markdown self-hosted, dùng cho **một người**, thay thế việc đồng bộ Obsidian qua file bằng một server duy nhất truy cập từ nhiều thiết bị.

> Phiên bản: 1.2 — 2026-09-05
> Trạng thái: Chốt stack `React + ASP.NET Minimal API + SQLite (filesystem cho file)`, sẵn sàng thực thi.

---

## 1. Mục tiêu (Goals)

- Tạo, đọc, sửa, xóa nội dung ghi chú **markdown** từ trình duyệt (chỉnh sửa trên desktop; mobile tập trung tối đa cho đọc).
- Tập trung **hiển thị tốt** nội dung: markdown, **SVG (inline & file)**, **image (paste/upload)**.
- Note được tổ chức theo **cây thư mục** (giống vault Obsidian).
- **Desktop**: chỉnh sửa đầy đủ (split source + live preview).
- **Mobile**: chỉ đọc (read-only) — không có chế độ Chỉnh sửa; tạo/sửa nội dung note thực hiện trên desktop.
- Dữ liệu tập trung **1 file SQLite** (`obsidian.db`) + thư mục `data/files` cho ảnh/SVG, dễ backup.
- Cài được như **PWA** (add to home screen + xem offline note đã xem).

## 2. Ngoài phạm vi (Non-goals)

- Không đa người dùng, **không phân quyền/auth**.
- Không đồng bộ 2 chiều ngược lại vào thư mục Obsidian trên disk (không lock-in vào DB là chấp nhận được).
- Không hỗ trợ plugin cộng đồng của Obsidian.

## 3. Yêu cầu bắt buộc (Requirements)

### 3.1 Chức năng
| ID | Yêu cầu | Ưu tiên |
|----|---------|---------|
| F-01 | Tạo / sửa / xóa note markdown | Cao |
| F-02 | Tạo / sửa / xóa **thư mục lồng nhau** (folder rỗng được phép) | Cao |
| F-03 | Di chuyển note giữa các thư mục | Trung bình |
| F-04 | Editor **split** source + live preview (desktop) | Cao |
| F-05 | Autosave với debounce (không save mỗi keystroke) | Cao |
| F-06 | Tìm kiếm **full-text** (FTS5) theo tiêu đề + nội dung | Cao |
| F-07 | Upload / paste ảnh & SVG → lưu disk → chèn link vào note | Cao |
| F-08 | Hiển thị markdown chuẩn + code highlight + bảng + toán (KaTeX) + sơ đồ (Mermaid) | Cao |
| F-09 | Hiển thị **inline SVG** (raw HTML) an toàn | Cao |
| F-10 | Mobile: chỉ chế độ đọc (read-only), không có editor | Cao |
| F-11 | PWA: cài màn hình chính, offline cache note đã xem | Trung bình |
| F-12 | Export note ra `.md` | Thấp |
| F-13 | Backup file `.db` + thư mục `data/files` (thủ công/script) | Trung bình |
| F-14 | Command palette (Ctrl/Cmd+K): nhảy nhanh tới note/thư mục | Trung bình |
| F-15 | Chuột phải (desktop) / nhấn giữ (mobile) trên thư mục, note, tệp đính kèm: menu thao tác (tạo mới, đổi tên, nhân bản, di chuyển, xoá) | Trung bình |
| F-16 | Kéo-thả note/thư mục/tệp đính kèm để di chuyển trong cây, kể cả thả ra gốc vault | Trung bình |
| F-17 | Backlinks (`[[Title]]`) và Tags (`#tag`) hiển thị ở panel bên phải | Trung bình |
| F-18 | Tệp đính kèm (ảnh/SVG đã dán/upload) hiển thị như node trong cây, có trình xem + di chuyển vị trí hiển thị (đường dẫn vật lý `/api/files/{id}` không đổi) | Trung bình |

### 3.2 Phi chức năng
- 10.000 note: tìm kiếm & mở note nhanh (SQLite/FTS5 đáp ứng thoải mái).
- Single-user → không cần lo ghi đồng thời; SQLite `WAL` mode.
- Mobile: chỉ chế độ đọc, không nạp editor/textarea, ảnh/svg `max-width:100%`, bảng/code scroll ngang.

---

## 4. Stack công nghệ

| Thành phần | Lựa chọn |
|-----------|----------|
| Runtime | .NET 8 (LTS) |
| Frontend | React 19 + Vite + Zustand + Tailwind CSS (thư mục `client/`) |
| Backend | ASP.NET Core Minimal API (Kestrel) |
| ORM / DB | EF Core 8 + **SQLite** (`obsidian.db`, `journal_mode=WAL`, `foreign_keys=ON`) |
| File storage | **Filesystem** (`data/files/{yyyy}/{MM}/{id}.{ext}`) + metadata trong DB (`Attachments.StoragePath`) |
| Full-text search | SQLite **FTS5** |
| Editor | CodeMirror 6 (desktop) |
| Render markdown | `marked` + `DOMPurify` (sanitize) |
| Code highlight | `highlight.js` |
| Toán học | KaTeX |
| Sơ đồ | Mermaid |
| PWA | `manifest.webmanifest` + service worker (`client/public/`) |
| Deploy | `dotnet publish` (server) + `vite build` (client/dist) → Kestrel serve static + API (không Docker) |

> Lý do: React SPA đã có sẵn (`client/src/App.tsx`), API stateless giúp PWA offline cache được và không phụ thuộc SignalR. SQLite giữ backup 1 file DB + 1 thư mục files.

---

## 5. Kiến trúc

```
Browser (React SPA - Vite)
  ├─ Desktop: Sidebar (cây thư mục) + Main (CodeMirror / preview) + RightPanel
  ├─ Mobile : cây thư mục + view read-only (không có editor)
  └─ fetch /api/* (JSON) ──> ASP.NET Core Minimal API (Kestrel)
                                ├─ FolderEndpoints / NoteEndpoints / SearchEndpoints
                                ├─ FileEndpoints (PhysicalFile, multipart upload)
                                └─ EF Core ──> SQLite (obsidian.db + Notes_FTS)
                                └─ Disk ─────> data/files/{id} (Attachment.StoragePath)

Ảnh/SVG: <img src="/api/files/{id}"> -> PhysicalFile + Content-Type + Range
```

- **Ảnh/SVG** phục vụ qua `GET /api/files/{id}` (stream file từ disk, `enableRangeProcessing: true`), không lưu BLOB trong DB.
- **CORS**: cho phép `http://localhost:5173` (Vite dev) trong Development.
- **PWA**: do client đảm nhiệm, API cung cấp `GET /api/*` để SW cache network-first.

---

## 6. Cấu trúc thư mục dự án

```
obsidian-server/
├─ spec/SPEC.md
├─ README.md
├─ client/                         # React SPA (đã có)
│  ├─ src/
│  │  ├─ components/Sidebar.tsx, Main.tsx, Overlays.tsx, RightPanel.tsx
│  │  ├─ store/useVault.ts         # sẽ thay mock bằng fetch
│  │  └─ mock/data.ts
│  ├─ vite.config.ts               # proxy /api -> http://localhost:5000
│  └─ dist/                        # output vite build, server serve static
└─ server/                         # ASP.NET Core Minimal API
   ├─ Server.csproj
   ├─ Program.cs                   # DI, SQLite WAL, CORS, endpoints, static files
   ├─ appsettings.json             # ConnectionStrings:obsidian, Storage:Root
   ├─ appsettings.Development.json
   ├─ Data/
   │  ├─ AppDbContext.cs
   │  └─ Migrations/
   ├─ Models/
   │  ├─ Folder.cs
   │  ├─ Note.cs
   │  └─ Attachment.cs             # StoragePath thay Data BLOB
   ├─ Endpoints/
   │  ├─ FolderEndpoints.cs
   │  ├─ NoteEndpoints.cs
   │  ├─ SearchEndpoints.cs
   │  └─ FileEndpoints.cs
   └─ Services/
      ├─ FolderService.cs
      ├─ NoteService.cs
      ├─ AttachmentService.cs      # lưu/đọc file disk
      └─ SearchService.cs
```

---

## 7. Schema database

### `Folders`
| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| Id | TEXT (GUID) | PK |
| Name | TEXT | Tên folder |
| ParentId | TEXT nullable | FK → Folders.Id, NULL = root |
| CreatedAt | TEXT (ISO) | |

### `Notes`
| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| Id | TEXT (GUID) | PK |
| Title | TEXT | Tiêu đề hiển thị (= tên file) |
| FolderId | TEXT nullable | FK → Folders.Id. NULL = gốc vault |
| Content | TEXT | Markdown thuần |
| CreatedAt | TEXT (ISO) | |
| UpdatedAt | TEXT (ISO) | |

### `Attachments` (metadata, file trên disk)
| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| Id | TEXT (GUID) | PK, dùng trong `/api/files/{id}` |
| FileName | TEXT | Tên gốc |
| ContentType | TEXT | MIME (image/*, image/svg+xml) |
| StoragePath | TEXT | Đường dẫn tương đối trong `data/files/...` |
| Size | INTEGER | bytes |
| FolderId | TEXT nullable | Vị trí hiển thị trong cây (di chuyển chỉ đổi cột này); NULL = gốc |
| NoteId | TEXT nullable | Note gốc đã dán/upload |
| CreatedAt | TEXT (ISO) | |

> File vật lý lưu tại `data/files/{yyyy}/{MM}/{Id}.{ext}`. Đường dẫn API `/api/files/{Id}` cố định, không đổi khi di chuyển `FolderId`.

### `Notes_FTS` (FTS5)
- Virtual table `CREATE VIRTUAL TABLE Notes_FTS USING fts5(Title, Content, content='Notes', content_rowid='rowid')`.
- Đồng bộ bằng triggers `AFTER INSERT/UPDATE/DELETE` trên `Notes`.
- SQLite pragmas: `journal_mode=WAL`, `foreign_keys=ON`, `synchronous=NORMAL`.

---

## 8. API Endpoints

| Method | Đường dẫn | Mô tả |
|--------|-----------|-------|
| `GET` | `/api/folders` | List folders (flat) |
| `GET` | `/api/folders/tree` | Cây thư mục + counts |
| `POST` | `/api/folders` | Tạo folder `{ name, parentId }` |
| `PUT` | `/api/folders/{id}` | Đổi tên `{ name }` |
| `DELETE` | `/api/folders/{id}` | Xoá (chỉ khi rỗng hoặc cascade) |
| `PUT` | `/api/folders/{id}/move` | Di chuyển `{ targetParentId }` |
| `GET` | `/api/notes` | List notes `?folderId=` |
| `GET` | `/api/notes/{id}` | Chi tiết note |
| `POST` | `/api/notes` | Tạo note `{ title, folderId, content }` |
| `PUT` | `/api/notes/{id}` | Sửa note `{ title, content }` |
| `DELETE` | `/api/notes/{id}` | Xoá note |
| `PUT` | `/api/notes/{id}/move` | Di chuyển note `{ targetFolderId }` |
| `POST` | `/api/notes/{id}/duplicate` | Nhân bản note |
| `GET` | `/api/search?q=` | FTS5 search title+content |
| `GET` | `/api/attachments` | List attachments `?folderId=` |
| `GET` | `/api/files/{id}` | Stream file (PhysicalFile + Content-Type + Range) |
| `POST` | `/api/files` | Upload multipart `file` + `noteId?` → `{ id, url, fileName, size }` |
| `PUT` | `/api/files/{id}/move` | Di chuyển vị trí hiển thị `{ targetFolderId }` (không đổi url) |
| `DELETE` | `/api/files/{id}` | Xoá file (xoá disk + DB) |
| `GET` | `/api/files/{id}/meta` | Metadata attachment |
| `GET` | `/health` | Health check |

Tất cả trả JSON `snake_case` hoặc `camelCase` thống nhất (cấu hình `JsonOptions`).

---

## 9. Hành vi UI

### 9.1 Desktop (≥ 768px)
- **Sidebar**: cây thư mục (expand/collapse), mỗi folder hiển thị danh sách note con + attachments. Bấm note → mở tab.
- **Chi tiết note**: `source (CodeMirror)` | `preview (live)`, toggle `Chỉnh sửa/Xem trước`.
- Autosave: debounce ~800ms sau khi dừng gõ, hoặc save khi blur.

### 9.2 Mobile (< 768px)
- **Chỉ đọc** — không có chế độ Chỉnh sửa, không render editor/textarea. Mọi note luôn hiển thị dạng preview (markdown đã render).
- Tạo/sửa nội dung note thực hiện trên desktop; trên mobile vẫn xem, tìm kiếm, và thao tác vị trí (đổi tên/di chuyển/xoá note-folder) qua menu ngữ cảnh (long-press).
- Điều hướng: **cây thư mục → list note trong folder → view note** (back bằng nút quay lại).
- Top bar tự ẩn khi cuộn xuống, hiện lại khi cuộn lên hoặc gần đầu trang — tối đa hoá vùng đọc.
- Panel mục lục/backlinks/tags và command palette hiển thị dạng bottom sheet / toàn màn hình.
- Responsive:
  - `img, svg { max-width: 100%; height: auto; }`
  - Code block & bảng: `overflow-x: auto` (scroll ngang).
  - Cỡ chữ đọc chỉnh qua "Aa" (0.85×–1.6× cỡ gốc 18px), lưu riêng theo thiết bị.
- Phát hiện bằng **CSS media query** làm chính (không dựa user-agent).

---

## 10. Render nội dung

Pipeline render (client-side, khi mở view/preview):

```
raw markdown
  → marked (có GFM: bảng, checkbox, strikethrough)
  → mở rộng: code block ```mermaid → Mermaid; ```math/katex hoặc $...$ → KaTeX
  → highlight.js cho code
  → DOMPurify sanitize (allowlist thêm <svg>, <path>, <mathml>)
  → gắn vào DOM
```

- **Inline SVG**: cho phép raw HTML chứa `<svg>` bằng cấu hình DOMPurify `ADD_TAGS` / `ADD_ATTR`.
- **Ảnh/SVG file**: `<img src="/api/files/{id}">` — trình duyệt render natively, stream từ disk.
- **Ảnh paste**: bắt sự kiện paste → `POST /api/files` → chèn `![](/api/files/{id})`.

---

## 11. PWA

- `manifest.webmanifest`: tên, icon, `display: standalone`, `start_url`, theme color (thuộc `client/`).
- Service worker (`sw.js`):
  - Precache shell (html/css/js).
  - **Runtime cache** các `GET /api/notes/*`, `GET /api/folders/*`, `GET /api/files/*` để đọc **offline**.
  - Strategy: network-first cho dữ liệu, cache-first cho asset tĩnh.

---

## 12. Backup & Export

- **Export note**: `GET /api/notes/{id}/export` hoặc client tải `content` thành `.md`.
- **Backup**: copy `obsidian.db` (dùng `VACUUM INTO 'backup.db'` khi đang chạy) + nén `data/files/`. Script thủ công/định kỳ.

---

## 13. Bảo mật & an toàn

- Không auth (single user) → **không expose ra internet công cộng**; khuyến nghị chạy sau VPN/Tailscale hoặc chỉ mạng LAN.
- DOMPurify bắt buộc trước khi render mọi nội dung markdown/HTML (chống XSS qua raw HTML/SVG).
- Upload: giới hạn `10MB/file`, allowlist `ContentType` (`image/png, image/jpeg, image/webp, image/svg+xml, image/gif`), sanitize SVG (strip `<script>`, `on*` attrs), stream qua `IFormFile`.
- `GET /api/files/{id}` không liệt kê thư mục, chỉ trả file theo id.

---

## 14. Thứ tự thực hiện (Phases)

1. **Khởi tạo** — tạo project `server/` .NET 8 Minimal API, EF Core SQLite, `AppDbContext`, init `WAL` + `FTS5 triggers`.
2. **Models & Endpoints** — `Folder/Note/Attachment` (StoragePath), `FolderService`, `NoteService`, `AttachmentService` (disk), `SearchService`.
3. **Cây thư mục + list note** — API `folders/tree`, `notes`, `search`, nối `client/src/store/useVault.ts` (thay `mock/data.ts`).
4. **Editor** — CodeMirror 6, split preview, autosave debounce, render markdown + KaTeX + Mermaid.
5. **Upload ảnh/SVG** — `POST /api/files` → disk → chèn link, `PUT /api/files/{id}/move` giữ url.
6. **PWA** — manifest + service worker + offline cache.
7. **Backup/export** — export `.md`, backup `obsidian.db + data/files`.

---

## 15. Tiêu chí chấp nhận (Acceptance)

- Tạo folder lồng 3 cấp, tạo note, paste ảnh + svg, lưu, tắt mở lại vẫn còn (persist trên SQLite + disk).
- Tìm kiếm cụm từ trong nội dung note trả kết quả nhanh (< 1s với 10k note) qua `GET /api/search`.
- Desktop: gõ markdown thấy preview cập nhật, code/table/math/mermaid/svg hiển thị đúng.
- Mobile: mở note render đúng (chỉ đọc, không có chế độ sửa), ảnh/svg không tràn màn hình, code/table scroll ngang, top bar tự ẩn/hiện mượt khi cuộn.
- PWA: cài ra màn hình chính, bật offline xem được note đã xem.
- Di chuyển note/attachment trong cây không làm vỡ link `![](/api/files/{id})`.
