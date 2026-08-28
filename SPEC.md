# SPEC — Obsidian-lite

Web app ghi chú markdown self-hosted, dùng cho **một người**, thay thế việc đồng bộ Obsidian qua file bằng một server duy nhất truy cập từ nhiều thiết bị.

> Phiên bản: 1.0 — 2026-08-27
> Trạng thái: Chốt thiết kế, sẵn sàng thực thi.

---

## 1. Mục tiêu (Goals)

- Tạo, đọc, sửa, xóa nội dung ghi chú **markdown** từ bất kỳ thiết bị nào qua trình duyệt.
- Tập trung **hiển thị tốt** nội dung: markdown, **SVG (inline & file)**, **image (paste/upload)**.
- Note được tổ chức theo **cây thư mục** (giống vault Obsidian).
- **Desktop**: chỉnh sửa đầy đủ (split source + live preview).
- **Mobile**: **chỉ đọc (view-only)** — tối ưu hiển thị và tốc độ.
- Dữ liệu tập trung **1 file SQLite**, dễ backup.
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
| F-07 | Upload / paste ảnh & SVG → lưu DB → chèn link vào note | Cao |
| F-08 | Hiển thị markdown chuẩn + code highlight + bảng + toán (KaTeX) + sơ đồ (Mermaid) | Cao |
| F-09 | Hiển thị **inline SVG** (raw HTML) an toàn | Cao |
| F-10 | Mobile view-only: render, không nạp editor | Cao |
| F-11 | PWA: cài màn hình chính, offline cache note đã xem | Trung bình |
| F-12 | Export note ra `.md` | Thấp |
| F-13 | Backup file `.db` (thủ công/script) | Trung bình |

### 3.2 Phi chức năng
- 10.000 note: tìm kiếm & mở note nhanh (SQLite/FTS5 đáp ứng thoải mái).
- Single-user → không cần lo ghi đồng thời.
- Mobile: không nạp CodeMirror (tiết kiệm tài nguyên), ảnh/svg `max-width:100%`, bảng/code scroll ngang.

---

## 4. Stack công nghệ

| Thành phần | Lựa chọn |
|-----------|----------|
| Runtime | .NET 8 (LTS) |
| UI framework | Blazor Web App — Interactive Server |
| ORM / DB | EF Core 8 + **SQLite** |
| Full-text search | SQLite **FTS5** |
| Editor | CodeMirror 6 (desktop) |
| Render markdown | `marked` + `DOMPurify` (sanitize) |
| Code highlight | `highlight.js` |
| Toán học | KaTeX |
| Sơ đồ | Mermaid |
| PWA | `manifest.webmanifest` + service worker |
| Deploy | `dotnet publish` → chạy Kestrel (không Docker) |

> Lý do: Blazor Server cho phép truy cập DB trực tiếp từ component C#, không cần API riêng, phù hợp single-user.

---

## 5. Kiến trúc

```
Trình duyệt (Blazor Server circuit)
   ├─ Desktop: cây thư mục + editor (CodeMirror) + preview (marked/KaTeX/Mermaid)
   ├─ Mobile : cây thư mục + view read-only (render sẵn)
   │
   └─ SignalR ──> Blazor Server
                    ├─ NoteService / FolderService / SearchService (C#)
                    ├─ AttachmentService (BLOB)
                    └─ EF Core ──> SQLite (notes + attachments + FTS5)
```

- **Ảnh/SVG** được phục vụ qua endpoint riêng: `GET /api/files/{id}` (trả bytes + Content-Type), không qua circuit Blazor.

---

## 6. Cấu trúc thư mục dự án

```
obsidian-server/
├─ SPEC.md
├─ README.md
└─ ObsidianServer/
   ├─ ObsidianServer.csproj
   ├─ Program.cs                 # DI, SQLite, FTS5 init, minimal API, PWA static
   ├─ appsettings.json
   ├─ appsettings.Development.json
   ├─ Data/
   │  ├─ AppDbContext.cs
   │  └─ Migrations/
   ├─ Models/
   │  ├─ Folder.cs
   │  ├─ Note.cs
   │  └─ Attachment.cs
   ├─ Services/
   │  ├─ FolderService.cs
   │  ├─ NoteService.cs
   │  ├─ AttachmentService.cs
   │  └─ SearchService.cs
   ├─ Components/
   │  ├─ Layout/
   │  │  ├─ MainLayout.razor
   │  │  └─ NavMenu.razor
   │  ├─ Pages/
   │  │  ├─ Home.razor              # cây thư mục + list note (điều hướng trung tâm)
   │  │  ├─ NoteView.razor          # render read-only (mobile & preview)
   │  │  └─ NoteEditor.razor        # editor split (desktop)
   │  └─ Editor/
   │     ├─ MarkdownEditor.razor     # wrapper CodeMirror (JS interop)
   │     └─ MarkdownPreview.razor    # render markdown (marked + fenced extras)
   └─ wwwroot/
      ├─ js/ (codemirror, marked, dompurify, katex, mermaid, highlight, interop.js, app.js)
      ├─ css/ (app.css, editor.css, mobile.css)
      ├─ manifest.webmanifest
      └─ sw.js (service worker)
```

---

## 7. Schema database

### `Folders`
| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| Id | TEXT (GUID) | PK |
| Name | TEXT | Tên folder |
| ParentId | TEXT nullable | NULL = root |
| CreatedAt | TEXT (ISO) | |

### `Notes`
| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| Id | TEXT (GUID) | PK |
| Title | TEXT | Tiêu đề hiển thị (= tên file) |
| FolderId | TEXT | FK → Folders.Id |
| Content | TEXT | Markdown thuần |
| CreatedAt | TEXT (ISO) | |
| UpdatedAt | TEXT (ISO) | |

### `Attachments`
| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| Id | TEXT (GUID) | PK |
| FileName | TEXT | |
| ContentType | TEXT | MIME (image/*, image/svg+xml) |
| Data | BLOB | Bytes |
| Size | INTEGER | |
| CreatedAt | TEXT (ISO) | |

### `Notes_FTS` (FTS5)
- Virtual table trên `Title` + `Content`.
- Đồng bộ tự động bằng **triggers** (`AFTER INSERT/UPDATE/DELETE` trên Notes).

---

## 8. Endpoint phục vụ file

| Đường dẫn | Mô tả |
|-----------|-------|
| `GET /api/files/{id}` | Trả attachment (bytes + Content-Type). Dùng trong `![...](/api/files/{id})`. |
| `POST /api/files` | Upload 1 file → trả `{ id, url }`. |

---

## 9. Hành vi UI

### 9.1 Desktop (≥ 768px)
- **Sidebar**: cây thư mục (expand/collapse), mỗi folder hiển thị danh sách note con. Bấm note → mở chi tiết.
- **Chi tiết note**: bố cục ba phần hoặc hai panel — **source (CodeMirror)** | **preview (live)**.
- Autosave: debounce ~800ms sau khi dừng gõ, hoặc save khi blur.

### 9.2 Mobile (< 768px) — view only
- Không khởi tạo CodeMirror, không nạp JS editor.
- Điều hướng: **cây thư mục → list note trong folder → view note** (back bằng nút quay lại).
- Header sticky hiển thị tiêu đề note.
- Chỉ render nội dung (read-only), không có control sửa.
- Responsive:
  - `img, svg { max-width: 100%; height: auto; }`
  - Code block & bảng: `overflow-x: auto` (scroll ngang).
  - Typography tối ưu touch: font size, line-height, spacing phù hợp.
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
- **Ảnh/SVG file**: `<img src="/api/files/{id}">` — trình duyệt render natively.
- **Ảnh paste**: bắt sự kiện paste → upload → chèn `![](/api/files/{id})`.

---

## 11. PWA

- `manifest.webmanifest`: tên, icon, `display: standalone`, `start_url`, theme color.
- Service worker (`sw.js`):
  - Precache shell (html/css/js chỉ đọc).
  - **Runtime cache** các note đã xem (`GET /api/files/*` và trang view) để đọc **offline**.
  - Strategy: network-first cho dữ liệu, cache-first cho asset tĩnh.

---

## 12. Backup & Export

- **Export note**: tải note dưới dạng file `.md`.
- **Backup**: tài liệu + script sao chép file `obsidian.db` (định kỳ hoặc thủ công).

---

## 13. Bảo mật & an toàn

- Không auth (single user) → **không expose ra internet công cộng**; khuyến nghị chạy sau VPN/Tailscale hoặc chỉ mạng LAN.
- DOMPurify bắt buộc trước khi render mọi nội dung markdown/HTML (chống XSS qua raw HTML/SVG).
- Ảnh upload: giới hạn kích thước file, giá trị Content-Type hợp lệ.

---

## 14. Thứ tự thực hiện (Phases)

1. **Khởi tạo** — tạo project .NET 8 Blazor, EF Core SQLite, migration, init FTS5 + triggers + seed folder root.
2. **Services** — FolderService, NoteService, AttachmentService, SearchService.
3. **Cây thư mục + list note** — sidebar tree, CRUD folder/note, search.
4. **Editor desktop** — CodeMirror 6, split preview, autosave, render markdown + KaTeX + Mermaid + code + inline SVG + ảnh.
5. **View mobile** — read-only, responsive, scroll ngang, lazy-load editor.
6. **Upload ảnh/SVG** — paste/upload → BLOB → chèn link.
7. **PWA** — manifest + service worker + offline cache.
8. **Backup/export** — export `.md`, backup `.db`.

---

## 15. Tiêu chí chấp nhận (Acceptance)

- Tạo folder lồng 3 cấp, tạo note, paste ảnh + svg, lưu, tắt mở lại vẫn còn (persist).
- Tìm kiếm cụm từ trong nội dung note trả kết quả nhanh (< 1s với 10k note).
- Desktop: gõ markdown thấy preview cập nhật, code/table/math/mermaid/svg hiển thị đúng.
- Mobile: mở note render đúng, ảnh/svg không tràn màn hình, code/table scroll ngang, không có editor.
- PWA: cài ra màn hình chính, bật offline xem được note đã xem.