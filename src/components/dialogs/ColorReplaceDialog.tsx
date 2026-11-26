"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ArrowRightLeft, Check, RefreshCw } from "lucide-react";
import type { ColorReplaceScope, RGBA } from "@/types/editor";
import { useEditorService } from "@/hooks/EditorContext";
import { useEditorStore } from "@/stores/editorStore";
import {
  colorsEqual,
  hexToRgba,
  rgbaToCss,
  rgbaToHex,
} from "@/core/image-processing/color";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ColorReplaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ColorReplaceDialog({ open, onOpenChange }: ColorReplaceDialogProps) {
  const service = useEditorService();
  const docMeta = useEditorStore((s) => s.documentMeta);
  const primaryColor = useEditorStore((s) => s.primaryColor);
  const secondaryColor = useEditorStore((s) => s.secondaryColor);

  const [scope, setScope] = useState<ColorReplaceScope>("all-frames");
  const [sourceColor, setSourceColor] = useState<RGBA>(primaryColor);
  const [targetColor, setTargetColor] = useState<RGBA>(secondaryColor);
  const [tolerance, setTolerance] = useState<number>(0);
  const [lastResultMsg, setLastResultMsg] = useState<string | null>(null);

  const paletteColors = useMemo(() => {
    if (!open) return [];
    // Re-read whenever revision or scope changes
    void docMeta.revision;
    return service.getPaletteColorsForScope(scope);
  }, [open, service, scope, docMeta.revision]);

  // Auto-select the most frequent color in the sprite when opening
  useEffect(() => {
    if (!open) return;
    setLastResultMsg(null);
    const detected = service.getPaletteColorsForScope(scope);
    if (detected.length > 0) {
      setSourceColor(detected[0]!.color);
    } else {
      setSourceColor(primaryColor);
    }
    setTargetColor(primaryColor);
    // Only run on dialog open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const matchCount = useMemo(() => {
    if (!open) return 0;
    void docMeta.revision;
    return service.countColorMatches(sourceColor, tolerance, scope);
  }, [open, service, sourceColor, tolerance, scope, docMeta.revision]);

  const handleApply = () => {
    const replaced = service.replaceColor({
      sourceColor,
      targetColor,
      tolerance,
      scope,
    });
    if (replaced > 0) {
      setLastResultMsg(
        `Đã đổi ${replaced} pixel (${rgbaToHex(sourceColor)} → ${rgbaToHex(targetColor)}). Bạn có thể tiếp tục đổi cặp màu khác hoặc đóng.`,
      );
      setSourceColor(targetColor);
    } else {
      setLastResultMsg("Không có pixel nào thay đổi (màu gốc và màu đích trùng nhau hoặc lớp bị khóa).");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="color-replace-dialog" className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-amber-400" />
            <span>Đổi màu hàng loạt (Color Replace / Recolor Swap)</span>
          </DialogTitle>
          <DialogDescription>
            Thay thế nhanh một màu trên lớp, khung hoặc toàn bộ hoạt ảnh để tạo biến thể skin /
            nhân vật. Hỗ trợ Undo (Ctrl+Z).
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3.5">
          {/* Phạm vi */}
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-medium text-zinc-300">Phạm vi đổi màu</span>
            <select
              value={scope}
              data-testid="color-replace-scope"
              onChange={(e) => setScope(e.target.value as ColorReplaceScope)}
              className="h-8 rounded border border-white/12 bg-[#12141a] px-2 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-amber-400"
            >
              <option value="current-layer">Lớp hiện tại</option>
              <option value="current-frame">Khung hiện tại</option>
              <option value="all-frames">Tất cả khung ({docMeta.frameCount})</option>
            </select>
          </div>

          {/* Danh sách màu tự động phát hiện trong sprite */}
          <div className="flex flex-col gap-1.5 rounded-md border border-white/8 bg-[#12141a] p-2.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-medium text-zinc-300">
                Màu đang có trong sprite ({paletteColors.length})
              </span>
              <span className="text-[10px] text-zinc-500">Click chọn làm Màu gốc</span>
            </div>
            {paletteColors.length === 0 ? (
              <p className="text-[11px] text-zinc-500">Chưa có pixel màu nào trong phạm vi chọn.</p>
            ) : (
              <div
                data-testid="detected-sprite-colors"
                className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto py-0.5"
              >
                {paletteColors.map((entry) => {
                  const isSelected = colorsEqual(entry.color, sourceColor);
                  return (
                    <button
                      key={entry.packed}
                      type="button"
                      title={`${rgbaToHex(entry.color)} (${entry.count} px)`}
                      onClick={() => setSourceColor(entry.color)}
                      className={`checkerboard-swatch relative h-6 w-6 overflow-hidden rounded border transition-transform hover:scale-110 cursor-pointer ${
                        isSelected
                          ? "border-amber-400 ring-2 ring-amber-400/50"
                          : "border-white/20"
                      }`}
                    >
                      <span
                        className="block h-full w-full"
                        style={{ backgroundColor: rgbaToCss(entry.color) }}
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Chọn màu gốc -> màu đích */}
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <div className="flex flex-col gap-1.5 rounded-md border border-white/8 bg-[#12141a] p-2.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-medium text-zinc-300">Màu gốc</span>
                <button
                  type="button"
                  onClick={() => setSourceColor({ ...primaryColor })}
                  className="text-[10px] text-amber-300 hover:underline cursor-pointer"
                >
                  Màu chính
                </button>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  aria-label="Màu gốc"
                  data-testid="color-replace-source-input"
                  value={rgbaToHex(sourceColor)}
                  onChange={(e) => {
                    const parsed = hexToRgba(e.target.value);
                    if (parsed) setSourceColor(parsed);
                  }}
                  className="h-8 w-10 cursor-pointer rounded border border-white/15 bg-transparent"
                />
                <span className="font-mono text-xs text-zinc-200">
                  {rgbaToHex(sourceColor)}
                </span>
              </div>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title="Hoán đổi màu gốc và màu đích"
              onClick={() => {
                const prev = sourceColor;
                setSourceColor(targetColor);
                setTargetColor(prev);
              }}
            >
              <ArrowRightLeft className="h-4 w-4 text-zinc-400" />
            </Button>

            <div className="flex flex-col gap-1.5 rounded-md border border-white/8 bg-[#12141a] p-2.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-medium text-zinc-300">Màu đích</span>
                <button
                  type="button"
                  onClick={() => setTargetColor({ ...primaryColor })}
                  className="text-[10px] text-amber-300 hover:underline cursor-pointer"
                >
                  Màu chính
                </button>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  aria-label="Màu đích"
                  data-testid="color-replace-target-input"
                  value={rgbaToHex(targetColor)}
                  onChange={(e) => {
                    const parsed = hexToRgba(e.target.value);
                    if (parsed) setTargetColor(parsed);
                  }}
                  className="h-8 w-10 cursor-pointer rounded border border-white/15 bg-transparent"
                />
                <span className="font-mono text-xs text-zinc-200">
                  {rgbaToHex(targetColor)}
                </span>
              </div>
            </div>
          </div>

          {/* Dung sai (Tolerance) + Bộ đếm pixel khớp */}
          <div className="flex flex-col gap-1.5 rounded-md border border-white/8 bg-[#12141a] p-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-300">Dung sai màu (Tolerance)</span>
              <span className="font-mono text-zinc-200">{tolerance}</span>
            </div>
            <input
              type="range"
              min={0}
              max={64}
              value={tolerance}
              data-testid="color-replace-tolerance"
              onChange={(e) => setTolerance(Number(e.target.value))}
              className="h-1.5 w-full cursor-pointer accent-amber-400"
            />
            <div className="flex items-center justify-between pt-0.5 text-[11px]">
              <span className="text-zinc-500">0 = khớp tuyệt đối cùng mã màu</span>
              <span
                data-testid="color-replace-match-count"
                className="font-mono font-medium text-amber-300"
              >
                Khớp {matchCount} pixel
              </span>
            </div>
          </div>

          {lastResultMsg && (
            <p className="rounded border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1.5 text-xs text-emerald-200">
              {lastResultMsg}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Đóng
          </Button>
          <Button
            type="button"
            disabled={matchCount === 0}
            onClick={handleApply}
            data-testid="confirm-color-replace-btn"
          >
            <Check className="h-3.5 w-3.5" />
            <span>Đổi màu ({matchCount} px)</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
