"use client";

import React, { createContext, useContext, useEffect, useRef } from "react";
import { EditorApplicationService } from "@/services/EditorApplicationService";
import { useEditorStore } from "@/stores/editorStore";
import { loadCustomPalettes, saveCustomPalettes } from "@/modules/color-management/PaletteManager";
import { loadLocalDraft, saveLocalDraft } from "@/lib/localAutosave";

const EditorServiceContext = createContext<EditorApplicationService | null>(null);

export function EditorProvider({ children }: { children: React.ReactNode }) {
  const serviceRef = useRef<EditorApplicationService | null>(null);

  if (!serviceRef.current) {
    serviceRef.current = new EditorApplicationService({
      onActiveToolChange: (tool) => useEditorStore.getState().setActiveTool(tool),
      onBrushSizeChange: (size) => useEditorStore.getState().setBrushSize(size),
      onShapeFillModeChange: (mode) => useEditorStore.getState().setShapeFillMode(mode),
      onSmartFillConfigChange: (config) => useEditorStore.getState().setSmartFillConfig(config),
      onSmartFillPreviewChange: (summary) => useEditorStore.getState().setSmartFillPreview(summary),
      onLightingConfigChange: (config) => useEditorStore.getState().setLightingConfig(config),
      onSurfaceMaskModeChange: (mode) => useEditorStore.getState().setSurfaceMaskMode(mode),
      onPrimaryColorChange: (color) => useEditorStore.getState().setPrimaryColor(color),
      onSecondaryColorChange: (color) => useEditorStore.getState().setSecondaryColor(color),
      onRecentColorRecorded: (color) => useEditorStore.getState().recordRecentColor(color),
      onZoomChange: (zoom) => useEditorStore.getState().setZoom(zoom),
      onShowGridChange: (show) => useEditorStore.getState().setShowGrid(show),
      onCursorPixelChange: (pixel) => useEditorStore.getState().setCursorPixel(pixel),
      onDocumentMetaChange: (meta) => useEditorStore.getState().setDocumentMeta(meta),
      onCustomPalettesLoaded: (palettes) => {
        saveCustomPalettes(palettes);
        useEditorStore.getState().setCustomPalettes(palettes);
      },
    });
  }

  useEffect(() => {
    const service = serviceRef.current;
    if (!service) return;

    useEditorStore.getState().setDocumentMeta(service.getDocumentMeta());
    useEditorStore.getState().setCustomPalettes(loadCustomPalettes());

    let cancelled = false;
    // Restore local IndexedDB draft if present (pure client-side, zero backend)
    void loadLocalDraft().then((draft) => {
      if (cancelled || !draft) return;
      try {
        service.loadSerializedProject(draft);
        useEditorStore.getState().setLastSavedAt(draft.savedAt ?? null);
      } catch {
        // Ignore corrupted draft and keep clean canvas
      }
    });

    // Debounced auto-save whenever document revision increments
    let saveTimer: number | null = null;
    let lastRevision = service.getDocumentMeta().revision;
    const unsubscribe = useEditorStore.subscribe((state) => {
      const nextRevision = state.documentMeta.revision;
      if (nextRevision === lastRevision || nextRevision === 0) return;
      lastRevision = nextRevision;

      if (saveTimer !== null) {
        window.clearTimeout(saveTimer);
      }
      saveTimer = window.setTimeout(() => {
        const serialized = service.exportSerializedProject(
          useEditorStore.getState().customPalettes,
        );
        void saveLocalDraft(serialized).then((ok) => {
          if (ok && !cancelled) {
            useEditorStore.getState().setLastSavedAt(serialized.savedAt);
          }
        });
      }, 900);
    });

    return () => {
      cancelled = true;
      if (saveTimer !== null) {
        window.clearTimeout(saveTimer);
      }
      unsubscribe();
      service.dispose();
    };
  }, []);

  return (
    <EditorServiceContext.Provider value={serviceRef.current}>
      {children}
    </EditorServiceContext.Provider>
  );
}

export function useEditorService(): EditorApplicationService {
  const service = useContext(EditorServiceContext);
  if (!service) {
    throw new Error("useEditorService must be used inside EditorProvider");
  }
  return service;
}
