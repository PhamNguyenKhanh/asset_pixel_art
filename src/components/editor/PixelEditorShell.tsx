"use client";

import React, { useState } from "react";
import { EditorProvider } from "@/hooks/EditorContext";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TopActionBar } from "@/components/toolbar/TopActionBar";
import { ToolRail } from "@/components/toolbar/ToolRail";
import { CanvasViewport } from "@/components/editor/CanvasViewport";
import { ColorPanel } from "@/components/panels/ColorPanel";
import { StatusBar } from "@/components/editor/StatusBar";
import { NewCanvasDialog } from "@/components/dialogs/NewCanvasDialog";

export function PixelEditorShell() {
  const [newCanvasOpen, setNewCanvasOpen] = useState(false);

  return (
    <TooltipProvider delayDuration={300}>
      <EditorProvider>
        <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#111318] text-zinc-100">
          <TopActionBar onOpenNewCanvas={() => setNewCanvasOpen(true)} />
          <div className="flex min-h-0 flex-1 overflow-hidden">
            <ToolRail />
            <CanvasViewport />
            <ColorPanel />
          </div>
          <StatusBar />
          <NewCanvasDialog open={newCanvasOpen} onOpenChange={setNewCanvasOpen} />
        </div>
      </EditorProvider>
    </TooltipProvider>
  );
}
