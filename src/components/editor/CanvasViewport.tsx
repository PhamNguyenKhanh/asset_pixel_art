"use client";

import React, { useEffect, useRef } from "react";
import { Check, Dices, Mountain, Sparkles, X } from "lucide-react";
import { useEditorService } from "@/hooks/EditorContext";
import { useEditorStore } from "@/stores/editorStore";
import { Button } from "@/components/ui/button";

function SmartFillPreviewOverlayBar() {
  const service = useEditorService();
  const preview = useEditorStore((s) => s.smartFillPreview);

  if (!preview.active) return null;

  return (
    <div
      data-testid="smart-fill-preview-bar"
      onPointerDown={(e) => e.stopPropagation()}
      onPointerMove={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      className="absolute left-1/2 top-3 z-20 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-amber-400/40 bg-[#181b22]/95 px-3 py-1.5 shadow-2xl backdrop-blur-sm"
    >
      <Sparkles className="h-3.5 w-3.5 text-amber-400" />
      <span className="text-xs font-medium text-zinc-100">
        {preview.mode === "material" ? "Material Fill Preview" : "Smart Fill Preview"}
      </span>
      <span className="rounded bg-white/8 px-1.5 py-0.5 font-mono text-[10px] text-zinc-300">
        {preview.pixelCount} px
      </span>

      <div className="mx-0.5 h-4 w-px bg-white/12" />

      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="h-7 px-2"
        data-testid="viewport-reseed-btn"
        onClick={() => service.randomizeSmartFillSeed()}
      >
        <Dices className="h-3.5 w-3.5 text-amber-400" />
        <span>Seed</span>
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 px-2"
        data-testid="viewport-cancel-fill-btn"
        onClick={() => service.cancelSmartFillPreview()}
      >
        <X className="h-3.5 w-3.5" />
        <span>Cancel</span>
      </Button>

      <Button
        type="button"
        variant="default"
        size="sm"
        className="h-7 px-2.5"
        data-testid="viewport-apply-fill-btn"
        onClick={() => service.applySmartFillPreview()}
      >
        <Check className="h-3.5 w-3.5" />
        <span>Apply</span>
      </Button>
    </div>
  );
}

function SurfaceMaskBanner() {
  const service = useEditorService();
  const maskMode = useEditorStore((s) => s.surfaceMaskMode);
  const lightingEnabled = useEditorStore((s) => s.lightingConfig.enabled);

  if (!lightingEnabled || maskMode === "none") return null;

  return (
    <div
      data-testid="surface-mask-banner"
      onPointerDown={(e) => e.stopPropagation()}
      className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-amber-400/35 bg-[#181b22]/95 px-3 py-1.5 text-xs shadow-xl backdrop-blur-sm"
    >
      <Mountain className="h-3.5 w-3.5 text-amber-400" />
      <span className="font-medium text-amber-200">
        Surface Mask Brush: <strong className="uppercase">{maskMode}</strong>
      </span>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="h-6 px-2 text-[10px]"
        onClick={() => service.setSurfaceMaskMode("none")}
      >
        Done
      </Button>
    </div>
  );
}

export function CanvasViewport() {
  const service = useEditorService();
  const activeTool = useEditorStore((s) => s.activeTool);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const displayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    const displayCanvas = displayCanvasRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    if (!container || !displayCanvas || !overlayCanvas) return;

    service.attachViewport(container, displayCanvas, overlayCanvas);

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      const dpr = window.devicePixelRatio || 1;
      service.resizeViewport(width, height, dpr);
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
      service.detachViewport();
    };
  }, [service]);

  const cursorClass =
    activeTool === "eyedropper"
      ? "cursor-copy"
      : activeTool === "move"
        ? "cursor-move"
        : "cursor-crosshair";

  return (
    <main
      ref={containerRef}
      data-testid="canvas-viewport"
      className={`relative flex-1 overflow-hidden bg-[#111318] touch-none select-none ${cursorClass}`}
      style={{
        backgroundImage:
          "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.035) 1px, transparent 0)",
        backgroundSize: "20px 20px",
      }}
    >
      <canvas
        ref={displayCanvasRef}
        data-testid="display-canvas"
        className="pixelated absolute inset-0 block h-full w-full"
      />
      <canvas
        ref={overlayCanvasRef}
        data-testid="overlay-canvas"
        className="pointer-events-none absolute inset-0 block h-full w-full"
      />
      <SmartFillPreviewOverlayBar />
      <SurfaceMaskBanner />
    </main>
  );
}
