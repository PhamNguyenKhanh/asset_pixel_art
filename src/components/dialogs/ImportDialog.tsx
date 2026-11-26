"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  FileJson,
  Film,
  Image as ImageIcon,
  RefreshCw,
  Upload,
} from "lucide-react";
import { CANVAS_LIMITS } from "@/types/editor";
import { validateCanvasDimensions } from "@/core/document/PixelDocument";
import { useEditorService } from "@/hooks/EditorContext";
import {
  loadHtmlImageFromFile,
  renderImageToPixelBuffer,
  sliceHtmlImageToFrames,
  type LoadedImageHandle,
} from "@/modules/import-export/pngAndBrowserIO";
import { decodeGif } from "@/modules/import-export/gifCodec";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ImageImportMode = "single" | "spritesheet";
type SinglePlacementMode = "new-canvas" | "current-layer";

const PREVIEW_W = 280;
const PREVIEW_H = 240;

export function ImportDialog({ open, onOpenChange }: ImportDialogProps) {
  const service = useEditorService();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [loadedImage, setLoadedImage] = useState<{
    fileName: string;
    baseName: string;
    handle: LoadedImageHandle;
  } | null>(null);

  const [imageMode, setImageMode] = useState<ImageImportMode>("single");
  const [singlePlacement, setSinglePlacement] = useState<SinglePlacementMode>("new-canvas");
  const [resizeWidth, setResizeWidth] = useState<string>("64");
  const [resizeHeight, setResizeHeight] = useState<string>("64");
  const [smoothResize, setSmoothResize] = useState<boolean>(true);

  const [frameWidth, setFrameWidth] = useState<string>("64");
  const [frameHeight, setFrameHeight] = useState<string>("64");
  const [offsetX, setOffsetX] = useState<string>("0");
  const [offsetY, setOffsetY] = useState<string>("0");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Clean up object URL when dialog closes or image changes
  const clearLoadedImage = () => {
    if (loadedImage) {
      loadedImage.handle.revoke();
      setLoadedImage(null);
    }
    setError(null);
  };

  useEffect(() => {
    if (!open && loadedImage) {
      loadedImage.handle.revoke();
      setLoadedImage(null);
      setError(null);
    }
  }, [open, loadedImage]);

  const parsedResizeW = Number(resizeWidth);
  const parsedResizeH = Number(resizeHeight);
  const parsedFrameW = Number(frameWidth);
  const parsedFrameH = Number(frameHeight);
  const parsedOffsetX = Math.max(0, Number(offsetX) || 0);
  const parsedOffsetY = Math.max(0, Number(offsetY) || 0);

  const singleValidation = validateCanvasDimensions(parsedResizeW, parsedResizeH);
  const frameValidation = validateCanvasDimensions(parsedFrameW, parsedFrameH);

  const sheetCols =
    loadedImage && parsedFrameW > 0 && parsedOffsetX < loadedImage.handle.width
      ? Math.floor((loadedImage.handle.width - parsedOffsetX) / parsedFrameW)
      : 0;
  const sheetRows =
    loadedImage && parsedFrameH > 0 && parsedOffsetY < loadedImage.handle.height
      ? Math.floor((loadedImage.handle.height - parsedOffsetY) / parsedFrameH)
      : 0;
  const sheetTotalFrames = sheetCols * sheetRows;

  // Render live preview canvas with optional spritesheet slicing grid overlay
  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas || !loadedImage) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { img, width: srcW, height: srcH } = loadedImage.handle;
    ctx.clearRect(0, 0, PREVIEW_W, PREVIEW_H);

    const scale = Math.min((PREVIEW_W - 16) / srcW, (PREVIEW_H - 16) / srcH);
    const drawW = Math.max(1, srcW * scale);
    const drawH = Math.max(1, srcH * scale);
    const dx = Math.floor((PREVIEW_W - drawW) / 2);
    const dy = Math.floor((PREVIEW_H - drawH) / 2);

    ctx.imageSmoothingEnabled = smoothResize && imageMode === "single";
    ctx.drawImage(img, dx, dy, drawW, drawH);

    // Border around source image
    ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
    ctx.lineWidth = 1;
    ctx.strokeRect(dx - 0.5, dy - 0.5, drawW + 1, drawH + 1);

    // Draw spritesheet frame grid overlay when in spritesheet mode
    if (imageMode === "spritesheet" && sheetCols > 0 && sheetRows > 0) {
      const cellW = parsedFrameW * scale;
      const cellH = parsedFrameH * scale;
      const startX = dx + parsedOffsetX * scale;
      const startY = dy + parsedOffsetY * scale;
      const gridW = sheetCols * cellW;
      const gridH = sheetRows * cellH;

      ctx.save();
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 1;
      ctx.strokeRect(startX + 0.5, startY + 0.5, Math.max(1, gridW - 1), Math.max(1, gridH - 1));

      ctx.beginPath();
      for (let c = 1; c < sheetCols; c++) {
        const x = Math.round(startX + c * cellW) + 0.5;
        ctx.moveTo(x, startY);
        ctx.lineTo(x, startY + gridH);
      }
      for (let r = 1; r < sheetRows; r++) {
        const y = Math.round(startY + r * cellH) + 0.5;
        ctx.moveTo(startX, y);
        ctx.lineTo(startX + gridW, y);
      }
      ctx.strokeStyle = "rgba(251, 191, 36, 0.7)";
      ctx.stroke();
      ctx.restore();
    }
  }, [
    loadedImage,
    imageMode,
    smoothResize,
    parsedFrameW,
    parsedFrameH,
    parsedOffsetX,
    parsedOffsetY,
    sheetCols,
    sheetRows,
  ]);

  const handleFileSelected = async (file: File) => {
    setError(null);
    setBusy(true);
    try {
      const lower = file.name.toLowerCase();
      const baseName = file.name.replace(/\.[^.]+$/, "");

      if (lower.endsWith(".json") || lower.endsWith(".pxs.json")) {
        const text = await file.text();
        const parsed = JSON.parse(text);
        service.loadSerializedProject(parsed);
        onOpenChange(false);
        return;
      }

      if (lower.endsWith(".gif") || file.type === "image/gif") {
        const arrayBuffer = await file.arrayBuffer();
        const decoded = decodeGif(new Uint8Array(arrayBuffer));
        service.importAnimatedFrames(
          decoded.width,
          decoded.height,
          decoded.frames,
          baseName,
        );
        onOpenChange(false);
        return;
      }

      // Static image (PNG / JPG / JPEG / WebP): load at full natural resolution and show 2-mode dialog
      const handle = await loadHtmlImageFromFile(file);
      if (loadedImage) {
        loadedImage.handle.revoke();
      }
      setLoadedImage({ fileName: file.name, baseName, handle });

      // Smart defaults for Single Image resize (clamped proportionally if > HARD_MAX)
      let initW = handle.width;
      let initH = handle.height;
      if (initW > CANVAS_LIMITS.HARD_MAX || initH > CANVAS_LIMITS.HARD_MAX) {
        const ratio = Math.min(
          CANVAS_LIMITS.HARD_MAX / initW,
          CANVAS_LIMITS.HARD_MAX / initH,
        );
        initW = Math.max(1, Math.round(initW * ratio));
        initH = Math.max(1, Math.round(initH * ratio));
      }
      setResizeWidth(String(initW));
      setResizeHeight(String(initH));

      // Smart defaults for Sprite Sheet: if wide horizontal strip divisible by height, auto-suggest spritesheet mode
      const looksLikeStrip =
        handle.width > handle.height &&
        handle.width % handle.height === 0 &&
        handle.height <= CANVAS_LIMITS.HARD_MAX;
      if (looksLikeStrip) {
        setImageMode("spritesheet");
        setFrameWidth(String(handle.height));
        setFrameHeight(String(handle.height));
      } else {
        setImageMode("single");
        setFrameWidth(String(Math.min(handle.width, CANVAS_LIMITS.RECOMMENDED_MAX)));
        setFrameHeight(String(Math.min(handle.height, CANVAS_LIMITS.RECOMMENDED_MAX)));
      }
      setOffsetX("0");
      setOffsetY("0");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể nhập tệp này.");
    } finally {
      setBusy(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  };

  const handleConfirmImport = () => {
    if (!loadedImage) return;
    setError(null);

    try {
      if (imageMode === "single") {
        if (!singleValidation.valid) {
          setError(singleValidation.error ?? "Kích thước ảnh không hợp lệ.");
          return;
        }
        const buffer = renderImageToPixelBuffer(
          loadedImage.handle.img,
          parsedResizeW,
          parsedResizeH,
          smoothResize,
        );
        service.importImageBuffer(buffer, singlePlacement, loadedImage.baseName);
        clearLoadedImage();
        onOpenChange(false);
        return;
      }

      // Mode 2: Import as Sprite Sheet
      if (!frameValidation.valid) {
        setError(frameValidation.error ?? "Kích thước khung không hợp lệ.");
        return;
      }
      if (sheetTotalFrames <= 0) {
        setError("Không cắt được khung hình nào. Hãy kiểm tra lại Kích thước khung và Độ lệch.");
        return;
      }

      const sliced = sliceHtmlImageToFrames(loadedImage.handle.img, {
        frameWidth: parsedFrameW,
        frameHeight: parsedFrameH,
        offsetX: parsedOffsetX,
        offsetY: parsedOffsetY,
      });

      if (sliced.frames.length === 0) {
        setError("Không có khung hình hợp lệ nào được tách từ Sprite Sheet.");
        return;
      }

      const defaultDuration = Math.max(16, Math.round(1000 / service.document.fps));
      service.importAnimatedFrames(
        parsedFrameW,
        parsedFrameH,
        sliced.frames.map((buffer) => ({ buffer, durationMs: defaultDuration })),
        loadedImage.baseName,
      );
      clearLoadedImage();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi khi xử lý ảnh nhập vào.");
    }
  };

  const canConfirm =
    loadedImage !== null &&
    (imageMode === "single"
      ? singleValidation.valid
      : frameValidation.valid && sheetTotalFrames > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="import-dialog"
        className={loadedImage ? "max-w-2xl" : "max-w-md"}
      >
        <DialogHeader>
          <DialogTitle>Nhập ảnh, Sprite Sheet, GIF hoặc Dự án</DialogTitle>
          <DialogDescription>
            Hỗ trợ PNG, JPG/JPEG, WebP (nhập ảnh đơn hoặc cắt Sprite Sheet), GIF động và tệp{" "}
            <code className="font-mono text-zinc-300">.pxs.json</code>.
          </DialogDescription>
        </DialogHeader>

        {!loadedImage ? (
          <div className="flex flex-col gap-3.5">
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file) void handleFileSelected(file);
              }}
              onClick={() => inputRef.current?.click()}
              className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-white/15 bg-[#12141a] px-4 py-9 text-center transition-colors hover:border-amber-400/60"
            >
              <Upload className="h-7 w-7 text-amber-400" />
              <p className="text-xs font-medium text-zinc-200">
                {busy ? "Đang giải mã tệp..." : "Nhấn để chọn tệp hoặc kéo thả vào đây"}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3 text-[11px] text-zinc-500">
                <span className="flex items-center gap-1">
                  <ImageIcon className="h-3 w-3" /> PNG / JPG / WebP
                </span>
                <span className="flex items-center gap-1">
                  <Film className="h-3 w-3" /> GIF động
                </span>
                <span className="flex items-center gap-1">
                  <FileJson className="h-3 w-3" /> .pxs.json
                </span>
              </div>
            </div>

            {error && (
              <p className="rounded border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-xs text-rose-300">
                {error}
              </p>
            )}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-[1fr_296px]">
            {/* Cột trái: 2 chế độ nhập ảnh (giống Piskel) */}
            <div className="flex flex-col gap-3.5">
              <div className="flex items-center justify-between gap-2 rounded-md border border-white/8 bg-[#12141a] px-2.5 py-1.5">
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-amber-300">
                    {loadedImage.fileName}
                  </p>
                  <p className="font-mono text-[10px] text-zinc-400">
                    Ảnh gốc: {loadedImage.handle.width} × {loadedImage.handle.height} px
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-[11px]"
                  onClick={() => inputRef.current?.click()}
                >
                  <RefreshCw className="h-3 w-3" />
                  <span>Đổi tệp</span>
                </Button>
              </div>

              {/* Chế độ 1: Nhập dạng ảnh đơn */}
              <div
                onClick={() => setImageMode("single")}
                data-testid="import-mode-single"
                className={`flex flex-col gap-2.5 rounded-md border p-3 transition-colors cursor-pointer ${
                  imageMode === "single"
                    ? "border-amber-400/60 bg-amber-500/8"
                    : "border-white/8 bg-[#12141a] opacity-75 hover:opacity-100"
                }`}
              >
                <label className="flex items-center gap-2 text-xs font-semibold text-zinc-100 cursor-pointer">
                  <input
                    type="radio"
                    name="image-import-mode"
                    checked={imageMode === "single"}
                    onChange={() => setImageMode("single")}
                    className="accent-amber-400"
                  />
                  <span>Nhập dạng ảnh đơn</span>
                </label>

                <div className="flex flex-col gap-2 pl-5">
                  <div className="flex items-center gap-2">
                    <span className="w-24 shrink-0 text-[11px] text-zinc-400">
                      Đổi kích thước
                    </span>
                    <Input
                      type="number"
                      min={CANVAS_LIMITS.MIN_SIZE}
                      max={CANVAS_LIMITS.HARD_MAX}
                      value={resizeWidth}
                      data-testid="import-resize-w"
                      onChange={(e) => setResizeWidth(e.target.value)}
                      className="h-7 text-center"
                    />
                    <span className="text-xs text-zinc-500">×</span>
                    <Input
                      type="number"
                      min={CANVAS_LIMITS.MIN_SIZE}
                      max={CANVAS_LIMITS.HARD_MAX}
                      value={resizeHeight}
                      data-testid="import-resize-h"
                      onChange={(e) => setResizeHeight(e.target.value)}
                      className="h-7 text-center"
                    />
                  </div>

                  <label className="flex items-center gap-2 text-[11px] text-zinc-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={smoothResize}
                      data-testid="import-smooth-resize"
                      onChange={(e) => setSmoothResize(e.target.checked)}
                      className="accent-amber-400"
                    />
                    <span>Làm mịn khi thu phóng (Smooth resize)</span>
                  </label>

                  <div className="grid grid-cols-2 gap-1 pt-0.5">
                    <button
                      type="button"
                      onClick={() => setSinglePlacement("new-canvas")}
                      className={`rounded border py-1 text-[10px] font-medium cursor-pointer ${
                        singlePlacement === "new-canvas"
                          ? "border-amber-400/60 bg-amber-500/20 text-amber-300"
                          : "border-white/10 bg-[#181b22] text-zinc-400"
                      }`}
                    >
                      Khung vẽ mới
                    </button>
                    <button
                      type="button"
                      onClick={() => setSinglePlacement("current-layer")}
                      className={`rounded border py-1 text-[10px] font-medium cursor-pointer ${
                        singlePlacement === "current-layer"
                          ? "border-amber-400/60 bg-amber-500/20 text-amber-300"
                          : "border-white/10 bg-[#181b22] text-zinc-400"
                      }`}
                    >
                      Lớp hiện tại
                    </button>
                  </div>
                </div>
              </div>

              {/* Chế độ 2: Nhập dạng Sprite Sheet */}
              <div
                onClick={() => setImageMode("spritesheet")}
                data-testid="import-mode-spritesheet"
                className={`flex flex-col gap-2.5 rounded-md border p-3 transition-colors cursor-pointer ${
                  imageMode === "spritesheet"
                    ? "border-amber-400/60 bg-amber-500/8"
                    : "border-white/8 bg-[#12141a] opacity-75 hover:opacity-100"
                }`}
              >
                <label className="flex items-center gap-2 text-xs font-semibold text-zinc-100 cursor-pointer">
                  <input
                    type="radio"
                    name="image-import-mode"
                    checked={imageMode === "spritesheet"}
                    onChange={() => setImageMode("spritesheet")}
                    className="accent-amber-400"
                  />
                  <span>Nhập dạng Sprite Sheet</span>
                </label>

                <div className="flex flex-col gap-2 pl-5">
                  <div className="flex items-center gap-2">
                    <span className="w-24 shrink-0 text-[11px] text-zinc-400">
                      Kích thước khung
                    </span>
                    <Input
                      type="number"
                      min={CANVAS_LIMITS.MIN_SIZE}
                      max={CANVAS_LIMITS.HARD_MAX}
                      value={frameWidth}
                      data-testid="import-frame-w"
                      onChange={(e) => setFrameWidth(e.target.value)}
                      className="h-7 text-center"
                    />
                    <span className="text-xs text-zinc-500">×</span>
                    <Input
                      type="number"
                      min={CANVAS_LIMITS.MIN_SIZE}
                      max={CANVAS_LIMITS.HARD_MAX}
                      value={frameHeight}
                      data-testid="import-frame-h"
                      onChange={(e) => setFrameHeight(e.target.value)}
                      className="h-7 text-center"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="w-24 shrink-0 text-[11px] text-zinc-400">
                      Độ lệch (Offset)
                    </span>
                    <Input
                      type="number"
                      min={0}
                      value={offsetX}
                      data-testid="import-offset-x"
                      onChange={(e) => setOffsetX(e.target.value)}
                      className="h-7 text-center"
                    />
                    <span className="text-xs text-zinc-500">×</span>
                    <Input
                      type="number"
                      min={0}
                      value={offsetY}
                      data-testid="import-offset-y"
                      onChange={(e) => setOffsetY(e.target.value)}
                      className="h-7 text-center"
                    />
                  </div>

                  <div className="flex items-center justify-between rounded bg-black/25 px-2 py-1 text-[11px]">
                    <span className="text-zinc-400">Số khung tách được:</span>
                    <span
                      data-testid="spritesheet-frame-count"
                      className={`font-mono font-semibold ${
                        sheetTotalFrames > 0 ? "text-amber-300" : "text-rose-400"
                      }`}
                    >
                      {sheetCols} × {sheetRows} = {sheetTotalFrames} khung
                    </span>
                  </div>
                </div>
              </div>

              {/* Cảnh báo kích thước hoặc lỗi */}
              {((imageMode === "single" && !singleValidation.valid) ||
                (imageMode === "spritesheet" && !frameValidation.valid)) && (
                <p className="rounded border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-xs text-rose-300">
                  {imageMode === "single" ? singleValidation.error : frameValidation.error}
                </p>
              )}

              {((imageMode === "single" && singleValidation.warning) ||
                (imageMode === "spritesheet" && frameValidation.warning)) && (
                <div className="flex items-start gap-2 rounded border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-200">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
                  <span>
                    Kích thước trên {CANVAS_LIMITS.RECOMMENDED_MAX}×{CANVAS_LIMITS.RECOMMENDED_MAX}{" "}
                    có thể làm giảm độ mượt khi chỉnh sửa.
                  </span>
                </div>
              )}

              {error && (
                <p className="rounded border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-xs text-rose-300">
                  {error}
                </p>
              )}
            </div>

            {/* Cột phải: Khung xem trước trực tiếp + Lưới cắt Sprite Sheet */}
            <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-white/20 bg-[#12141a] p-2">
              <canvas
                ref={previewCanvasRef}
                width={PREVIEW_W}
                height={PREVIEW_H}
                data-testid="import-preview-canvas"
                className="pixelated checkerboard-swatch block rounded border border-white/10"
              />
              <span className="text-[10px] text-zinc-500">
                {imageMode === "spritesheet"
                  ? "Khung vàng hiển thị vị trí từng frame sẽ được cắt"
                  : `Xem trước ảnh đơn (${resizeWidth}×${resizeHeight} px)`}
              </span>
            </div>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept=".png,.jpg,.jpeg,.webp,.gif,.json,.pxs.json,image/png,image/jpeg,image/webp,image/gif,application/json"
          className="hidden"
          data-testid="import-file-input"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFileSelected(file);
          }}
        />

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              clearLoadedImage();
              onOpenChange(false);
            }}
          >
            Hủy
          </Button>
          {loadedImage && (
            <Button
              type="button"
              disabled={!canConfirm}
              data-testid="confirm-import-btn"
              onClick={handleConfirmImport}
            >
              Nhập
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
