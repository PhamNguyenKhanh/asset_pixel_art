"use client";

import React from "react";
import { Compass, Layers, Palette, Sparkles, Sun } from "lucide-react";
import { useEditorStore } from "@/stores/editorStore";
import { AnimationPreviewCard } from "@/components/panels/AnimationPreviewCard";
import { ColorPanel } from "@/components/panels/ColorPanel";
import { SmartFillPanel } from "@/components/panels/SmartFillPanel";
import { LightingPanel } from "@/components/panels/LightingPanel";
import { LayerPanel } from "@/components/panels/LayerPanel";
import { ContextPanel } from "@/components/panels/ContextPanel";

export function InspectorSidebar() {
  const rightPanelOpen = useEditorStore((s) => s.rightPanelOpen);
  const inspectorTab = useEditorStore((s) => s.inspectorTab);
  const setInspectorTab = useEditorStore((s) => s.setInspectorTab);
  const layerCount = useEditorStore((s) => s.documentMeta.layerCount);
  const assetTypeId = useEditorStore((s) => s.documentMeta.assetContext.assetTypeId);
  const fillMode = useEditorStore((s) => s.smartFillConfig.mode);
  const previewActive = useEditorStore((s) => s.smartFillPreview.active);
  const lightingEnabled = useEditorStore((s) => s.lightingConfig.enabled);

  if (!rightPanelOpen) {
    return null;
  }

  return (
    <aside
      data-testid="inspector-sidebar"
      className="flex w-[308px] shrink-0 flex-col border-l border-white/8 bg-[#181b22] select-none"
    >
      <AnimationPreviewCard />

      {/* Tab thuộc tính: Màu | Tô | Sáng | Lớp | Loại */}
      <div className="grid grid-cols-5 border-b border-white/8 bg-[#14171e] p-1 gap-0.5">
        <button
          type="button"
          data-testid="tab-colors"
          onClick={() => setInspectorTab("colors")}
          className={`flex flex-col items-center justify-center gap-0.5 rounded py-1.5 text-[10px] font-medium transition-colors cursor-pointer ${
            inspectorTab === "colors"
              ? "bg-[#222631] text-amber-300 shadow-sm"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <Palette className="h-3.5 w-3.5" />
          <span>Màu</span>
        </button>

        <button
          type="button"
          data-testid="tab-fill"
          onClick={() => setInspectorTab("fill")}
          className={`relative flex flex-col items-center justify-center gap-0.5 rounded py-1.5 text-[10px] font-medium transition-colors cursor-pointer ${
            inspectorTab === "fill"
              ? "bg-[#222631] text-amber-300 shadow-sm"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span>Tô</span>
          {(fillMode !== "solid" || previewActive) && (
            <span
              aria-hidden="true"
              className="absolute right-1.5 top-1 h-1.5 w-1.5 rounded-full bg-amber-400"
            />
          )}
        </button>

        <button
          type="button"
          data-testid="tab-lighting"
          onClick={() => setInspectorTab("lighting")}
          className={`relative flex flex-col items-center justify-center gap-0.5 rounded py-1.5 text-[10px] font-medium transition-colors cursor-pointer ${
            inspectorTab === "lighting"
              ? "bg-[#222631] text-amber-300 shadow-sm"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <Sun className="h-3.5 w-3.5" />
          <span>Sáng</span>
          {lightingEnabled && (
            <span
              aria-hidden="true"
              className="absolute right-1.5 top-1 h-1.5 w-1.5 rounded-full bg-amber-400"
            />
          )}
        </button>

        <button
          type="button"
          data-testid="tab-layers"
          onClick={() => setInspectorTab("layers")}
          className={`flex flex-col items-center justify-center gap-0.5 rounded py-1.5 text-[10px] font-medium transition-colors cursor-pointer ${
            inspectorTab === "layers"
              ? "bg-[#222631] text-amber-300 shadow-sm"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <Layers className="h-3.5 w-3.5" />
          <span>Lớp ({layerCount})</span>
        </button>

        <button
          type="button"
          data-testid="tab-context"
          onClick={() => setInspectorTab("context")}
          className={`relative flex flex-col items-center justify-center gap-0.5 rounded py-1.5 text-[10px] font-medium transition-colors cursor-pointer ${
            inspectorTab === "context"
              ? "bg-[#222631] text-amber-300 shadow-sm"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <Compass className="h-3.5 w-3.5" />
          <span>Loại</span>
          {assetTypeId !== "custom" && (
            <span
              aria-hidden="true"
              className="absolute right-1.5 top-1 h-1.5 w-1.5 rounded-full bg-amber-400"
            />
          )}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3.5">
        {inspectorTab === "colors" && <ColorPanel />}
        {inspectorTab === "fill" && <SmartFillPanel />}
        {inspectorTab === "lighting" && <LightingPanel />}
        {inspectorTab === "layers" && <LayerPanel />}
        {inspectorTab === "context" && <ContextPanel />}
      </div>
    </aside>
  );
}
