"use client";

import React, { useState } from "react";
import { Check, Sparkles } from "lucide-react";
import type {
  AutoOutlineConnectivity,
  AutoOutlineScope,
  RGBA,
} from "@/types/editor";
import { useEditorService } from "@/hooks/EditorContext";
import { useEditorStore } from "@/stores/editorStore";
import { hexToRgba, rgbaToHex } from "@/core/image-processing/color";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface AutoOutlineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type OutlinePresetTab = "black" | "custom" | "sel-out";

const CLASSIC_BLACK: RGBA = { r: 20, g: 22, b: 29, a: 255 };

export function AutoOutlineDialog({ open, onOpenChange }: AutoOutlineDialogProps) {
  const service = useEditorService();
  const docMeta = useEditorStore((s) => s.documentMeta);
  const primaryColor = useEditorStore((s) => s.primaryColor);

  const [presetTab, setPresetTab] = useState<OutlinePresetTab>("sel-out");
  const [customColor, setCustomColor] = useState<RGBA>(CLASSIC_BLACK);
  const [darkenAmount, setDarkenAmount] = useState<number>(0.55);
  const [hueShift, setHueShift] = useState<number>(0.45);
  const [connectivity, setConnectivity] = useState<AutoOutlineConnectivity>(4);
  const [scope, setScope] = useState<AutoOutlineScope>("current-layer");
  const [createSeparateLayer, setCreateSeparateLayer] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleApply = () => {
    const applied = service.applyAutoOutline({
      mode: presetTab === "sel-out" ? "sel-out" : "solid",
      color: presetTab === "black" ? CLASSIC_BLACK : customColor,
      darkenAmount,
      hueShift,
      connectivity,
      scope,
      createSeparateLayer,
    });

    if (applied) {
      setFeedback(null);
      onOpenChange(false);
    } else {
      setFeedback("Không tìm thấy pixel trống kề cạnh để tạo viền (hoặc lớp đang khóa/ẩn).");
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setFeedback(null);
        onOpenChange(next);
      }}
    >
      <DialogContent data-testid="auto-outline-dialog" className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-400" />
            <span>Viền tự động (Auto-Outline / Sel-Out)</span>
          </DialogTitle>
          <DialogDescription>
            Tự động tạo viền ngoài 1px quanh hình vẽ. Hỗ trợ hoàn tác (Ctrl+Z).
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3.5">
          {/* Kiểu viền */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-zinc-300">Kiểu viền</span>
            <div className="grid grid-cols-3 gap-1 rounded-md border border-white/10 bg-[#12141a] p-1">
              {(
                [
                  ["black", "Viền đen"],
                  ["custom", "Màu tùy chọn"],
                  ["sel-out", "Sel-Out"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  data-testid={`outline-mode-${id}`}
                  onClick={() => setPresetTab(id)}
                  className={`rounded py-1.5 text-xs font-medium cursor-pointer ${
                    presetTab === id
                      ? "bg-amber-500/20 text-amber-300"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Tùy chọn màu tùy chỉnh */}
          {presetTab === "custom" && (
            <div className="flex items-center justify-between gap-2 rounded-md border border-white/8 bg-[#12141a] p-2.5">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  aria-label="Chọn màu viền"
                  value={rgbaToHex(customColor)}
                  onChange={(e) => {
                    const parsed = hexToRgba(e.target.value);
                    if (parsed) setCustomColor(parsed);
                  }}
                  className="h-7 w-9 cursor-pointer rounded border border-white/15 bg-transparent"
                />
                <span className="font-mono text-xs text-zinc-200">
                  {rgbaToHex(customColor)}
                </span>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-7 text-[11px]"
                onClick={() => setCustomColor({ ...primaryColor, a: 255 })}
              >
                Lấy màu chính
              </Button>
            </div>
          )}

          {/* Tùy chọn Sel-Out */}
          {presetTab === "sel-out" && (
            <div className="flex flex-col gap-2.5 rounded-md border border-white/8 bg-[#12141a] p-3">
              <p className="text-[11px] text-zinc-400">
                Selective Outline tự tính màu viền tối hơn và dịch sắc độ lạnh nhẹ dựa trên màu
                pixel kề cạnh.
              </p>
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-300">Độ tối viền</span>
                  <span className="font-mono text-zinc-200">
                    {Math.round(darkenAmount * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={20}
                  max={85}
                  value={Math.round(darkenAmount * 100)}
                  onChange={(e) => setDarkenAmount(Number(e.target.value) / 100)}
                  className="h-1.5 w-full cursor-pointer accent-amber-400"
                />
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-300">Dịch sắc độ lạnh (Hue Shift)</span>
                  <span className="font-mono text-zinc-200">{Math.round(hueShift * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(hueShift * 100)}
                  onChange={(e) => setHueShift(Number(e.target.value) / 100)}
                  className="h-1.5 w-full cursor-pointer accent-amber-400"
                />
              </div>
            </div>
          )}

          {/* Hướng kết nối (4 hướng / 8 hướng) */}
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-medium text-zinc-300">Kết nối pixel</span>
            <div className="flex gap-1">
              <button
                type="button"
                data-testid="outline-conn-4"
                onClick={() => setConnectivity(4)}
                className={`rounded border px-2.5 py-1 text-xs cursor-pointer ${
                  connectivity === 4
                    ? "border-amber-400 bg-amber-500/20 text-amber-300"
                    : "border-white/10 bg-[#12141a] text-zinc-400 hover:text-zinc-200"
                }`}
              >
                4 hướng (Chuẩn)
              </button>
              <button
                type="button"
                data-testid="outline-conn-8"
                onClick={() => setConnectivity(8)}
                className={`rounded border px-2.5 py-1 text-xs cursor-pointer ${
                  connectivity === 8
                    ? "border-amber-400 bg-amber-500/20 text-amber-300"
                    : "border-white/10 bg-[#12141a] text-zinc-400 hover:text-zinc-200"
                }`}
              >
                8 hướng (Góc chéo)
              </button>
            </div>
          </div>

          {/* Phạm vi áp dụng */}
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-medium text-zinc-300">Phạm vi</span>
            <select
              value={scope}
              data-testid="outline-scope-select"
              onChange={(e) => setScope(e.target.value as AutoOutlineScope)}
              className="h-8 rounded border border-white/12 bg-[#12141a] px-2 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-amber-400"
            >
              <option value="current-layer">Lớp hiện tại</option>
              <option value="current-frame">Khung hiện tại (gộp lớp hiện)</option>
              <option value="all-frames">Tất cả khung ({docMeta.frameCount})</option>
            </select>
          </div>

          {/* Tạo lớp Outline riêng */}
          <label className="flex items-center gap-2 rounded-md border border-white/8 bg-[#12141a] px-2.5 py-2 text-xs text-zinc-300 cursor-pointer">
            <input
              type="checkbox"
              data-testid="outline-separate-layer-checkbox"
              checked={createSeparateLayer}
              onChange={(e) => setCreateSeparateLayer(e.target.checked)}
              className="accent-amber-400"
            />
            <span>Tạo lớp &ldquo;Outline&rdquo; mới (không vẽ đè lên lớp gốc)</span>
          </label>

          {feedback && (
            <p className="rounded border border-amber-400/30 bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-200">
              {feedback}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button
            type="button"
            onClick={handleApply}
            data-testid="confirm-auto-outline-btn"
          >
            <Check className="h-3.5 w-3.5" />
            <span>Tạo viền</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
