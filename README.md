# Yui Art Studio

Trình vẽ và chỉnh sửa **Pixel Art 2D** chạy hoàn toàn trên trình duyệt (100% client-side — không cần đăng nhập, không database, không backend).

**Nguyên tắc:** `Open → Draw → Enhance → Export`

---

## Cài đặt & Chạy trên máy (Localhost)

### Yêu cầu
- **Node.js** `>= 18` (khuyến nghị Node 20+ / 24+)
- **npm** đi kèm Node.js

### 3 bước chạy nhanh

```bash
git clone <url-repo-cua-ban>
cd Asset_pixel_art
npm install
npm run dev
```

Mở trình duyệt và truy cập: **http://localhost:3000**

---

## Tính năng chính

### 1. Core Pixel Art Editor (tham khảo Piskel)
- **Canvas:** Preset `16×16` → `256×256` & custom đến `1024×1024`, nền checkerboard trong suốt, Grid, Zoom (wheel theo con trỏ), Pan (`Space + Drag` / Middle-click), Resize (anchor 3×3 / scale nearest-neighbor), Crop & Auto-Trim.
- **Drawing & Transform Tools:** Pencil (`P`), Eraser (`E`), Bucket Fill (`B`), Color Picker (`I`), Line (`L`), Rectangle (`U`), Ellipse (`O`), Rectangular Select (`M` + kéo di chuyển + Copy/Cut/Paste), Move (`V`), Flip H/V, Rotate 90°.
- **Color Management:** Color Picker (SV plane, Hue, Alpha, Hex/RGB/HSV), Foreground/Background (`X`), Recent Colors, Studio Palette & Custom Palettes (lưu cục bộ).
- **Layers & Animation:** Quản lý nhiều layer đồng bộ qua các frame (visibility, opacity, lock, reorder, merge down/visible), Frame Timeline (add/duplicate/delete/reorder, FPS `1–60`, chỉnh duration từng frame), Animation Preview trực tiếp và **Onion Skin**.
- **Import / Export & Lưu cục bộ:**
  - **Import:** PNG, JPG/JPEG, WebP, **Animated GIF** (tách từng frame vào timeline), và file project `.pxs.json`.
  - **Export:** PNG (`1x–8x` nearest-neighbor), Animated GIF, **Sprite Sheet + JSON Metadata** (Unity/Phaser/Aseprite-style), và file project `.pxs.json`.
  - **Auto-Save cục bộ:** Tự động lưu nháp vào `IndexedDB` của trình duyệt để không mất bài khi tải lại trang.

### 2. Ba tính năng xử lý thông minh
1. **Dynamic Asset Context (`Ctx` tab):** Chọn ngữ cảnh loại asset (`Character`, `Animal`, `Tree`, `Plant`, `Building`, `Environment`, `Weapon`, `Item`, `Furniture`, `Vehicle`, `Custom`) để nhận gợi ý palette, vật liệu, surface shading và animation preset mà không làm thay đổi pixel gốc.
2. **Intelligent Color Fill (`Fill` tab):** Mở rộng Bucket Fill với 3 chế độ **Solid / Smart Fill / Material Fill** (`Wood`, `Stone`, `Grass`, `Foliage`, `Metal`, `Fabric`, `Skin`), phân bố màu có kiểm soát không gian, giữ đường viền & transparency, Seed tái lập và **Live Preview / Apply / Cancel**.
3. **Dynamic Lighting & Shadow (`Light` tab):** Chiếu sáng kiểu Directional Light trực quan — kéo trực tiếp biểu tượng nguồn sáng trên canvas hoặc la bàn 2D, ước lượng Normal/Height 2.5D theo Asset Context, hỗ trợ cọ vẽ **Surface Mask** bán tự động, Shadow raymarching + Ordered Dithering chuẩn Pixel Art, hoàn toàn **Non-destructive** cho đến khi nhấn **Apply (Bake)**.

---

## Phím tắt nhanh (nhấn `?` trong ứng dụng để xem đầy đủ)

| Phím | Chức năng |
|---|---|
| `P` / `E` / `B` / `I` | Pencil / Eraser / Bucket (Smart Fill) / Eyedropper |
| `L` / `U` / `O` / `M` / `V` | Line / Rectangle / Ellipse / Select / Move |
| `[` / `]` | Giảm / Tăng kích thước cọ |
| `X` / `G` | Đổi màu chính–phụ / Bật–tắt Grid |
| `Space + Drag` / `Wheel` / `0` | Pan / Zoom / Fit Canvas |
| `Ctrl+Z` / `Ctrl+Shift+Z` (`Ctrl+Y`) | Undo / Redo |
| `,` / `.` | Chuyển frame trước / sau |
| `Enter` / `Esc` | Apply / Cancel Smart Fill Preview (hoặc bỏ vùng chọn) |
| `?` | Mở bảng Keyboard Shortcuts |

---

## Scripts kiểm thử & phát triển

```bash
npm run dev        # Chạy dev server tại http://localhost:3000
npm run typecheck  # Kiểm tra TypeScript strict
npm run lint       # Kiểm tra ESLint + boundary rules (Core không phụ thuộc React)
npm test           # Chạy toàn bộ 43 unit & integration tests (Vitest)
npm run build      # Build production kiểm tra đóng gói
```

Tài liệu kiến trúc và thuật toán nằm trong thư mục `docs/` (`docs/architecture/`, `docs/modules/`, `docs/algorithms/`).
