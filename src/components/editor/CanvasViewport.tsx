"use client";

import React, { useEffect, useRef } from "react";
import { useEditorService } from "@/hooks/EditorContext";
import { useEditorStore } from "@/stores/editorStore";

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
    </main>
  );
}
