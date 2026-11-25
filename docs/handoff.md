# HANDOFF – PIXEL ART WEB EDITOR

**Project:** Pixel Art Studio (Working Title)  
**Product Type:** Browser-based Pixel Art Editor  
**Reference:** Piskel  
**Primary Audience:** Pixel Artists, 2D Game Developers, Unity Developers  
**Development Approach:** Modular Frontend Application  
**Status:** Initial Product Specification

---

# 1. PROJECT OVERVIEW

## 1.1. Product Vision

Xây dựng một website vẽ và chỉnh sửa Pixel Art 2D, lấy Piskel làm nền tảng tham khảo chính về giao diện, trải nghiệm sử dụng và các công cụ vẽ cơ bản.

Tuy nhiên, sản phẩm không chỉ đơn thuần là bản sao Piskel. Điểm khác biệt nằm ở các công cụ hỗ trợ xử lý hình ảnh thông minh, đặc biệt là:

1. Dynamic Lighting & Shadow System.
2. Dynamic Asset Type Recognition / Context System.
3. Intelligent Color Filling System.

Mục tiêu là giúp người dùng tạo ra những hình ảnh Pixel Art có chiều sâu, ánh sáng, bóng đổ và màu sắc phong phú hơn mà không phải tự chỉnh sửa từng pixel thủ công.

## 1.2. Product Scope

Đây là một công cụ vẽ trực tuyến độc lập.

Quy trình sử dụng:

1. Người dùng truy cập website.
2. Tạo canvas mới hoặc upload ảnh có sẵn.
3. Chỉnh sửa ảnh bằng các công cụ vẽ.
4. Sử dụng các tính năng nâng cao để xử lý ánh sáng, bóng đổ và màu sắc.
5. Export ảnh sau khi hoàn thành.

## 1.3. Strict Product Constraints

Đây là các giới hạn bắt buộc, không được tự ý mở rộng phạm vi sản phẩm.

- Không yêu cầu đăng nhập.
- Không có hệ thống đăng ký tài khoản.
- Không có database.
- Không có Cloud Storage.
- Không có hệ thống quản lý project trực tuyến.
- Không có Asset Marketplace.
- Không có Team Workspace.
- Không có Collaborative Editing.
- Không có hệ thống subscription hoặc thanh toán.
- Không xây dựng backend phức tạp nếu không có yêu cầu kỹ thuật thực sự cần thiết.

Toàn bộ hoạt động vẽ, xử lý pixel, rendering và các công cụ nâng cao nên chạy trực tiếp trên trình duyệt người dùng.

**Nguyên tắc: Open → Draw → Edit → Export.**

---

# 2. TECHNOLOGY STACK

Đề xuất sử dụng:

| Component | Technology |
|---|---|
| Language | TypeScript |
| Framework | Next.js |
| UI Library | React |
| Rendering | HTML5 Canvas 2D |
| State Management | Zustand |
| Styling | Tailwind CSS |
| UI Components | shadcn/ui |
| Image Processing | Canvas ImageData / TypedArray |
| Local Processing | Web Workers khi cần |
| Deployment | Vercel |

## 2.1. Technical Principles

- Canvas 2D chịu trách nhiệm rendering và thao tác pixel.
- React chịu trách nhiệm giao diện.
- Zustand quản lý trạng thái của editor.
- Các thuật toán xử lý hình ảnh phải độc lập với React.
- Không để mỗi thao tác vẽ khiến toàn bộ React component tree render lại.
- Ưu tiên xử lý dữ liệu trực tiếp trong bộ nhớ.
- Sử dụng Web Workers cho các tác vụ xử lý ảnh nặng khi cần thiết.
- Sử dụng nearest-neighbor scaling để giữ nguyên độ sắc nét của Pixel Art.

Không cần triển khai backend trong MVP.

---

# 3. CORE EDITOR – CÁC CHỨC NĂNG CƠ BẢN

Giao diện và trải nghiệm sử dụng cần tham khảo Piskel.

## 3.1. Canvas Management

- Create New Canvas.
- Custom Width / Height.
- Common Pixel Art Presets.
- Transparent Background.
- Grid Display.
- Zoom In / Zoom Out.
- Pan Canvas.
- Resize Canvas.
- Crop Canvas.

## 3.2. Drawing Tools

- Pencil.
- Eraser.
- Bucket Fill.
- Color Picker / Eyedropper.
- Line Tool.
- Rectangle Tool.
- Ellipse Tool.
- Selection Tool.
- Move Tool.
- Transform.
- Flip Horizontal / Vertical.

## 3.3. Color Management

- Foreground / Background Color.
- Color Picker.
- Hex / RGB / HSV.
- Color Palette.
- Custom Palette.
- Recent Colors.
- Transparency.

## 3.4. Layer Management

- Create Layer.
- Delete Layer.
- Rename Layer.
- Reorder Layer.
- Toggle Visibility.
- Opacity.
- Lock Layer.
- Merge Layers.

## 3.5. Animation

- Frame Timeline.
- Add / Delete Frame.
- Duplicate Frame.
- Reorder Frame.
- FPS Control.
- Frame Duration.
- Onion Skin.
- Animation Preview.

## 3.6. Import / Export

Import:
- PNG.
- JPG / JPEG.
- WebP.
- GIF (nếu hỗ trợ trong phạm vi triển khai).

Export:
- PNG.
- GIF.
- Sprite Sheet.
- Sprite Sheet + JSON Metadata.

---

# 4. SPECIAL FEATURE 01 – DYNAMIC LIGHTING & SHADOW SYSTEM

**Đây là một trong những tính năng quan trọng nhất và là điểm khác biệt lớn của sản phẩm.**

## 4.1. Concept

Xây dựng một hệ thống ánh sáng tương tự ý tưởng Directional Light trong Unity 3D.

Người dùng có thể tạo một nguồn sáng trong editor, sau đó di chuyển nguồn sáng để hệ thống tự động tính toán lại độ sáng và bóng đổ trên hình ảnh.

Ví dụ:

- Người dùng vẽ một nhân vật.
- Người dùng đặt một nguồn sáng ở phía trên bên trái.
- Các khu vực hướng về phía nguồn sáng sẽ sáng hơn.
- Các khu vực nằm ở phía đối diện sẽ tối hơn.
- Những khu vực bị che khuất có thể xuất hiện bóng đổ.
- Khi người dùng di chuyển nguồn sáng sang phía bên phải, hệ thống tính toán và cập nhật lại hiệu ứng.

## 4.2. User Interaction

Cung cấp một công cụ hoặc panel riêng tên là Lighting Studio.

Các thành phần:

- Enable / Disable Lighting.
- Light Direction.
- Light Position.
- Light Intensity.
- Light Color.
- Ambient Light.
- Shadow Intensity.
- Shadow Softness (được điều chỉnh theo phong cách Pixel Art).
- Preview Lighting.

Người dùng có thể kéo biểu tượng nguồn sáng trong viewport hoặc điều chỉnh thông số trong panel.

## 4.3. Expected Behavior

Khi thay đổi vị trí nguồn sáng:

1. Hệ thống xác định hướng ánh sáng.
2. Phân tích các pixel thuộc đối tượng.
3. Tính toán mức độ nhận ánh sáng của từng pixel.
4. Điều chỉnh màu sắc dựa trên cường độ ánh sáng.
5. Xác định những khu vực cần tối hơn.
6. Render kết quả mới lên canvas.

Ví dụ:

Một mặt bàn có màu gỗ nâu.

Khi nguồn sáng ở phía trên bên trái:
- Mặt trên bàn sáng hơn.
- Cạnh bên có thể tối hơn.
- Khu vực bị che khuất có bóng đổ.
- Màu gỗ vẫn giữ được đặc trưng ban đầu.

Khi nguồn sáng di chuyển sang phía bên phải, những vùng sáng và tối phải thay đổi tương ứng.

## 4.4. Technical Direction

Không nên chỉ áp dụng một gradient hoặc filter sáng tối chung cho toàn bộ ảnh.

Nên nghiên cứu và kết hợp:

- Directional Lighting.
- Normal Map hoặc Pixel Normal Estimation.
- Ambient Occlusion đơn giản.
- Shadow Mask.
- Occlusion / Layer Mask.
- Per-pixel Color Transformation.

Đặc biệt, cần phân biệt:

**Lighting:** Tính toán độ sáng của từng pixel dựa trên hướng và cường độ nguồn sáng.

**Shadow:** Tính toán vùng bị che khuất hoặc vùng nằm trong bóng đổ.

Chỉ biết màu sắc của một pixel thì không đủ để xác định chính xác hình học và hướng bề mặt của vật thể. Vì vậy, hệ thống có thể cần thêm thông tin về độ cao, hướng bề mặt hoặc mask do người dùng cung cấp.

Ở phiên bản đầu, có thể triển khai chế độ lighting bán tự động bằng các mask và giả định hình học đơn giản. Không nên cam kết tự động hiểu chính xác hình học 3D của mọi hình ảnh 2D.

## 4.5. Non-destructive Editing

Đây là yêu cầu quan trọng.

Khi người dùng thay đổi nguồn sáng:
- Không được phá hủy pixel gốc.
- Có thể bật/tắt hiệu ứng.
- Có thể thay đổi thông số nhiều lần.
- Có thể khôi phục màu gốc.
- Có thể áp dụng kết quả thành pixel thực khi người dùng xác nhận.

Lighting nên được quản lý như một hiệu ứng riêng trong quá trình rendering, không ghi đè trực tiếp dữ liệu gốc trong mỗi lần preview.

---

# 5. SPECIAL FEATURE 02 – DYNAMIC ASSET TYPE / CONTEXT SYSTEM

## 5.1. Concept

Trước hoặc trong khi vẽ, người dùng có thể chọn loại asset đang thực hiện.

Ví dụ:

- Character.
- Animal.
- Tree.
- Plant.
- Building.
- Environment.
- Weapon.
- Item.
- Furniture.
- Vehicle.
- Custom.

Mục đích là giúp các công cụ thông minh hiểu được ngữ cảnh của hình ảnh để đưa ra cách xử lý phù hợp hơn.

Đây không chỉ là một category hoặc nhãn phân loại.

Nó là một Context System cung cấp thông tin cho những công cụ khác.

## 5.2. Expected Behavior

Ví dụ 1 – Character:

Khi chọn Character:
- Đưa ra các gợi ý palette phù hợp.
- Hỗ trợ tạo vùng sáng tối cho cơ thể.
- Có thể cung cấp preset animation.
- Hỗ trợ các thao tác chỉnh sửa phù hợp với nhân vật.

Ví dụ 2 – Tree:

Khi chọn Tree:
- Hệ thống có thể ưu tiên các palette thiên nhiên.
- Hỗ trợ xử lý ánh sáng trên tán lá.
- Gợi ý các biến thể màu sắc.
- Hỗ trợ tạo vùng sáng và tối trên các cụm lá.

Ví dụ 3 – Building:

- Gợi ý palette vật liệu gỗ, đá, gạch.
- Hỗ trợ xử lý các mặt phẳng và vùng bị che khuất.
- Đưa ra preset shading phù hợp.

## 5.3. Context Integration

Các hệ thống khác có thể đọc thông tin từ Asset Context.

Ví dụ:

Asset Context: Tree

Lighting System:
- Sử dụng preset shading dành cho cụm lá.
- Có thể xử lý vùng tán lá theo các nhóm bề mặt.

Color System:
- Đưa ra các biến thể màu xanh phù hợp.
- Ưu tiên giữ palette thiên nhiên.

Auto Fill:
- Gợi ý cách phân bố màu theo vùng.
- Hạn chế tạo các biến thể màu không phù hợp.

## 5.4. Important Requirements

- Người dùng có thể thay đổi loại asset bất kỳ lúc nào.
- Có thể chọn Custom khi không thuộc danh mục có sẵn.
- Không ép buộc người dùng phải chọn category mới được vẽ.
- Không được để category làm thay đổi pixel gốc ngoài ý muốn.
- Context System cần được thiết kế mở rộng để có thể thêm loại asset mới.
- Các tính năng không được phụ thuộc cứng vào tên category.

Lưu ý: Chọn Character không đồng nghĩa hệ thống tự động biết chính xác đâu là đầu, tay, chân hoặc quần áo. Nếu muốn xử lý hình học chi tiết, cần bổ sung segmentation hoặc các mask tương ứng.

---

# 6. SPECIAL FEATURE 03 – INTELLIGENT COLOR FILLING SYSTEM

**Đây là tính năng quan trọng thứ hai sau Dynamic Lighting.**

## 6.1. Problem

Trong Piskel, Bucket Fill thông thường sẽ tô toàn bộ vùng được chọn bằng một màu đồng nhất.

Ví dụ:

Người dùng muốn vẽ mặt bàn bằng màu nâu.

Khi sử dụng Bucket Fill:
- Toàn bộ vùng mặt bàn có cùng một màu.
- Hình ảnh thiếu biến thiên màu sắc.
- Bề mặt trông phẳng và thô.
- Người dùng phải tự thêm từng pixel sáng tối.

Điều người dùng mong muốn là một hệ thống tô màu thông minh hơn.

## 6.2. Concept

Xây dựng tính năng Intelligent Color Fill hoặc Smart Fill.

Thay vì chỉ tô một màu duy nhất, người dùng chọn một màu cơ sở và hệ thống tự động tạo ra những biến thể màu gần với màu đó.

Ví dụ:

Người dùng chọn màu nâu làm màu cơ sở.

Khi tô lên mặt bàn, hệ thống phân bố nhiều màu nâu khác nhau:
- Nâu sáng.
- Nâu trung bình.
- Nâu tối.
- Các biến thể màu hơi ngả vàng hoặc đỏ.
- Một số điểm nhấn sáng tối có kiểm soát.

Kết quả tạo cảm giác bề mặt có chiều sâu và nhiều sắc độ hơn.

Ý tưởng hình ảnh là khi phóng to một bức ảnh thực, chúng ta nhìn thấy rất nhiều pixel với màu sắc gần nhau, chứ không phải toàn bộ một vùng đều có cùng một màu.

## 6.3. User Interaction

Thay thế hoặc mở rộng Bucket Fill bằng các chế độ:

**Mode 1 – Solid Fill**
- Tô màu đồng nhất như Piskel.
- Giữ lại công cụ truyền thống.

**Mode 2 – Smart Color Fill**
- Tô màu dựa trên màu cơ sở.
- Tự động tạo các biến thể màu gần nhau.
- Phân bố màu có kiểm soát.

**Mode 3 – Material Fill**
- Tô màu theo loại vật liệu.
- Ví dụ: Wood, Stone, Grass, Metal, Fabric.
- Sử dụng các palette và quy tắc shading tương ứng.

## 6.4. Smart Fill Settings

Các thông số nên có:

- Base Color.
- Color Variation.
- Brightness Variation.
- Saturation Variation.
- Contrast.
- Texture Intensity.
- Color Distribution.
- Preserve Outlines.
- Preserve Transparency.
- Random Seed.

## 6.5. Expected Behavior

Ví dụ người dùng muốn tô mặt bàn:

1. Chọn công cụ Smart Fill.
2. Chọn màu nâu.
3. Click vào vùng mặt bàn.
4. Hệ thống xác định vùng liên thông cần tô.
5. Phân tích kích thước và hình dạng vùng.
6. Tạo các biến thể màu từ màu nâu cơ sở.
7. Phân bố pixel sáng tối trong vùng.
8. Render kết quả.

Yêu cầu:
- Không làm màu bị biến đổi quá xa màu gốc.
- Không tạo noise ngẫu nhiên vô nghĩa.
- Không phá hủy đường viền.
- Không tràn màu ra ngoài vùng cần tô.
- Có thể điều chỉnh cường độ biến thiên.
- Có thể Undo/Redo toàn bộ thao tác.
- Có thể preview trước khi áp dụng.

## 6.6. Technical Direction

Nên nghiên cứu và kết hợp:

- Flood Fill / Region Detection.
- Palette Generation.
- Color Interpolation.
- Controlled Color Variation.
- Spatial Color Distribution.
- Material-based Color Presets.
- Seeded Randomness.
- Optional Texture Patterns.

Quan trọng: không nên chỉ random màu cho từng pixel.

Cách làm đó dễ tạo ra noise và khiến hình ảnh trông bẩn.

Cần có quy tắc phân bố màu theo không gian, vùng sáng tối và cấu trúc của khu vực được tô.

Ví dụ, thay vì chọn màu ngẫu nhiên hoàn toàn:
- Một số vùng được ưu tiên sáng hơn.
- Một số vùng được ưu tiên tối hơn.
- Các pixel lân cận có xu hướng giữ màu tương đồng.
- Màu chuyển đổi từ từ, có kiểm soát.

Smart Fill cần hoạt động tốt với phong cách Pixel Art, không biến hình ảnh thành ảnh nhiễu.

---

# 7. RELATIONSHIP BETWEEN THE THREE SPECIAL SYSTEMS

Ba tính năng đặc biệt không nên hoạt động như ba công cụ hoàn toàn tách biệt.

Chúng cần chia sẻ một hệ thống context và dữ liệu xử lý hình ảnh.

Ví dụ:

Người dùng chọn Asset Type = Tree.

Sau đó:
1. Smart Fill có thể gợi ý palette và cách phân bố màu cho tán lá.
2. Người dùng sử dụng Smart Fill để tô màu các cụm lá.
3. Lighting System nhận dữ liệu vùng và các thông tin bề mặt có sẵn.
4. Người dùng di chuyển nguồn sáng.
5. Hệ thống cập nhật hiệu ứng ánh sáng và bóng đổ.
6. Người dùng có thể chỉnh sửa lại từng pixel nếu muốn.

Kiến trúc khái niệm:

Asset Context
    |
    +---- Smart Color Fill
    |
    +---- Dynamic Lighting
    |
    +---- Material Presets
    |
    +---- Color Suggestions

Các hệ thống nên giao tiếp qua interfaces và dữ liệu chung, không gọi trực tiếp logic nội bộ của nhau.

---

# 8. PROPOSED PROJECT ARCHITECTURE

Đề xuất cấu trúc thư mục:

src/
├── app/
│   ├── page.tsx
│   └── editor/
│
├── components/
│   ├── editor/
│   ├── toolbar/
│   ├── panels/
│   ├── dialogs/
│   └── ui/
│
├── core/
│   ├── document/
│   ├── canvas/
│   ├── rendering/
│   ├── input/
│   ├── history/
│   └── image-processing/
│
├── modules/
│   ├── drawing-tools/
│   ├── layers/
│   ├── animation/
│   ├── asset-context/
│   ├── lighting/
│   ├── smart-fill/
│   ├── color-management/
│   └── import-export/
│
├── stores/
├── hooks/
├── types/
├── lib/
└── workers/

tests/
├── unit/
├── integration/
└── e2e/

docs/
├── architecture/
├── modules/
├── algorithms/
└── development/

## Architecture Rules

1. Core Engine không phụ thuộc React.
2. Mỗi module có trách nhiệm riêng.
3. Các module giao tiếp thông qua interfaces hoặc application services.
4. Không lưu pixel data trong React state.
5. Các thuật toán xử lý ảnh phải có unit tests.
6. Lighting và Smart Fill phải hỗ trợ non-destructive preview khi phù hợp.
7. Các thao tác chỉnh sửa phải tích hợp với Undo/Redo.
8. Không đưa logic đặc thù của một công cụ vào Canvas Renderer.
9. Asset Context là dữ liệu ngữ cảnh dùng chung, không phải một hệ thống AI bắt buộc.
10. Không tự ý bổ sung backend hoặc hệ thống tài khoản.

---

# 9. DEVELOPMENT ROADMAP

## Phase 1 – Foundation & Basic Editor

- Setup Next.js.
- Setup project architecture.
- Design editor layout.
- Canvas viewport.
- Pixel buffer.
- Coordinate mapping.
- Pencil.
- Eraser.
- Bucket Fill cơ bản.
- Color Picker.
- Zoom / Pan.
- Grid.
- Undo / Redo.

Deliverable: Editor có thể vẽ Pixel Art thực sự.

## Phase 2 – Complete Piskel-like Editor

- Drawing tools.
- Shape tools.
- Selection.
- Transform.
- Layer management.
- Frame timeline.
- Animation preview.
- Onion Skin.
- Import image.
- Export PNG.
- Export GIF.
- Sprite Sheet Export.

Deliverable: Một Pixel Editor có các chức năng nền tảng tương đương sản phẩm tham khảo.

## Phase 3 – Intelligent Color Fill

- Smart Fill.
- Color Variation.
- Brightness Variation.
- Color Distribution.
- Material Fill.
- Outline Preservation.
- Preview / Apply.
- Undo / Redo Integration.

Deliverable: Công cụ tô màu thông minh với biến thể màu có kiểm soát.

## Phase 4 – Dynamic Asset Context

- Asset Type Selector.
- Category presets.
- Context Manager.
- Material presets.
- Context integration interfaces.
- Context-aware tool suggestions.

Deliverable: Các công cụ có thể nhận biết ngữ cảnh loại asset mà người dùng đang tạo.

## Phase 5 – Dynamic Lighting & Shadow

- Lighting panel.
- Light source visualization.
- Light direction.
- Light intensity.
- Light color.
- Ambient lighting.
- Surface / Normal data.
- Shadow mask.
- Shadow rendering.
- Non-destructive preview.
- Apply / Reset Lighting.

Deliverable: Có thể thay đổi nguồn sáng và quan sát sự thay đổi ánh sáng, bóng đổ trên hình ảnh.

## Phase 6 – Optimization & Release

- Performance optimization.
- Web Workers.
- Large image handling.
- Browser compatibility.
- Keyboard shortcuts.
- UI polish.
- Unit / Integration / E2E tests.
- Deployment.

Deliverable: Website hoàn chỉnh có thể sử dụng thực tế.

---

# 10. NON-FUNCTIONAL REQUIREMENTS

## Performance

- Không render lại toàn bộ React UI sau mỗi thao tác vẽ.
- Tối ưu rendering khi kéo chuột liên tục.
- Hạn chế copy toàn bộ pixel buffer không cần thiết.
- Có thể xử lý các tác vụ nặng ngoài main thread.
- Có giới hạn hợp lý cho kích thước canvas.
- Có loading/progress indicator khi xử lý ảnh lớn.

## Reliability

- Undo/Redo hoạt động nhất quán.
- Không làm hỏng pixel gốc khi preview hiệu ứng.
- Import ảnh không được làm treo giao diện trong thời gian dài.
- Các thuật toán phải xử lý transparency.
- Có thể khôi phục trạng thái trước khi áp dụng hiệu ứng.

## Usability

- Giao diện dark theme theo phong cách Piskel.
- Toolbar dễ tiếp cận.
- Các panel có thể đóng/mở.
- Hỗ trợ keyboard shortcuts.
- Các thông số nâng cao không làm giao diện quá phức tạp.
- Người dùng có thể vẽ bằng các công cụ cơ bản mà không cần biết cách sử dụng tính năng thông minh.

---

# 11. IMPORTANT PRODUCT DESIGN PRINCIPLES

1. Không làm mất đi trải nghiệm vẽ pixel truyền thống.
2. Các tính năng thông minh phải là tùy chọn, không ép buộc.
3. Người dùng luôn có quyền chỉnh sửa kết quả tự động.
4. Giữ nguyên dữ liệu gốc khi preview hiệu ứng.
5. Ưu tiên kiểm soát kết quả hơn tự động hóa thiếu chính xác.
6. Không biến Pixel Art thành ảnh có hiệu ứng blur hoặc anti-aliasing không mong muốn.
7. Giữ phong cách pixel rõ ràng, sắc nét.
8. Các tính năng nâng cao cần có preset và thông số điều chỉnh.
9. Ưu tiên trải nghiệm desktop vì đây là công cụ vẽ chuyên dụng.

---

# 12. FIRST DEVELOPMENT TASK

Chưa triển khai tất cả các tính năng ngay lập tức.

Bắt đầu bằng việc:

1. Đọc và phân tích toàn bộ handoff.
2. Xác định các yêu cầu còn thiếu hoặc mâu thuẫn.
3. Đề xuất kiến trúc kỹ thuật phù hợp.
4. Thiết kế Document Model.
5. Thiết kế Rendering Engine.
6. Xác định cách quản lý Pixel Buffer.
7. Xác định cơ chế Undo/Redo.
8. Thiết kế contract giữa các module.
9. Xây dựng kế hoạch triển khai chi tiết.
10. Chỉ bắt đầu coding sau khi kiến trúc và các quyết định quan trọng đã được thống nhất.

Không tự ý thay đổi phạm vi sản phẩm.

Đặc biệt, không triển khai:
- Authentication.
- Database.
- Cloud Project Management.
- User Workspace.
- Asset Marketplace.
- Team Collaboration.

Trừ khi có yêu cầu mới từ Product Owner.

---

# FINAL PRODUCT DEFINITION

Đây là một **Browser-based Pixel Art Editor**, lấy Piskel làm chuẩn tham khảo cho các công cụ vẽ và animation cơ bản.

Điểm khác biệt của sản phẩm nằm ở ba hệ thống:

1. **Dynamic Lighting & Shadow:** Di chuyển nguồn sáng và tự động tính toán hiệu ứng sáng tối.
2. **Dynamic Asset Context:** Xác định loại asset đang vẽ để cung cấp ngữ cảnh cho các công cụ khác.
3. **Intelligent Color Fill:** Tô màu với các biến thể sắc độ gần màu gốc, tạo chiều sâu và cảm giác tự nhiên hơn.

Sản phẩm phải đơn giản khi sử dụng, mạnh mẽ khi cần và không yêu cầu người dùng đăng nhập hoặc thiết lập bất kỳ hệ thống tài khoản nào.

**Open → Draw → Enhance → Export.**