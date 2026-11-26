"use client";

import React, { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Combine,
  Eye,
  EyeOff,
  Layers,
  Lock,
  Plus,
  Trash2,
  Unlock,
} from "lucide-react";
import { useEditorService } from "@/hooks/EditorContext";
import { useEditorStore } from "@/stores/editorStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function LayerPanel() {
  const service = useEditorService();
  const docMeta = useEditorStore((s) => s.documentMeta);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");

  // Display topmost layer first (reverse of bottom-up render order)
  const displayLayers = [...docMeta.layers].reverse();
  const activeLayer = docMeta.layers.find((l) => l.id === docMeta.activeLayerId) ?? docMeta.layers[0];
  const activeBottomIndex = docMeta.layers.findIndex((l) => l.id === docMeta.activeLayerId);
  const visibleCount = docMeta.layers.filter((l) => l.visible).length;

  const commitRename = (layerId: string) => {
    if (draftName.trim()) {
      service.renameLayer(layerId, draftName.trim());
    }
    setEditingId(null);
  };

  return (
    <div data-testid="layer-panel" className="flex flex-col gap-3">
      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Layers className="h-3.5 w-3.5 text-amber-400" />
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            Layers ({docMeta.layers.length})
          </h2>
        </div>

        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="secondary"
                size="icon"
                className="h-6 w-6"
                onClick={() => service.addLayer()}
                aria-label="Add Layer"
                data-testid="add-layer-btn"
              >
                <Plus className="h-3.5 w-3.5 text-amber-400" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Add Layer</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                disabled={activeBottomIndex <= 0}
                onClick={() => activeLayer && service.mergeLayerDown(activeLayer.id)}
                aria-label="Merge Layer Down"
                data-testid="merge-down-btn"
              >
                <ArrowDown className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Merge Active Layer Down</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                disabled={visibleCount <= 1}
                onClick={() => service.mergeVisibleLayers()}
                aria-label="Merge Visible Layers"
                data-testid="merge-visible-btn"
              >
                <Combine className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Merge All Visible Layers</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Active Layer Opacity Slider */}
      {activeLayer && (
        <div className="flex flex-col gap-1 rounded-md border border-white/8 bg-[#12141a] p-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-zinc-400">Opacity</span>
            <span className="font-mono text-zinc-200">
              {Math.round(activeLayer.opacity * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(activeLayer.opacity * 100)}
            onChange={(e) =>
              service.setLayerOpacity(activeLayer.id, Number(e.target.value) / 100)
            }
            aria-label="Active layer opacity"
            data-testid="layer-opacity-slider"
            className="h-1.5 w-full cursor-pointer accent-amber-400"
          />
        </div>
      )}

      {/* Layer Stack */}
      <div className="flex flex-col gap-1" data-testid="layer-list">
        {displayLayers.map((layer) => {
          const bottomIndex = docMeta.layers.findIndex((l) => l.id === layer.id);
          const isActive = layer.id === docMeta.activeLayerId;
          const isEditing = editingId === layer.id;

          return (
            <div
              key={layer.id}
              data-testid={`layer-item-${layer.id}`}
              data-active={isActive}
              onClick={() => service.selectLayer(layer.id)}
              className={`group flex items-center gap-1.5 rounded-md border px-2 py-1.5 transition-colors cursor-pointer ${
                isActive
                  ? "border-amber-400/50 bg-amber-500/12 text-zinc-100"
                  : "border-white/6 bg-[#13151b] text-zinc-300 hover:border-white/15"
              }`}
            >
              {/* Visibility Toggle */}
              <button
                type="button"
                aria-label={layer.visible ? `Hide ${layer.name}` : `Show ${layer.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  service.setLayerVisibility(layer.id, !layer.visible);
                }}
                className={`rounded p-0.5 transition-colors cursor-pointer ${
                  layer.visible ? "text-zinc-300 hover:text-amber-300" : "text-zinc-600 hover:text-zinc-400"
                }`}
              >
                {layer.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              </button>

              {/* Layer Name / Double-click Rename */}
              <div className="min-w-0 flex-1">
                {isEditing ? (
                  <Input
                    autoFocus
                    value={draftName}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setDraftName(e.target.value)}
                    onBlur={() => commitRename(layer.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitRename(layer.id);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    className="h-6 px-1.5 text-xs font-sans"
                  />
                ) : (
                  <span
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setEditingId(layer.id);
                      setDraftName(layer.name);
                    }}
                    title="Double-click to rename"
                    className={`block truncate text-xs ${
                      layer.visible ? "" : "opacity-50 line-through"
                    }`}
                  >
                    {layer.name}
                  </span>
                )}
              </div>

              {/* Lock Toggle */}
              <button
                type="button"
                aria-label={layer.locked ? `Unlock ${layer.name}` : `Lock ${layer.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  service.setLayerLocked(layer.id, !layer.locked);
                }}
                className={`rounded p-0.5 transition-colors cursor-pointer ${
                  layer.locked ? "text-amber-400" : "text-zinc-600 opacity-60 hover:opacity-100"
                }`}
              >
                {layer.locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
              </button>

              {/* Move Up / Down */}
              <div className="flex items-center">
                <button
                  type="button"
                  aria-label={`Move ${layer.name} up`}
                  disabled={bottomIndex >= docMeta.layers.length - 1}
                  onClick={(e) => {
                    e.stopPropagation();
                    service.reorderLayer(bottomIndex, bottomIndex + 1);
                  }}
                  className="rounded p-0.5 text-zinc-400 hover:text-zinc-100 disabled:opacity-25 cursor-pointer"
                >
                  <ArrowUp className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  aria-label={`Move ${layer.name} down`}
                  disabled={bottomIndex <= 0}
                  onClick={(e) => {
                    e.stopPropagation();
                    service.reorderLayer(bottomIndex, bottomIndex - 1);
                  }}
                  className="rounded p-0.5 text-zinc-400 hover:text-zinc-100 disabled:opacity-25 cursor-pointer"
                >
                  <ArrowDown className="h-3 w-3" />
                </button>
              </div>

              {/* Delete Layer */}
              <button
                type="button"
                aria-label={`Delete ${layer.name}`}
                disabled={docMeta.layers.length <= 1}
                onClick={(e) => {
                  e.stopPropagation();
                  service.deleteLayer(layer.id);
                }}
                className="rounded p-0.5 text-zinc-500 hover:text-rose-400 disabled:opacity-20 cursor-pointer"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-zinc-500">
        Double-click any layer name to rename. Layers stay synced across animation frames.
      </p>
    </div>
  );
}
