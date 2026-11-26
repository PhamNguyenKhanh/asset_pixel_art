"use client";

import React, { useEffect, useRef } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Film,
  Layers2,
  Pause,
  Play,
  Plus,
  Trash2,
} from "lucide-react";
import { useEditorService } from "@/hooks/EditorContext";
import { useEditorStore } from "@/stores/editorStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const THUMB_SIZE = 44;

function FrameThumbnail({
  frameIndex,
  revision,
}: {
  frameIndex: number;
  revision: number;
}) {
  const service = useEditorService();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const buf = service.getCompositedFrameBuffer(frameIndex);
    ctx.clearRect(0, 0, THUMB_SIZE, THUMB_SIZE);
    if (!buf) return;

    const scratch = document.createElement("canvas");
    scratch.width = buf.width;
    scratch.height = buf.height;
    const sCtx = scratch.getContext("2d");
    if (!sCtx) return;
    const imgData = sCtx.createImageData(buf.width, buf.height);
    imgData.data.set(buf.data);
    sCtx.putImageData(imgData, 0, 0);

    const scale = Math.min(THUMB_SIZE / buf.width, THUMB_SIZE / buf.height);
    const w = Math.max(1, Math.floor(buf.width * scale));
    const h = Math.max(1, Math.floor(buf.height * scale));
    const dx = Math.floor((THUMB_SIZE - w) / 2);
    const dy = Math.floor((THUMB_SIZE - h) / 2);

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(scratch, 0, 0, buf.width, buf.height, dx, dy, w, h);
  }, [service, frameIndex, revision]);

  return (
    <canvas
      ref={canvasRef}
      width={THUMB_SIZE}
      height={THUMB_SIZE}
      className="pixelated checkerboard-swatch block h-11 w-11 rounded border border-white/10"
    />
  );
}

export function FrameTimeline() {
  const service = useEditorService();
  const docMeta = useEditorStore((s) => s.documentMeta);
  const timelineOpen = useEditorStore((s) => s.timelineOpen);
  const isPlaying = useEditorStore((s) => s.isPlaying);
  const setIsPlaying = useEditorStore((s) => s.setIsPlaying);

  if (!timelineOpen) {
    return null;
  }

  const activeFrame = docMeta.frames[docMeta.activeFrameIndex];

  return (
    <section
      data-testid="frame-timeline"
      className="flex h-[98px] shrink-0 items-center gap-3 border-t border-white/8 bg-[#161920] px-3 select-none"
    >
      {/* Left Timeline Controls */}
      <div className="flex w-44 shrink-0 flex-col gap-1.5 border-r border-white/8 pr-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Film className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              Frames ({docMeta.frameCount})
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={isPlaying ? "default" : "ghost"}
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setIsPlaying(!isPlaying)}
                  aria-label={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{isPlaying ? "Pause Preview" : "Play Preview"}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="tool"
                  size="icon"
                  className="h-6 w-6"
                  data-active={docMeta.onionSkin.enabled}
                  onClick={() =>
                    service.setOnionSkin({ enabled: !docMeta.onionSkin.enabled })
                  }
                  aria-label="Toggle Onion Skin"
                >
                  <Layers2 className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Onion Skin</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Active Frame Duration */}
        <div className="flex items-center justify-between gap-2 text-[11px]">
          <label htmlFor="frame-duration-input" className="text-zinc-500">
            Frame ms
          </label>
          <Input
            id="frame-duration-input"
            data-testid="frame-duration-input"
            type="number"
            min={16}
            max={10000}
            step={10}
            value={activeFrame?.durationMs ?? 125}
            onChange={(e) => {
              const val = Number(e.target.value);
              if (!Number.isNaN(val) && val >= 16) {
                service.setFrameDuration(docMeta.activeFrameIndex, val);
              }
            }}
            className="h-6 w-20 px-1.5 text-right text-[11px]"
          />
        </div>
      </div>

      {/* Horizontal Scrollable Frame Strip */}
      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto py-1">
        {docMeta.frames.map((frame, index) => {
          const isActive = index === docMeta.activeFrameIndex;
          return (
            <div
              key={frame.id}
              data-testid={`frame-card-${index}`}
              data-active={isActive}
              onClick={() => service.selectFrame(index)}
              className={`group relative flex shrink-0 flex-col items-center gap-1 rounded-md border p-1.5 transition-colors cursor-pointer ${
                isActive
                  ? "border-amber-400 bg-amber-500/12"
                  : "border-white/8 bg-[#12141a] hover:border-white/20"
              }`}
            >
              <div className="relative">
                <FrameThumbnail frameIndex={index} revision={docMeta.revision} />
                <span className="absolute left-0.5 top-0.5 rounded bg-black/75 px-1 font-mono text-[9px] text-zinc-200">
                  {index + 1}
                </span>
              </div>

              {/* Quick Frame Actions */}
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  aria-label={`Move frame ${index + 1} left`}
                  disabled={index === 0}
                  onClick={(e) => {
                    e.stopPropagation();
                    service.reorderFrame(index, index - 1);
                  }}
                  className="rounded p-0.5 text-zinc-500 hover:text-zinc-200 disabled:opacity-20 cursor-pointer"
                >
                  <ChevronLeft className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  aria-label={`Duplicate frame ${index + 1}`}
                  data-testid={`duplicate-frame-${index}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    service.duplicateFrame(index);
                  }}
                  className="rounded p-0.5 text-zinc-500 hover:text-amber-300 cursor-pointer"
                >
                  <Copy className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  aria-label={`Delete frame ${index + 1}`}
                  data-testid={`delete-frame-${index}`}
                  disabled={docMeta.frameCount <= 1}
                  onClick={(e) => {
                    e.stopPropagation();
                    service.deleteFrame(index);
                  }}
                  className="rounded p-0.5 text-zinc-500 hover:text-rose-400 disabled:opacity-20 cursor-pointer"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  aria-label={`Move frame ${index + 1} right`}
                  disabled={index >= docMeta.frameCount - 1}
                  onClick={(e) => {
                    e.stopPropagation();
                    service.reorderFrame(index, index + 1);
                  }}
                  className="rounded p-0.5 text-zinc-500 hover:text-zinc-200 disabled:opacity-20 cursor-pointer"
                >
                  <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          );
        })}

        {/* Add Frame Button */}
        <Button
          variant="secondary"
          onClick={() => service.addFrame()}
          data-testid="add-frame-btn"
          className="flex h-[74px] w-14 shrink-0 flex-col gap-1 border-dashed border-white/15 bg-[#12141a] text-zinc-400 hover:border-amber-400/60 hover:text-amber-300"
        >
          <Plus className="h-4 w-4" />
          <span className="text-[10px]">Add</span>
        </Button>
      </div>
    </section>
  );
}
