"use client";

import React, { useState } from "react";
import { Layers, Palette } from "lucide-react";
import { useEditorStore } from "@/stores/editorStore";
import { AnimationPreviewCard } from "@/components/panels/AnimationPreviewCard";
import { ColorPanel } from "@/components/panels/ColorPanel";
import { LayerPanel } from "@/components/panels/LayerPanel";

type InspectorTab = "colors" | "layers";

export function InspectorSidebar() {
  const rightPanelOpen = useEditorStore((s) => s.rightPanelOpen);
  const layerCount = useEditorStore((s) => s.documentMeta.layerCount);
  const [activeTab, setActiveTab] = useState<InspectorTab>("colors");

  if (!rightPanelOpen) {
    return null;
  }

  return (
    <aside
      data-testid="inspector-sidebar"
      className="flex w-[284px] shrink-0 flex-col border-l border-white/8 bg-[#181b22] select-none"
    >
      {/* Always-visible live Animation Preview & FPS widget */}
      <AnimationPreviewCard />

      {/* Inspector Tabs: Colors | Layers */}
      <div className="grid grid-cols-2 border-b border-white/8 bg-[#14171e] p-1">
        <button
          type="button"
          data-testid="tab-colors"
          onClick={() => setActiveTab("colors")}
          className={`flex items-center justify-center gap-1.5 rounded py-1.5 text-xs font-medium transition-colors cursor-pointer ${
            activeTab === "colors"
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
          onClick={() => setActiveTab("layers")}
          className={`flex items-center justify-center gap-1.5 rounded py-1.5 text-xs font-medium transition-colors cursor-pointer ${
            activeTab === "layers"
              ? "bg-[#222631] text-amber-300 shadow-sm"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <Layers className="h-3.5 w-3.5" />
          <span>Layers ({layerCount})</span>
        </button>
      </div>

      {/* Scrollable Active Tab Content */}
      <div className="min-h-0 flex-1 overflow-y-auto p-3.5">
        {activeTab === "colors" ? <ColorPanel /> : <LayerPanel />}
      </div>
    </aside>
  );
}
