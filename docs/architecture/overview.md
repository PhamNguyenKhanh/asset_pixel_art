# Pixel Art Studio — Architecture Overview (Phase 1 Baseline)

## Layer Separation

1. **Core Engine (`src/core/`)** — 100% pure TypeScript, zero React/Next.js/Zustand dependencies (enforced via ESLint `no-restricted-imports`).
   - `document/`: `PixelDocument`, `Frame`, `Layer`, `PixelBuffer` (`Uint8ClampedArray` + `Uint32Array` view).
   - `canvas/`: `ViewportTransform` (cursor-anchored zoom, pan, screen↔pixel mapping) & `DirtyRect` utilities.
   - `rendering/`: `RenderingEngine` (offscreen 1:1 compositor + nearest-neighbor display canvas + overlay canvas for pixel grid & brush cursor + `requestAnimationFrame` dirty scheduler).
   - `input/`: `InputController` (unified PointerEvents, Space/Middle-click pan, wheel zoom) & `ShortcutManager`.
   - `history/`: `HistoryManager` (max steps + 64MB byte budget) & patch-based `PixelPatchCommand`.
   - `image-processing/`: endianness-safe RGBA packing, Hex/RGB/HSV conversion, integer Bresenham interpolation, iterative scanline flood fill.
2. **Feature Modules (`src/modules/`)** — pure TypeScript modules communicating with Core via `src/core/contracts/`.
   - `drawing-tools/`: `PencilTool`, `EraserTool`, `BucketFillTool`, `EyedropperTool` (sparse diff tracking avoids full-canvas clones).
   - `color-management/`: curated default studio palettes.
3. **Application Facade & UI State (`src/services/`, `src/stores/`)**
   - `EditorApplicationService` coordinates Core Engine and Modules, exposing imperative commands to UI.
   - `useEditorStore` (Zustand) stores **only lightweight UI state and document metadata** — never pixel buffers.
4. **UI Layer (`src/components/`, `src/app/`)**
   - Dark-theme Piskel-inspired desktop editor shell with zero React re-renders during continuous canvas strokes.
