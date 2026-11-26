"use client";

import React from "react";
import { Compass, Layers, Palette } from "lucide-react";
import { useEditorStore } from "@/stores/editorStore";
import { AnimationPreviewCard } from "@/components/panels/AnimationPreviewCard";
import { ColorPanel } from "@/components/panels/ColorPanel";
import { LayerPanel } from "@/components/panels/LayerPanel";
import { ContextPanel } from "@/components/panels/ContextPanel";

export function InspectorSidebar() {
  const rightPanelOpen = useEditorStore((s) => s.rightPanelOpen);
  const inspectorTab = useEditorStore((s) => s.inspectorTab);
  const setInspectorTab = useEditorStore((s) => s.setInspectorTab);
  const layerCount = useEditorStore((s) => s.documentMeta.layerCount);
  const assetTypeId = useEditorStore((s) => s.documentMeta.assetContext.assetTypeId);

  if (!rightPanelOpen) {
    return null;
  }

  return (
    <aside
      data-testid="inspector-sidebar"
      className="flex w-[288px] shrink-0 flex-col border-l border-white/8 bg-[#181b22] select-none"
    >
      {/* Always-visible live Animation Preview & FPS widget */}
      <AnimationPreviewCard />

      {/* Inspector Tabs: Colors | Layers | Context */}
      <div className="grid grid-cols-3 border-b border-white/8 bg-[#14171e] p-1">
        <button
          type="button"
          data-testid="tab-colors"
          onClick={() => setInspectorTab("colors")}
          className={`flex items-center justify-center gap-1 rounded py-1.5 text-[11px] font-medium transition-colors cursor-pointer ${
            inspectorTab === "colors"
              ? "bg-[#222631] text-amber-300 shadow-sm"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <Palette className="h-3.5 w-3.5" />
          <span>Colors</span>
        </button>

        <button
          type="button"
          data-testid="tab-layers"
          onClick={() => setInspectorTab("layers")}
          className={`flex items-center justify-center gap-1 rounded py-1.5 text-[11px] font-medium transition-colors cursor-pointer ${
            inspectorTab === "layers"
              ? "bg-[#222631] text-amber-300 shadow-sm"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <Layers className="h-3.5 w-3.5" />
          <span>Layers ({layerCount})</span>
        </button>

        <button
          type="button"
          data-testid="tab-context"
          onClick={() => setInspectorTab("context")}
          className={`relative flex items-center justify-center gap-1 rounded py-1.5 text-[11px] font-medium transition-colors cursor-pointer ${
            inspectorTab === "context"
              ? "bg-[#222631] text-amber-300 shadow-sm"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <Compass className="h-3.5 w-3.5" />
          <span>Context</span>
          {assetTypeId !== "custom" && (
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full bg-amber-400"
            />
          )}
        </button>
      </div>

      {/* Scrollable Active Tab Content */}
      <div className="min-h-0 flex-1 overflow-y-auto p-3.5">
        {inspectorTab === "colors" && <ColorPanel />}
        {inspectorTab === "layers" && <LayerPanel />}
        {inspectorTab === "context" && <ContextPanel />}
      </div>
    </aside>
  );
}
