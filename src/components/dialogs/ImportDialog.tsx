"use client";

import React, { useRef, useState } from "react";
import { FileJson, Film, Image as ImageIcon, Upload } from "lucide-react";
import { useEditorService } from "@/hooks/EditorContext";
import { decodeImageFileToPixelBuffer } from "@/modules/import-export/pngAndBrowserIO";
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

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportDialog({ open, onOpenChange }: ImportDialogProps) {
  const service = useEditorService();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [importMode, setImportMode] = useState<"new-canvas" | "current-layer">("new-canvas");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
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

      // PNG / JPG / JPEG / WebP
      const buffer = await decodeImageFileToPixelBuffer(file);
      service.importImageBuffer(buffer, importMode, baseName);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import file.");
    } finally {
      setBusy(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="import-dialog">
        <DialogHeader>
          <DialogTitle>Import Image, GIF, or Project</DialogTitle>
          <DialogDescription>
            Supports PNG, JPG/JPEG, WebP, animated GIF (splits into timeline frames), and local{" "}
            <code className="font-mono text-zinc-300">.pxs.json</code> project files.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3.5">
          {/* Static Image Import Placement Mode */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-zinc-300">
              For Static Images (PNG / JPG / WebP)
            </span>
            <div className="grid grid-cols-2 gap-1.5 rounded-md border border-white/10 bg-[#12141a] p-1">
              <button
                type="button"
                onClick={() => setImportMode("new-canvas")}
                className={`rounded py-1.5 text-xs font-medium cursor-pointer ${
                  importMode === "new-canvas"
                    ? "bg-amber-500/20 text-amber-300"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Open as New Canvas
              </button>
              <button
                type="button"
                onClick={() => setImportMode("current-layer")}
                className={`rounded py-1.5 text-xs font-medium cursor-pointer ${
                  importMode === "current-layer"
                    ? "bg-amber-500/20 text-amber-300"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Place on Current Layer
              </button>
            </div>
          </div>

          {/* Dropzone / File Picker */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files[0];
              if (file) void handleFile(file);
            }}
            onClick={() => inputRef.current?.click()}
            className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-white/15 bg-[#12141a] px-4 py-8 text-center transition-colors hover:border-amber-400/60"
          >
            <Upload className="h-7 w-7 text-amber-400" />
            <p className="text-xs font-medium text-zinc-200">
              {busy ? "Decoding file..." : "Click to choose a file or drag & drop here"}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 text-[11px] text-zinc-500">
              <span className="flex items-center gap-1">
                <ImageIcon className="h-3 w-3" /> PNG / JPG / WebP
              </span>
              <span className="flex items-center gap-1">
                <Film className="h-3 w-3" /> Animated GIF
              </span>
              <span className="flex items-center gap-1">
                <FileJson className="h-3 w-3" /> .pxs.json
              </span>
            </div>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept=".png,.jpg,.jpeg,.webp,.gif,.json,.pxs.json,image/png,image/jpeg,image/webp,image/gif,application/json"
            className="hidden"
            data-testid="import-file-input"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />

          {error && (
            <p className="rounded border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-xs text-rose-300">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
