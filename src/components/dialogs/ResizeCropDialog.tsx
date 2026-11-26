"use client";

import React, { useEffect, useState } from "react";
import { AlertTriangle, Crop, Maximize, Scissors } from "lucide-react";
import {
  CANVAS_LIMITS,
  type ResizeAnchor,
  type ResizeMode,
} from "@/types/editor";
import { validateCanvasDimensions } from "@/core/document/PixelDocument";
import { useEditorService } from "@/hooks/EditorContext";
import { useEditorStore } from "@/stores/editorStore";
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

interface ResizeCropDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ANCHOR_GRID: readonly ResizeAnchor[] = [
  "top-left",
  "top",
  "top-right",
  "left",
  "center",
  "right",
  "bottom-left",
  "bottom",
  "bottom-right",
];

export function ResizeCropDialog({ open, onOpenChange }: ResizeCropDialogProps) {
  const service = useEditorService();
  const docMeta = useEditorStore((s) => s.documentMeta);

  const [widthInput, setWidthInput] = useState(String(docMeta.width));
  const [heightInput, setHeightInput] = useState(String(docMeta.height));
  const [mode, setMode] = useState<ResizeMode>("canvas");
  const [anchor, setAnchor] = useState<ResizeAnchor>("center");

  useEffect(() => {
    if (open) {
      setWidthInput(String(docMeta.width));
      setHeightInput(String(docMeta.height));
    }
  }, [open, docMeta.width, docMeta.height]);

  const width = Number(widthInput);
  const height = Number(heightInput);
  const validation = validateCanvasDimensions(width, height);

  const handleResizeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validation.valid) return;
    service.resizeCanvas(width, height, mode, anchor);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="resize-crop-dialog">
        <DialogHeader>
          <DialogTitle>Resize &amp; Crop Canvas</DialogTitle>
          <DialogDescription>
            Adjust canvas bounds, nearest-neighbor scale pixels, or crop to selection / content.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleResizeSubmit} className="flex flex-col gap-4">
          {/* Resize Mode Toggle */}
          <div className="grid grid-cols-2 gap-1.5 rounded-md border border-white/10 bg-[#12141a] p-1">
            <button
              type="button"
              onClick={() => setMode("canvas")}
              className={`flex items-center justify-center gap-1.5 rounded py-1.5 text-xs font-medium cursor-pointer ${
                mode === "canvas"
                  ? "bg-amber-500/20 text-amber-300"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Maximize className="h-3.5 w-3.5" />
              <span>Resize Canvas</span>
            </button>
            <button
              type="button"
              onClick={() => setMode("scale")}
              className={`flex items-center justify-center gap-1.5 rounded py-1.5 text-xs font-medium cursor-pointer ${
                mode === "scale"
                  ? "bg-amber-500/20 text-amber-300"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Maximize className="h-3.5 w-3.5" />
              <span>Scale Pixels (Nearest)</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="resize-w-input" className="text-xs font-medium text-zinc-300">
                Width (px)
              </label>
              <Input
                id="resize-w-input"
                data-testid="resize-width-input"
                type="number"
                min={CANVAS_LIMITS.MIN_SIZE}
                max={CANVAS_LIMITS.HARD_MAX}
                value={widthInput}
                onChange={(e) => setWidthInput(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="resize-h-input" className="text-xs font-medium text-zinc-300">
                Height (px)
              </label>
              <Input
                id="resize-h-input"
                data-testid="resize-height-input"
                type="number"
                min={CANVAS_LIMITS.MIN_SIZE}
                max={CANVAS_LIMITS.HARD_MAX}
                value={heightInput}
                onChange={(e) => setHeightInput(e.target.value)}
              />
            </div>
          </div>

          {/* 3x3 Anchor Picker (for Canvas Resize mode) */}
          {mode === "canvas" && (
            <div className="flex items-center justify-between rounded-md border border-white/8 bg-[#12141a] p-3">
              <div>
                <p className="text-xs font-medium text-zinc-200">Anchor Position</p>
                <p className="text-[11px] text-zinc-500">
                  Keeps existing artwork aligned when expanding or shrinking.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-1">
                {ANCHOR_GRID.map((pos) => (
                  <button
                    key={pos}
                    type="button"
                    aria-label={`Anchor ${pos}`}
                    onClick={() => setAnchor(pos)}
                    className={`h-6 w-6 rounded border transition-colors cursor-pointer ${
                      anchor === pos
                        ? "border-amber-400 bg-amber-500/30"
                        : "border-white/12 bg-[#1c1f27] hover:border-white/30"
                    }`}
                  />
                ))}
              </div>
            </div>
          )}

          {validation.error && (
            <p className="rounded border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-xs text-rose-300">
              {validation.error}
            </p>
          )}

          {validation.valid && validation.warning && (
            <div className="flex items-start gap-2 rounded border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 text-xs text-amber-200">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
              <span>{validation.warning}</span>
            </div>
          )}

          {/* Quick Crop Actions */}
          <div className="flex flex-col gap-2 border-t border-white/8 pt-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              Quick Crop
            </span>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={!docMeta.selection}
                data-testid="crop-selection-btn"
                onClick={() => {
                  service.cropCanvas();
                  onOpenChange(false);
                }}
              >
                <Crop className="h-3.5 w-3.5 text-amber-400" />
                <span>Crop to Selection</span>
              </Button>
              <Button
                type="button"
                variant="secondary"
                data-testid="trim-transparent-btn"
                onClick={() => {
                  service.trimTransparentBounds();
                  onOpenChange(false);
                }}
              >
                <Scissors className="h-3.5 w-3.5 text-amber-400" />
                <span>Auto-Trim Empty</span>
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!validation.valid}
              data-testid="confirm-resize-btn"
            >
              Apply Resize
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
