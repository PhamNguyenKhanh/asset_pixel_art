"use client";

import React, { useEffect, useRef, useState } from "react";
import { Layers2, Pause, Play } from "lucide-react";
import { MAX_FPS, MIN_FPS } from "@/types/editor";
import { useEditorService } from "@/hooks/EditorContext";
import { useEditorStore } from "@/stores/editorStore";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const PREVIEW_BOX = 96;

export function AnimationPreviewCard() {
  const service = useEditorService();
  const docMeta = useEditorStore((s) => s.documentMeta);
  const isPlaying = useEditorStore((s) => s.isPlaying);
  const setIsPlaying = useEditorStore((s) => s.setIsPlaying);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [previewFrameIdx, setPreviewFrameIdx] = useState(0);

  // Playback timer honoring per-frame durationMs
  useEffect(() => {
    if (!isPlaying || docMeta.frames.length <= 1) {
      return;
    }

    const safeIdx = previewFrameIdx % docMeta.frames.length;
    const duration = docMeta.frames[safeIdx]?.durationMs ?? Math.round(1000 / docMeta.fps);

    const timer = window.setTimeout(() => {
      setPreviewFrameIdx((prev) => (prev + 1) % docMeta.frames.length);
    }, Math.max(16, duration));

    return () => window.clearTimeout(timer);
  }, [isPlaying, previewFrameIdx, docMeta.frames, docMeta.fps]);

  // Render preview frame using nearest-neighbor scaling
  const displayIndex = isPlaying
    ? previewFrameIdx % Math.max(1, docMeta.frames.length)
    : docMeta.activeFrameIndex;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const buf = service.getCompositedFrameBuffer(displayIndex);
    ctx.clearRect(0, 0, PREVIEW_BOX, PREVIEW_BOX);
    if (!buf) return;

    const scratch = document.createElement("canvas");
    scratch.width = buf.width;
    scratch.height = buf.height;
    const sCtx = scratch.getContext("2d");
    if (!sCtx) return;
    const imgData = sCtx.createImageData(buf.width, buf.height);
    imgData.data.set(buf.data);
    sCtx.putImageData(imgData, 0, 0);

    const scale = Math.min(PREVIEW_BOX / buf.width, PREVIEW_BOX / buf.height);
    const drawW = Math.max(1, Math.floor(buf.width * scale));
    const drawH = Math.max(1, Math.floor(buf.height * scale));
    const dx = Math.floor((PREVIEW_BOX - drawW) / 2);
    const dy = Math.floor((PREVIEW_BOX - drawH) / 2);

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(scratch, 0, 0, buf.width, buf.height, dx, dy, drawW, drawH);
  }, [service, displayIndex, docMeta.revision, docMeta.width, docMeta.height]);

  return (
    <div
      data-testid="animation-preview-card"
      className="flex items-center gap-3 border-b border-white/8 bg-[#14171e] p-3"
    >
      {/* Mini Live Preview Canvas */}
      <div className="checkerboard-swatch relative h-24 w-24 shrink-0 overflow-hidden rounded-md border border-white/12 shadow-inner">
        <canvas
          ref={canvasRef}
          width={PREVIEW_BOX}
          height={PREVIEW_BOX}
          className="pixelated block h-full w-full"
        />
        <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 py-0.5 font-mono text-[9px] text-zinc-300">
          {displayIndex + 1}/{docMeta.frameCount}
        </span>
      </div>

      {/* Controls: Play/Pause, FPS, Onion Skin */}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            Preview
          </span>
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="tool"
                  size="icon"
                  className="h-7 w-7"
                  data-active={docMeta.onionSkin.enabled}
                  data-testid="onion-skin-btn"
                  aria-label="Toggle Onion Skin"
                  onClick={() =>
                    service.setOnionSkin({ enabled: !docMeta.onionSkin.enabled })
                  }
                >
                  <Layers2 className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Onion Skin ({docMeta.onionSkin.enabled ? "On" : "Off"})
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={isPlaying ? "default" : "secondary"}
                  size="icon"
                  className="h-7 w-7"
                  data-testid="play-preview-btn"
                  aria-label={isPlaying ? "Pause Preview" : "Play Preview"}
                  onClick={() => {
                    if (!isPlaying) setPreviewFrameIdx(docMeta.activeFrameIndex);
                    setIsPlaying(!isPlaying);
                  }}
                >
                  {isPlaying ? (
                    <Pause className="h-3.5 w-3.5" />
                  ) : (
                    <Play className="h-3.5 w-3.5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{isPlaying ? "Pause Animation" : "Play Animation"}</TooltipContent>
            </Tooltip>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-zinc-500">Speed</span>
            <span data-testid="fps-readout" className="font-mono text-zinc-200">
              {docMeta.fps} FPS
            </span>
          </div>
          <input
            type="range"
            min={MIN_FPS}
            max={MAX_FPS}
            value={docMeta.fps}
            onChange={(e) => service.setFps(Number(e.target.value), true)}
            aria-label="Animation FPS"
            data-testid="fps-slider"
            className="h-1.5 w-full cursor-pointer accent-amber-400"
          />
        </div>
      </div>
    </div>
  );
}
