"use client";

import React, { createContext, useContext, useEffect, useRef } from "react";
import { EditorApplicationService } from "@/services/EditorApplicationService";
import { useEditorStore } from "@/stores/editorStore";

const EditorServiceContext = createContext<EditorApplicationService | null>(null);

export function EditorProvider({ children }: { children: React.ReactNode }) {
  const serviceRef = useRef<EditorApplicationService | null>(null);

  if (!serviceRef.current) {
    serviceRef.current = new EditorApplicationService({
      onActiveToolChange: (tool) => useEditorStore.getState().setActiveTool(tool),
      onBrushSizeChange: (size) => useEditorStore.getState().setBrushSize(size),
      onPrimaryColorChange: (color) => useEditorStore.getState().setPrimaryColor(color),
      onSecondaryColorChange: (color) => useEditorStore.getState().setSecondaryColor(color),
      onRecentColorRecorded: (color) => useEditorStore.getState().recordRecentColor(color),
      onZoomChange: (zoom) => useEditorStore.getState().setZoom(zoom),
      onShowGridChange: (show) => useEditorStore.getState().setShowGrid(show),
      onCursorPixelChange: (pixel) => useEditorStore.getState().setCursorPixel(pixel),
      onDocumentMetaChange: (meta) => useEditorStore.getState().setDocumentMeta(meta),
    });
  }

  useEffect(() => {
    const service = serviceRef.current;
    if (!service) return;
    useEditorStore.getState().setDocumentMeta(service.getDocumentMeta());
    return () => {
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
