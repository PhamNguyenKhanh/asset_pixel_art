"use client";

import React from "react";
import {
  Compass,
  Download,
  FilePlus2,
  Film,
  FlipHorizontal2,
  FlipVertical2,
  Grid3x3,
  Maximize2,
  PanelRightClose,
  PanelRightOpen,
  Redo2,
  RotateCw,
  Scaling,
  Undo2,
  Upload,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useEditorService } from "@/hooks/EditorContext";
import { useEditorStore } from "@/stores/editorStore";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface TopActionBarProps {
  onOpenNewCanvas: () => void;
  onOpenResizeCrop: () => void;
  onOpenImport: () => void;
  onOpenExport: () => void;
}

export function TopActionBar({
  onOpenNewCanvas,
  onOpenResizeCrop,
  onOpenImport,
  onOpenExport,
}: TopActionBarProps) {
  const service = useEditorService();
  const docMeta = useEditorStore((s) => s.documentMeta);
  const zoom = useEditorStore((s) => s.zoom);
  const showGrid = useEditorStore((s) => s.showGrid);
  const rightPanelOpen = useEditorStore((s) => s.rightPanelOpen);
  const setRightPanelOpen = useEditorStore((s) => s.setRightPanelOpen);
  const setInspectorTab = useEditorStore((s) => s.setInspectorTab);
  const timelineOpen = useEditorStore((s) => s.timelineOpen);
  const setTimelineOpen = useEditorStore((s) => s.setTimelineOpen);

  const zoomPercent = Math.round(zoom * 100);
  const activeContextProfile = service.getAssetContextProfile();

  return (
    <header className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-white/8 bg-[#181b22] px-3 select-none">
      {/* Left: Brand + File Actions */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2">
          <div
            aria-hidden="true"
            className="grid h-6 w-6 grid-cols-2 gap-[2px] rounded bg-amber-500/15 p-1 ring-1 ring-amber-400/40"
          >
            <span className="rounded-[1px] bg-amber-400" />
            <span className="rounded-[1px] bg-amber-300/40" />
            <span className="rounded-[1px] bg-amber-300/40" />
            <span className="rounded-[1px] bg-amber-400" />
          </div>
          <span className="hidden text-xs font-semibold tracking-wide text-zinc-100 xl:inline">
            PIXEL ART STUDIO
          </span>
        </div>

        <div className="h-4 w-px bg-white/10" />

        <div className="flex items-center gap-1.5">
          <span className="max-w-[130px] truncate text-xs font-medium text-zinc-300">
            {docMeta.name}
          </span>
          <span
            data-testid="canvas-size-badge"
            className="rounded border border-white/10 bg-[#111318] px-1.5 py-0.5 font-mono text-[11px] text-zinc-400"
          >
            {docMeta.width}×{docMeta.height}
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                data-testid="context-pill-btn"
                onClick={() => {
                  setRightPanelOpen(true);
                  setInspectorTab("context");
                }}
                className={`flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-medium transition-colors cursor-pointer ${
                  activeContextProfile.id !== "custom"
                    ? "border-amber-400/40 bg-amber-500/15 text-amber-300"
                    : "border-white/10 bg-[#111318] text-zinc-400 hover:border-white/25 hover:text-zinc-200"
                }`}
              >
                <Compass className="h-3 w-3" />
                <span>{activeContextProfile.label}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent>
              Asset Context: {activeContextProfile.label} (Click to change)
            </TooltipContent>
          </Tooltip>
        </div>

        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="secondary"
                size="sm"
                onClick={onOpenNewCanvas}
                data-testid="new-canvas-btn"
              >
                <FilePlus2 className="h-3.5 w-3.5 text-amber-400" />
                <span>New</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Create New Canvas</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="secondary"
                size="sm"
                onClick={onOpenImport}
                data-testid="import-btn"
              >
                <Upload className="h-3.5 w-3.5 text-zinc-300" />
                <span>Import</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Import PNG, JPG, WebP, GIF, or .pxs.json</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="default"
                size="sm"
                onClick={onOpenExport}
                data-testid="export-btn"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Export</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Export PNG, GIF, Sprite Sheet + JSON, or Project</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Center: Undo/Redo + Transform + Zoom + Grid */}
      <div className="flex items-center gap-1">
        <div className="flex items-center gap-0.5 rounded-md border border-white/8 bg-[#12141a] p-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                disabled={!docMeta.canUndo}
                onClick={() => service.undo()}
                aria-label="Undo"
                data-testid="undo-btn"
              >
                <Undo2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Undo (Ctrl+Z)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                disabled={!docMeta.canRedo}
                onClick={() => service.redo()}
                aria-label="Redo"
                data-testid="redo-btn"
              >
                <Redo2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Redo (Ctrl+Shift+Z / Ctrl+Y)</TooltipContent>
          </Tooltip>
        </div>

        <div className="mx-1 h-4 w-px bg-white/10" />

        {/* Transform & Resize Group */}
        <div className="flex items-center gap-0.5 rounded-md border border-white/8 bg-[#12141a] p-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => service.flipHorizontal()}
                aria-label="Flip Horizontal"
                data-testid="flip-h-btn"
              >
                <FlipHorizontal2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Flip Horizontal (Selection or Layer)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => service.flipVertical()}
                aria-label="Flip Vertical"
                data-testid="flip-v-btn"
              >
                <FlipVertical2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Flip Vertical (Selection or Layer)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => service.rotate90("cw")}
                aria-label="Rotate 90° Clockwise"
                data-testid="rotate-cw-btn"
              >
                <RotateCw className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Rotate Canvas 90° CW</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={onOpenResizeCrop}
                aria-label="Resize or Crop Canvas"
                data-testid="resize-crop-btn"
              >
                <Scaling className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Resize / Scale / Crop Canvas</TooltipContent>
          </Tooltip>
        </div>

        <div className="mx-1 h-4 w-px bg-white/10" />

        {/* Zoom Controls */}
        <div className="flex items-center gap-0.5 rounded-md border border-white/8 bg-[#12141a] p-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => service.zoomOut()}
                aria-label="Zoom Out"
                data-testid="zoom-out-btn"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Zoom Out (-)</TooltipContent>
          </Tooltip>

          <span
            data-testid="zoom-readout"
            className="min-w-[46px] text-center font-mono text-[11px] text-zinc-300"
          >
            {zoomPercent}%
          </span>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => service.zoomIn()}
                aria-label="Zoom In"
                data-testid="zoom-in-btn"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Zoom In (+)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => service.fitViewport()}
                aria-label="Fit Canvas to Viewport"
                data-testid="zoom-fit-btn"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Fit Canvas (0)</TooltipContent>
          </Tooltip>
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="tool"
              size="icon"
              data-active={showGrid}
              onClick={() => service.toggleGrid()}
              aria-label="Toggle Pixel Grid"
              data-testid="grid-toggle-btn"
              className="h-8 w-8"
            >
              <Grid3x3 className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Toggle Pixel Grid (G)</TooltipContent>
        </Tooltip>
      </div>

      {/* Right: Panel Toggles */}
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="tool"
              size="icon"
              data-active={timelineOpen}
              onClick={() => setTimelineOpen(!timelineOpen)}
              aria-label={timelineOpen ? "Hide Animation Timeline" : "Show Animation Timeline"}
              data-testid="toggle-timeline-btn"
              className="h-8 w-8"
            >
              <Film className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {timelineOpen ? "Hide Timeline" : "Show Timeline"}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setRightPanelOpen(!rightPanelOpen)}
              aria-label={rightPanelOpen ? "Hide Inspector Panel" : "Show Inspector Panel"}
              data-testid="toggle-right-panel-btn"
            >
              {rightPanelOpen ? (
                <PanelRightClose className="h-4 w-4" />
              ) : (
                <PanelRightOpen className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {rightPanelOpen ? "Hide Inspector" : "Show Inspector"}
          </TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
}
