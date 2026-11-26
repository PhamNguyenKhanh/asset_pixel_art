"use client";

import React, { useState } from "react";
import { Download, FileJson, Film, Grid, Image as ImageIcon } from "lucide-react";
import { useEditorService } from "@/hooks/EditorContext";
import { useEditorStore } from "@/stores/editorStore";
import {
  buildSpriteSheet,
  type SpriteSheetLayout,
} from "@/modules/import-export/spriteSheet";
import { encodeGif } from "@/modules/import-export/gifCodec";
import {
  downloadBlob,
  downloadText,
  pixelBufferToPngBlob,
} from "@/modules/import-export/pngAndBrowserIO";
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

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ExportTab = "png" | "gif" | "spritesheet" | "project";

const SCALE_PRESETS = [1, 2, 4, 8] as const;

export function ExportDialog({ open, onOpenChange }: ExportDialogProps) {
  const service = useEditorService();
  const docMeta = useEditorStore((s) => s.documentMeta);
  const customPalettes = useEditorStore((s) => s.customPalettes);

  const [tab, setTab] = useState<ExportTab>("png");
  const [scale, setScale] = useState<number>(1);
  const [gifRepeat, setGifRepeat] = useState<number>(0);
  const [sheetLayout, setSheetLayout] = useState<SpriteSheetLayout>("horizontal");
  const [sheetColumns, setSheetColumns] = useState<number>(4);
  const [sheetPadding, setSheetPadding] = useState<number>(0);
  const [includeJson, setIncludeJson] = useState<boolean>(true);
  const [busy, setBusy] = useState(false);

  const safeSlug = docMeta.name.replace(/[^a-zA-Z0-9_-]+/g, "_").toLowerCase() || "sprite";

  const handleExport = async () => {
    setBusy(true);
    try {
      if (tab === "png") {
        const buf = service.getCompositedFrameBuffer(docMeta.activeFrameIndex);
        if (!buf) return;
        const blob = await pixelBufferToPngBlob(buf, scale);
        downloadBlob(blob, `${safeSlug}${scale > 1 ? `_${scale}x` : ""}.png`);
      } else if (tab === "gif") {
        const bytes = encodeGif(service.document, {
          scale,
          repeat: gifRepeat,
          postProcessFrame: (buf, idx) => service.applyLightingToBuffer(buf, idx),
        });
        const copy = new Uint8Array(bytes.length);
        copy.set(bytes);
        const blob = new Blob([copy], { type: "image/gif" });
        downloadBlob(blob, `${safeSlug}${scale > 1 ? `_${scale}x` : ""}.gif`);
      } else if (tab === "spritesheet") {
        const { buffer, metadata } = buildSpriteSheet(service.document, {
          layout: sheetLayout,
          columns: sheetColumns,
          padding: sheetPadding,
          scale,
          postProcessFrame: (buf, idx) => service.applyLightingToBuffer(buf, idx),
        });
        const pngBlob = await pixelBufferToPngBlob(buffer, 1);
        downloadBlob(pngBlob, `${safeSlug}_sheet.png`);
        if (includeJson) {
          downloadText(
            JSON.stringify(metadata, null, 2),
            `${safeSlug}_sheet.json`,
            "application/json",
          );
        }
      } else {
        const serialized = service.exportSerializedProject(customPalettes);
        downloadText(
          JSON.stringify(serialized, null, 2),
          `${safeSlug}.pxs.json`,
          "application/json",
        );
      }
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="export-dialog" className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Export Sprite &amp; Project</DialogTitle>
          <DialogDescription>
            All exports run 100% locally in your browser with crisp nearest-neighbor pixel scaling.
          </DialogDescription>
        </DialogHeader>

        {/* Format Tabs */}
        <div className="grid grid-cols-4 gap-1 rounded-md border border-white/10 bg-[#12141a] p-1">
          {(
            [
              ["png", "PNG", ImageIcon],
              ["gif", "GIF", Film],
              ["spritesheet", "Sheet", Grid],
              ["project", "Project", FileJson],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              data-testid={`export-tab-${id}`}
              onClick={() => setTab(id)}
              className={`flex items-center justify-center gap-1.5 rounded py-1.5 text-xs font-medium cursor-pointer ${
                tab === id
                  ? "bg-amber-500/20 text-amber-300"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* Scale Controls (PNG / GIF / Sprite Sheet) */}
        {tab !== "project" && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-zinc-300">Integer Scale (Nearest-Neighbor)</span>
              <span className="font-mono text-zinc-400">
                {docMeta.width * scale}×{docMeta.height * scale} px / frame
              </span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {SCALE_PRESETS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setScale(s)}
                  className={`rounded border py-1.5 font-mono text-xs cursor-pointer ${
                    scale === s
                      ? "border-amber-400 bg-amber-500/20 text-amber-300"
                      : "border-white/10 bg-[#12141a] text-zinc-300 hover:border-white/25"
                  }`}
                >
                  {s}×
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Format-Specific Options */}
        {tab === "png" && (
          <p className="rounded-md border border-white/8 bg-[#12141a] p-3 text-xs text-zinc-400">
            Exports active frame{" "}
            <span className="font-mono text-zinc-200">#{docMeta.activeFrameIndex + 1}</span> with
            all visible layers composited and full RGBA alpha transparency.
          </p>
        )}

        {tab === "gif" && (
          <div className="flex flex-col gap-2.5 rounded-md border border-white/8 bg-[#12141a] p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-300">Frames</span>
              <span className="font-mono text-zinc-200">
                {docMeta.frameCount} frame(s) @ {docMeta.fps} FPS
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-300">Looping</span>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setGifRepeat(0)}
                  className={`rounded px-2 py-1 text-[11px] cursor-pointer ${
                    gifRepeat === 0
                      ? "bg-amber-500/20 text-amber-300"
                      : "bg-[#1c1f27] text-zinc-400"
                  }`}
                >
                  Loop Forever
                </button>
                <button
                  type="button"
                  onClick={() => setGifRepeat(-1)}
                  className={`rounded px-2 py-1 text-[11px] cursor-pointer ${
                    gifRepeat === -1
                      ? "bg-amber-500/20 text-amber-300"
                      : "bg-[#1c1f27] text-zinc-400"
                  }`}
                >
                  Play Once
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === "spritesheet" && (
          <div className="flex flex-col gap-3 rounded-md border border-white/8 bg-[#12141a] p-3">
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-zinc-300">Layout</span>
              <div className="grid grid-cols-3 gap-1.5">
                {(["horizontal", "vertical", "grid"] as const).map((layout) => (
                  <button
                    key={layout}
                    type="button"
                    onClick={() => setSheetLayout(layout)}
                    className={`rounded border py-1 text-xs capitalize cursor-pointer ${
                      sheetLayout === layout
                        ? "border-amber-400 bg-amber-500/20 text-amber-300"
                        : "border-white/10 bg-[#181b22] text-zinc-400"
                    }`}
                  >
                    {layout}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {sheetLayout === "grid" && (
                <label className="flex flex-col gap-1 text-xs">
                  <span className="text-zinc-400">Columns</span>
                  <Input
                    type="number"
                    min={1}
                    max={Math.max(1, docMeta.frameCount)}
                    value={sheetColumns}
                    onChange={(e) => setSheetColumns(Math.max(1, Number(e.target.value) || 1))}
                  />
                </label>
              )}
              <label className="flex flex-col gap-1 text-xs">
                <span className="text-zinc-400">Padding (px)</span>
                <Input
                  type="number"
                  min={0}
                  max={32}
                  value={sheetPadding}
                  onChange={(e) => setSheetPadding(Math.max(0, Number(e.target.value) || 0))}
                />
              </label>
            </div>

            <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
              <input
                type="checkbox"
                checked={includeJson}
                onChange={(e) => setIncludeJson(e.target.checked)}
                className="accent-amber-400"
              />
              <span>Also download JSON metadata (Unity / Phaser / Aseprite-style frames)</span>
            </label>
          </div>
        )}

        {tab === "project" && (
          <p className="rounded-md border border-white/8 bg-[#12141a] p-3 text-xs text-zinc-400">
            Saves your complete workspace ({docMeta.frameCount} frame(s), {docMeta.layerCount}{" "}
            layer(s), custom palettes) into a local{" "}
            <code className="font-mono text-zinc-200">{safeSlug}.pxs.json</code> file so you can
            reopen and continue editing later.
          </p>
        )}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={busy}
            onClick={() => void handleExport()}
            data-testid="confirm-export-btn"
          >
            <Download className="h-3.5 w-3.5" />
            <span>{busy ? "Exporting..." : "Download"}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
