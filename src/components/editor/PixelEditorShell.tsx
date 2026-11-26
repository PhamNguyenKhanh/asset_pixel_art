"use client";

import React, { useEffect, useState } from "react";
import { EditorProvider } from "@/hooks/EditorContext";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TopActionBar } from "@/components/toolbar/TopActionBar";
import { ToolRail } from "@/components/toolbar/ToolRail";
import { CanvasViewport } from "@/components/editor/CanvasViewport";
import { InspectorSidebar } from "@/components/panels/InspectorSidebar";
import { FrameTimeline } from "@/components/panels/FrameTimeline";
import { StatusBar } from "@/components/editor/StatusBar";
import { NewCanvasDialog } from "@/components/dialogs/NewCanvasDialog";
import { ResizeCropDialog } from "@/components/dialogs/ResizeCropDialog";
import { ImportDialog } from "@/components/dialogs/ImportDialog";
import { ExportDialog } from "@/components/dialogs/ExportDialog";
import { ShortcutsDialog } from "@/components/dialogs/ShortcutsDialog";

export function PixelEditorShell() {
  const [newCanvasOpen, setNewCanvasOpen] = useState(false);
  const [resizeCropOpen, setResizeCropOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "?") return;
      const target = e.target;
      if (
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      setShortcutsOpen((prev) => !prev);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <TooltipProvider delayDuration={300}>
      <EditorProvider>
        <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#111318] text-zinc-100">
          <TopActionBar
            onOpenNewCanvas={() => setNewCanvasOpen(true)}
            onOpenResizeCrop={() => setResizeCropOpen(true)}
            onOpenImport={() => setImportOpen(true)}
            onOpenExport={() => setExportOpen(true)}
            onOpenShortcuts={() => setShortcutsOpen(true)}
          />
          <div className="flex min-h-0 flex-1 overflow-hidden">
            <ToolRail />
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
              <CanvasViewport />
              <FrameTimeline />
            </div>
            <InspectorSidebar />
          </div>
          <StatusBar />

          <NewCanvasDialog open={newCanvasOpen} onOpenChange={setNewCanvasOpen} />
          <ResizeCropDialog open={resizeCropOpen} onOpenChange={setResizeCropOpen} />
          <ImportDialog open={importOpen} onOpenChange={setImportOpen} />
          <ExportDialog open={exportOpen} onOpenChange={setExportOpen} />
          <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
        </div>
      </EditorProvider>
    </TooltipProvider>
  );
}
