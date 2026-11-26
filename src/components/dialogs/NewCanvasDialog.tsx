"use client";

import React, { useState } from "react";
import { AlertTriangle, Lock, Unlock } from "lucide-react";
import { CANVAS_LIMITS, CANVAS_PRESETS } from "@/types/editor";
import type { AssetTypeId } from "@/types/assetContext";
import { validateCanvasDimensions } from "@/core/document/PixelDocument";
import { useEditorService } from "@/hooks/EditorContext";
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

interface NewCanvasDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewCanvasDialog({ open, onOpenChange }: NewCanvasDialogProps) {
  const service = useEditorService();
  const [name, setName] = useState("Untitled Sprite");
  const [widthInput, setWidthInput] = useState(String(CANVAS_LIMITS.DEFAULT_SIZE));
  const [heightInput, setHeightInput] = useState(String(CANVAS_LIMITS.DEFAULT_SIZE));
  const [lockSquare, setLockSquare] = useState(true);
  const [selectedAssetType, setSelectedAssetType] = useState<AssetTypeId>("custom");

  const contextProfiles = service.listAssetContextProfiles();
  const selectedProfile = service.assetContext.getProfile(selectedAssetType);

  const width = Number(widthInput);
  const height = Number(heightInput);
  const validation = validateCanvasDimensions(width, height);

  const handlePreset = (size: number) => {
    setWidthInput(String(size));
    setHeightInput(String(size));
  };

  const handleWidthChange = (val: string) => {
    setWidthInput(val);
    if (lockSquare) {
      setHeightInput(val);
    }
  };

  const handleHeightChange = (val: string) => {
    setHeightInput(val);
    if (lockSquare) {
      setWidthInput(val);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validation.valid) return;
    service.createNewCanvas(
      width,
      height,
      name.trim() || "Untitled Sprite",
      selectedAssetType,
    );
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="new-canvas-dialog">
        <DialogHeader>
          <DialogTitle>Create New Canvas</DialogTitle>
          <DialogDescription>
            Choose a common pixel art preset or specify custom dimensions (up to{" "}
            {CANVAS_LIMITS.HARD_MAX}×{CANVAS_LIMITS.HARD_MAX}).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="sprite-name-input" className="text-xs font-medium text-zinc-300">
              Sprite Name
            </label>
            <Input
              id="sprite-name-input"
              data-testid="sprite-name-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Untitled Sprite"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-300">
                Asset Type <span className="font-normal text-zinc-500">(optional)</span>
              </span>
              {selectedProfile && selectedProfile.id !== "custom" && (
                <span className="text-[10px] text-amber-300/80">
                  Suggested: {selectedProfile.recommendedSizes.join(" / ")}px
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-1">
              {contextProfiles.map((profile) => {
                const active = selectedAssetType === profile.id;
                return (
                  <button
                    key={profile.id}
                    type="button"
                    data-testid={`new-canvas-context-${profile.id}`}
                    onClick={() => setSelectedAssetType(profile.id)}
                    className={`rounded border px-2 py-1 text-[11px] transition-colors cursor-pointer ${
                      active
                        ? "border-amber-400 bg-amber-500/20 text-amber-300"
                        : "border-white/10 bg-[#13151b] text-zinc-400 hover:border-white/25 hover:text-zinc-200"
                    }`}
                  >
                    {profile.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-zinc-300">Presets</span>
            <div className="grid grid-cols-5 gap-1.5">
              {CANVAS_PRESETS.map((size) => {
                const isSelected = width === size && height === size;
                return (
                  <button
                    key={size}
                    type="button"
                    data-testid={`preset-${size}`}
                    onClick={() => handlePreset(size)}
                    className={`rounded-md border px-2 py-1.5 font-mono text-xs transition-colors cursor-pointer ${
                      isSelected
                        ? "border-amber-400 bg-amber-500/20 text-amber-300"
                        : "border-white/10 bg-[#13151b] text-zinc-300 hover:border-white/25"
                    }`}
                  >
                    {size}×{size}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-end gap-2">
            <div className="flex flex-1 flex-col gap-1.5">
              <label htmlFor="canvas-width-input" className="text-xs font-medium text-zinc-300">
                Width (px)
              </label>
              <Input
                id="canvas-width-input"
                data-testid="canvas-width-input"
                type="number"
                min={CANVAS_LIMITS.MIN_SIZE}
                max={CANVAS_LIMITS.HARD_MAX}
                value={widthInput}
                onChange={(e) => handleWidthChange(e.target.value)}
              />
            </div>

            <Button
              type="button"
              variant="secondary"
              size="icon"
              onClick={() => setLockSquare(!lockSquare)}
              aria-label={lockSquare ? "Unlock square ratio" : "Lock square ratio"}
              title={lockSquare ? "Square locked" : "Square unlocked"}
            >
              {lockSquare ? <Lock className="h-3.5 w-3.5 text-amber-400" /> : <Unlock className="h-3.5 w-3.5" />}
            </Button>

            <div className="flex flex-1 flex-col gap-1.5">
              <label htmlFor="canvas-height-input" className="text-xs font-medium text-zinc-300">
                Height (px)
              </label>
              <Input
                id="canvas-height-input"
                data-testid="canvas-height-input"
                type="number"
                min={CANVAS_LIMITS.MIN_SIZE}
                max={CANVAS_LIMITS.HARD_MAX}
                value={heightInput}
                onChange={(e) => handleHeightChange(e.target.value)}
              />
            </div>
          </div>

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

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!validation.valid}
              data-testid="confirm-new-canvas-btn"
            >
              Create Canvas
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
