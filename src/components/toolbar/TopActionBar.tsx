"use client";

import React from "react";
import {
  Compass,
  Download,
  FilePlus2,
  Film,
  FlipHorizontal2,
  FlipVertical2,
  Grid3x3,
  Keyboard,
  LayoutGrid,
  Maximize2,
  PanelRightClose,
  PanelRightOpen,
  Redo2,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Scaling,
  Sparkles,
  SplitSquareHorizontal,
  SplitSquareVertical,
  Sun,
  Undo2,
  Upload,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useEditorService } from "@/hooks/EditorContext";
import { useEditorStore } from "@/stores/editorStore";
import { resetLocalBrowserData } from "@/lib/localAutosave";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface TopActionBarProps {
  onOpenNewCanvas: () => void;
  onOpenResizeCrop: () => void;
  onOpenImport: () => void;
  onOpenExport: () => void;
  onOpenShortcuts: () => void;
  onOpenAutoOutline: () => void;
  onOpenColorReplace: () => void;
}

export function TopActionBar({
  onOpenNewCanvas,
  onOpenResizeCrop,
  onOpenImport,
  onOpenExport,
  onOpenShortcuts,
  onOpenAutoOutline,
  onOpenColorReplace,
}: TopActionBarProps) {
  const service = useEditorService();
  const docMeta = useEditorStore((s) => s.documentMeta);
  const zoom = useEditorStore((s) => s.zoom);
  const showGrid = useEditorStore((s) => s.showGrid);
  const symmetry = useEditorStore((s) => s.symmetry);
  const tileMode = useEditorStore((s) => s.tileMode);
  const rightPanelOpen = useEditorStore((s) => s.rightPanelOpen);
  const setRightPanelOpen = useEditorStore((s) => s.setRightPanelOpen);
  const setInspectorTab = useEditorStore((s) => s.setInspectorTab);
  const timelineOpen = useEditorStore((s) => s.timelineOpen);
  const setTimelineOpen = useEditorStore((s) => s.setTimelineOpen);
  const lightingEnabled = useEditorStore((s) => s.lightingConfig.enabled);

  const zoomPercent = Math.round(zoom * 100);
  const activeContextProfile = service.getAssetContextProfile();
  const isTileContextSuggested =
    docMeta.assetContext.assetTypeId === "environment" ||
    docMeta.assetContext.assetTypeId === "building";

  const handleResetLocalDb = async () => {
    const confirmed = window.confirm(
      "Xóa toàn bộ dữ liệu lưu cục bộ (LocalDB / bản nháp tự lưu) và tải lại trang?"
    );
    if (!confirmed) return;
    await resetLocalBrowserData();
    window.location.reload();
  };

  return (
    <header className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-white/8 bg-[#181b22] px-3 select-none">
      {/* Trái: Thương hiệu + Tệp */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2">
          <div
            aria-hidden="true"
            className="grid h-6 w-6 grid-cols-2 gap-[2px] rounded bg-amber-500/15 p-1 ring-1 ring-amber-400/40"
          >
            <span className="rounded-[1px] bg-amber-400" />
            <span className="rounded-[1px] bg-amber-300/40" />
            <span className="rounded-[1px] bg-amber-300/40" />
            <span className="rounded-[1px] bg-amber-400" />
          </div>
          <span className="hidden text-xs font-semibold tracking-wide text-zinc-100 xl:inline">
            YUI ART STUDIO
          </span>
        </div>

        <div className="h-4 w-px bg-white/10" />

        <div className="flex items-center gap-1.5">
          <span className="max-w-[130px] truncate text-xs font-medium text-zinc-300">
            {docMeta.name}
          </span>
          <span
            data-testid="canvas-size-badge"
            className="rounded border border-white/10 bg-[#111318] px-1.5 py-0.5 font-mono text-[11px] text-zinc-400"
          >
            {docMeta.width}×{docMeta.height}
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                data-testid="context-pill-btn"
                onClick={() => {
                  setRightPanelOpen(true);
                  setInspectorTab("context");
                }}
                className={`flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-medium transition-colors cursor-pointer ${
                  activeContextProfile.id !== "custom"
                    ? "border-amber-400/40 bg-amber-500/15 text-amber-300"
                    : "border-white/10 bg-[#111318] text-zinc-400 hover:border-white/25 hover:text-zinc-200"
                }`}
              >
                <Compass className="h-3 w-3" />
                <span>{activeContextProfile.label}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent>
              Ngữ cảnh Asset: {activeContextProfile.label} (Nhấn để đổi)
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                data-testid="lighting-pill-btn"
                onClick={() => {
                  setRightPanelOpen(true);
                  setInspectorTab("lighting");
                }}
                className={`flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-medium transition-colors cursor-pointer ${
                  lightingEnabled
                    ? "border-amber-400/50 bg-amber-500/20 text-amber-300"
                    : "border-white/10 bg-[#111318] text-zinc-400 hover:border-white/25 hover:text-zinc-200"
                }`}
              >
                <Sun className="h-3 w-3" />
                <span>{lightingEnabled ? "Đang sáng" : "Ánh sáng"}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent>
              Phòng Ánh sáng động ({lightingEnabled ? "Đang bật" : "Đang tắt"})
            </TooltipContent>
          </Tooltip>
        </div>

        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="secondary"
                size="sm"
                onClick={onOpenNewCanvas}
                data-testid="new-canvas-btn"
              >
                <FilePlus2 className="h-3.5 w-3.5 text-amber-400" />
                <span>Mới</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Tạo khung vẽ mới</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="secondary"
                size="sm"
                onClick={onOpenImport}
                data-testid="import-btn"
              >
                <Upload className="h-3.5 w-3.5 text-zinc-300" />
                <span>Nhập</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Nhập PNG, JPG, WebP, GIF hoặc tệp .pxs.json</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="default"
                size="sm"
                onClick={onOpenExport}
                data-testid="export-btn"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Xuất</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Xuất PNG, GIF, Sprite Sheet + JSON hoặc tệp Dự án</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Giữa: Hoàn tác + Biến đổi + Thu phóng + Lưới */}
      <div className="flex items-center gap-1">
        <div className="flex items-center gap-0.5 rounded-md border border-white/8 bg-[#12141a] p-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                disabled={!docMeta.canUndo}
                onClick={() => service.undo()}
                aria-label="Hoàn tác"
                data-testid="undo-btn"
              >
                <Undo2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Hoàn tác (Ctrl+Z)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                disabled={!docMeta.canRedo}
                onClick={() => service.redo()}
                aria-label="Làm lại"
                data-testid="redo-btn"
              >
                <Redo2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Làm lại (Ctrl+Shift+Z / Ctrl+Y)</TooltipContent>
          </Tooltip>
        </div>

        <div className="mx-1 h-4 w-px bg-white/10" />

        <div className="flex items-center gap-0.5 rounded-md border border-white/8 bg-[#12141a] p-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => service.flipHorizontal()}
                aria-label="Lật ngang"
                data-testid="flip-h-btn"
              >
                <FlipHorizontal2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Lật ngang (Vùng chọn hoặc Lớp)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => service.flipVertical()}
                aria-label="Lật dọc"
                data-testid="flip-v-btn"
              >
                <FlipVertical2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Lật dọc (Vùng chọn hoặc Lớp)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => service.rotate90("cw")}
                aria-label="Xoay 90° theo chiều kim đồng hồ"
                data-testid="rotate-cw-btn"
              >
                <RotateCw className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Xoay khung vẽ 90°</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={onOpenResizeCrop}
                aria-label="Đổi kích thước hoặc Cắt khung vẽ"
                data-testid="resize-crop-btn"
              >
                <Scaling className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Đổi kích thước / Thu phóng / Cắt khung vẽ</TooltipContent>
          </Tooltip>
        </div>

        <div className="mx-1 h-4 w-px bg-white/10" />

        <div className="flex items-center gap-0.5 rounded-md border border-white/8 bg-[#12141a] p-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => service.zoomOut()}
                aria-label="Thu nhỏ"
                data-testid="zoom-out-btn"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Thu nhỏ (-)</TooltipContent>
          </Tooltip>

          <span
            data-testid="zoom-readout"
            className="min-w-[46px] text-center font-mono text-[11px] text-zinc-300"
          >
            {zoomPercent}%
          </span>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => service.zoomIn()}
                aria-label="Phóng to"
                data-testid="zoom-in-btn"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Phóng to (+)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => service.fitViewport()}
                aria-label="Vừa khung nhìn"
                data-testid="zoom-fit-btn"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Vừa khung nhìn (0)</TooltipContent>
          </Tooltip>
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="tool"
              size="icon"
              data-active={showGrid}
              onClick={() => service.toggleGrid()}
              aria-label="Bật/tắt lưới pixel"
              data-testid="grid-toggle-btn"
              className="h-8 w-8"
            >
              <Grid3x3 className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Bật/tắt lưới pixel (G)</TooltipContent>
        </Tooltip>

        <div className="mx-1 h-4 w-px bg-white/10" />

        {/* Công cụ Artist chuyên sâu: Đối xứng X/Y, Lặp gạch 3×3, Auto-Outline, Đổi màu */}
        <div className="flex items-center gap-0.5 rounded-md border border-white/8 bg-[#12141a] p-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="tool"
                size="icon"
                data-active={symmetry.x}
                onClick={() => service.toggleSymmetryX()}
                aria-label="Vẽ đối xứng ngang X"
                data-testid="symmetry-x-btn"
                className="relative h-7 w-7"
              >
                <SplitSquareHorizontal className="h-3.5 w-3.5" />
                <span className="absolute bottom-0 right-0.5 font-mono text-[8px] font-bold">
                  X
                </span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Đối xứng ngang X ({symmetry.x ? "Đang bật" : "Đang tắt"} • Shift+X)
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="tool"
                size="icon"
                data-active={symmetry.y}
                onClick={() => service.toggleSymmetryY()}
                aria-label="Vẽ đối xứng dọc Y"
                data-testid="symmetry-y-btn"
                className="relative h-7 w-7"
              >
                <SplitSquareVertical className="h-3.5 w-3.5" />
                <span className="absolute bottom-0 right-0.5 font-mono text-[8px] font-bold">
                  Y
                </span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Đối xứng dọc Y ({symmetry.y ? "Đang bật" : "Đang tắt"} • Shift+Y)
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="tool"
                size="icon"
                data-active={tileMode}
                onClick={() => service.toggleTileMode()}
                aria-label="Chế độ lặp gạch liền mạch 3×3"
                data-testid="tile-mode-btn"
                className={`relative h-7 w-7 ${
                  isTileContextSuggested && !tileMode
                    ? "ring-1 ring-emerald-400/60 text-emerald-300"
                    : ""
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                {isTileContextSuggested && !tileMode && (
                  <span
                    aria-hidden="true"
                    className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-emerald-400"
                  />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Lặp gạch liền mạch 3×3 ({tileMode ? "Đang bật" : "Đang tắt"} • Shift+T)
              {isTileContextSuggested ? " — Gợi ý cho Tilemap" : ""}
            </TooltipContent>
          </Tooltip>
        </div>

        <div className="flex items-center gap-0.5 rounded-md border border-white/8 bg-[#12141a] p-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={onOpenAutoOutline}
                aria-label="Viền tự động / Sel-Out"
                data-testid="auto-outline-btn"
              >
                <Sparkles className="h-3.5 w-3.5 text-amber-300" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Tạo viền tự động / Sel-Out (1px)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={onOpenColorReplace}
                aria-label="Đổi màu hàng loạt"
                data-testid="color-replace-btn"
              >
                <RefreshCw className="h-3.5 w-3.5 text-sky-300" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Đổi màu hàng loạt (Color Replace / Recolor Swap)</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Phải: Phím tắt & Đóng/mở bảng */}
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => void handleResetLocalDb()}
              aria-label="Reset dữ liệu cục bộ"
              data-testid="reset-localdb-btn"
              className="h-8 w-8 text-zinc-400 hover:text-rose-400"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Reset LocalDB (Xóa bản nháp cục bộ &amp; tải lại)</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onOpenShortcuts}
              aria-label="Phím tắt"
              data-testid="shortcuts-btn"
              className="h-8 w-8"
            >
              <Keyboard className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Bảng phím tắt (?)</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="tool"
              size="icon"
              data-active={timelineOpen}
              onClick={() => setTimelineOpen(!timelineOpen)}
              aria-label={timelineOpen ? "Ẩn thanh thời gian" : "Hiện thanh thời gian"}
              data-testid="toggle-timeline-btn"
              className="h-8 w-8"
            >
              <Film className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {timelineOpen ? "Ẩn thanh khung hình" : "Hiện thanh khung hình"}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setRightPanelOpen(!rightPanelOpen)}
              aria-label={rightPanelOpen ? "Ẩn bảng công cụ phải" : "Hiện bảng công cụ phải"}
              data-testid="toggle-right-panel-btn"
            >
              {rightPanelOpen ? (
                <PanelRightClose className="h-4 w-4" />
              ) : (
                <PanelRightOpen className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {rightPanelOpen ? "Ẩn bảng thuộc tính" : "Hiện bảng thuộc tính"}
          </TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
}
