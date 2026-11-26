"use client";

import React, { useEffect, useRef, useState } from "react";
import { Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { MAX_FPS, MIN_FPS } from "@/types/editor";
import { useEditorService } from "@/hooks/EditorContext";
import { useEditorStore } from "@/stores/editorStore";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface AnimationPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type PreviewZoom = "fit" | 2 | 4 | 8 | 12;
type PreviewBackdrop = "checker" | "dark" | "light";

const STAGE_SIZE = 384;

const ZOOM_OPTIONS: ReadonlyArray<{ value: PreviewZoom; label: string }> = [
  { value: "fit", label: "Vừa" },
  { value: 2, label: "2×" },
  { value: 4, label: "4×" },
  { value: 8, label: "8×" },
  { value: 12, label: "12×" },
];

const BACKDROP_OPTIONS: ReadonlyArray<{ value: PreviewBackdrop; label: string }> = [
  { value: "checker", label: "Ô caro" },
  { value: "dark", label: "Tối" },
  { value: "light", label: "Sáng" },
];

export function AnimationPreviewDialog({ open, onOpenChange }: AnimationPreviewDialogProps) {
  const service = useEditorService();
  const docMeta = useEditorStore((s) => s.documentMeta);
  const isPlaying = useEditorStore((s) => s.isPlaying);
  const setIsPlaying = useEditorStore((s) => s.setIsPlaying);
  const lightingEnabled = useEditorStore((s) => s.lightingConfig.enabled);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [frameIdx, setFrameIdx] = useState(docMeta.activeFrameIndex);
  const [zoomMode, setZoomMode] = useState<PreviewZoom>("fit");
  const [backdrop, setBackdrop] = useState<PreviewBackdrop>("checker");

  // Sync to active frame when dialog opens
  useEffect(() => {
    if (open) {
      setFrameIdx(docMeta.activeFrameIndex);
    }
  }, [open, docMeta.activeFrameIndex]);

  // Playback timer honoring per-frame durationMs
  useEffect(() => {
    if (!open || !isPlaying || docMeta.frames.length <= 1) {
      return;
    }

    const safeIdx = frameIdx % docMeta.frames.length;
    const duration = docMeta.frames[safeIdx]?.durationMs ?? Math.round(1000 / docMeta.fps);

    const timer = window.setTimeout(() => {
      setFrameIdx((prev) => (prev + 1) % docMeta.frames.length);
    }, Math.max(16, duration));

    return () => window.clearTimeout(timer);
  }, [open, isPlaying, frameIdx, docMeta.frames, docMeta.fps]);

  const safeFrameCount = Math.max(1, docMeta.frames.length);
  const displayIndex = ((frameIdx % safeFrameCount) + safeFrameCount) % safeFrameCount;

  // Render crisp nearest-neighbor frame onto large stage canvas
  useEffect(() => {
    if (!open) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const buf = service.getCompositedFrameBuffer(displayIndex, {
      includeLighting: true,
    });
    ctx.clearRect(0, 0, STAGE_SIZE, STAGE_SIZE);
    if (!buf) return;

    const scratch = document.createElement("canvas");
    scratch.width = buf.width;
    scratch.height = buf.height;
    const sCtx = scratch.getContext("2d");
    if (!sCtx) return;
    const imgData = sCtx.createImageData(buf.width, buf.height);
    imgData.data.set(buf.data);
    sCtx.putImageData(imgData, 0, 0);

    const scale =
      zoomMode === "fit"
        ? Math.min(STAGE_SIZE / buf.width, STAGE_SIZE / buf.height)
        : zoomMode;
    const drawW = Math.max(1, Math.floor(buf.width * scale));
    const drawH = Math.max(1, Math.floor(buf.height * scale));
    const dx = Math.floor((STAGE_SIZE - drawW) / 2);
    const dy = Math.floor((STAGE_SIZE - drawH) / 2);

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(scratch, 0, 0, buf.width, buf.height, dx, dy, drawW, drawH);
  }, [
    open,
    service,
    displayIndex,
    zoomMode,
    docMeta.revision,
    docMeta.lightingRevision,
    docMeta.width,
    docMeta.height,
    lightingEnabled,
  ]);

  const stepFrame = (delta: number) => {
    setIsPlaying(false);
    setFrameIdx((prev) => (prev + delta + safeFrameCount) % safeFrameCount);
  };

  const backdropClass =
    backdrop === "checker"
      ? "checkerboard-swatch"
      : backdrop === "dark"
        ? "bg-[#111318]"
        : "bg-zinc-200";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="animation-preview-dialog" className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Xem trước hoạt ảnh</DialogTitle>
          <DialogDescription>
            {docMeta.name} — {docMeta.width}×{docMeta.height} px • Khung {displayIndex + 1}/
            {docMeta.frameCount}
            {lightingEnabled ? " • Đang bật ánh sáng" : ""}
          </DialogDescription>
        </DialogHeader>

        {/* Large Preview Stage */}
        <div className="flex justify-center">
          <div
            className={`relative flex h-[384px] w-[384px] items-center justify-center overflow-hidden rounded-lg border border-white/15 shadow-inner ${backdropClass}`}
          >
            <canvas
              ref={canvasRef}
              width={STAGE_SIZE}
              height={STAGE_SIZE}
              className="pixelated block h-full w-full"
            />
            <span className="absolute bottom-2 right-2 rounded bg-black/75 px-1.5 py-0.5 font-mono text-[11px] text-zinc-200">
              {displayIndex + 1}/{docMeta.frameCount}
            </span>
          </div>
        </div>

        {/* Playback + Frame Stepping + FPS */}
        <div className="flex flex-col gap-3 rounded-md border border-white/8 bg-[#12141a] p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="h-8 w-8"
                disabled={docMeta.frameCount <= 1}
                onClick={() => stepFrame(-1)}
                aria-label="Khung trước"
                data-testid="preview-modal-prev-btn"
              >
                <SkipBack className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant={isPlaying ? "default" : "secondary"}
                size="sm"
                className="h-8 min-w-[92px]"
                onClick={() => setIsPlaying(!isPlaying)}
                data-testid="preview-modal-play-btn"
              >
                {isPlaying ? (
                  <>
                    <Pause className="h-3.5 w-3.5" />
                    <span>Tạm dừng</span>
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5" />
                    <span>Phát</span>
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="h-8 w-8"
                disabled={docMeta.frameCount <= 1}
                onClick={() => stepFrame(1)}
                aria-label="Khung tiếp theo"
                data-testid="preview-modal-next-btn"
              >
                <SkipForward className="h-3.5 w-3.5" />
              </Button>
            </div>

            <div className="flex min-w-[160px] flex-1 flex-col gap-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-zinc-400">Tốc độ</span>
                <span className="font-mono text-zinc-200">{docMeta.fps} FPS</span>
              </div>
              <input
                type="range"
                min={MIN_FPS}
                max={MAX_FPS}
                value={docMeta.fps}
                onChange={(e) => service.setFps(Number(e.target.value), true)}
                aria-label="Tốc độ phát FPS"
                className="h-1.5 w-full cursor-pointer accent-amber-400"
              />
            </div>
          </div>

          {/* Zoom & Backdrop Selectors */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/8 pt-2.5">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-zinc-400">Thu phóng</span>
              <div className="flex gap-1">
                {ZOOM_OPTIONS.map((opt) => (
                  <button
                    key={String(opt.value)}
                    type="button"
                    onClick={() => setZoomMode(opt.value)}
                    className={`rounded border px-2 py-0.5 font-mono text-[11px] cursor-pointer ${
                      zoomMode === opt.value
                        ? "border-amber-400 bg-amber-500/20 text-amber-300"
                        : "border-white/10 bg-[#181b22] text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-zinc-400">Nền</span>
              <div className="flex gap-1">
                {BACKDROP_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setBackdrop(opt.value)}
                    className={`rounded border px-2 py-0.5 text-[11px] cursor-pointer ${
                      backdrop === opt.value
                        ? "border-amber-400 bg-amber-500/20 text-amber-300"
                        : "border-white/10 bg-[#181b22] text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
