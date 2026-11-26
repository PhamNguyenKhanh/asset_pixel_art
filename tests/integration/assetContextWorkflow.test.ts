import { describe, expect, it } from "vitest";
import { EditorApplicationService } from "@/services/EditorApplicationService";
import { deserializeProject } from "@/modules/import-export/projectCodec";

describe("Dynamic Asset Context integration", () => {
  it("never alters existing pixel data when switching asset types or preferred materials", () => {
    const service = new EditorApplicationService({}, 16, 16);
    const layer = service.document.getActiveLayer();
    layer.buffer.setPixel(4, 4, { r: 120, g: 80, b: 40, a: 255 });
    layer.buffer.setPixel(9, 7, { r: 60, g: 180, b: 90, a: 200 });

    const beforeBytes = new Uint8ClampedArray(layer.buffer.data);

    service.setAssetType("tree");
    service.setPreferredMaterial("wood");
    service.setAssetType("character");
    service.setAssetType("building");
    service.setAssetType("weapon");
    service.setAssetType("custom");

    expect(Array.from(layer.buffer.data)).toEqual(Array.from(beforeBytes));
    service.dispose();
  });

  it("applies animation presets non-destructively and supports undo/redo", () => {
    const service = new EditorApplicationService({}, 16, 16);
    service.createNewCanvas(32, 32, "Hero", "character");

    // Draw a marker pixel on frame 0
    service.document.getActiveLayer().buffer.setPixel(5, 5, { r: 255, g: 200, b: 100, a: 255 });

    expect(service.getAssetContextProfile().id).toBe("character");
    expect(service.applyAnimationPreset("char-walk")).toBe(true);
    expect(service.document.frames).toHaveLength(6);
    expect(service.document.fps).toBe(10);
    // Frame 0 pixels remain untouched
    expect(service.document.frames[0]!.layers[0]!.buffer.getPixel(5, 5)).toEqual({
      r: 255,
      g: 200,
      b: 100,
      a: 255,
    });

    // Undo reverts frame count and fps cleanly
    expect(service.undo()).toBe(true);
    expect(service.document.frames).toHaveLength(1);
    service.dispose();
  });

  it("persists asset context in .pxs.json and stays backward compatible with legacy files", () => {
    const service = new EditorApplicationService({}, 16, 16);
    service.setAssetType("building");
    service.setPreferredMaterial("stone");

    const exported = service.exportSerializedProject();
    expect(exported.assetContext).toEqual({
      assetTypeId: "building",
      preferredMaterialId: "stone",
    });

    const fresh = new EditorApplicationService({}, 8, 8);
    fresh.loadSerializedProject(JSON.parse(JSON.stringify(exported)));
    expect(fresh.getAssetContextProfile().id).toBe("building");
    expect(fresh.assetContext.getState().preferredMaterialId).toBe("stone");

    // Legacy file without assetContext falls back gracefully to custom
    const legacyJson = JSON.parse(JSON.stringify(exported));
    delete legacyJson.assetContext;
    const { document } = deserializeProject(legacyJson);
    expect(document.assetContext.assetTypeId).toBe("custom");

    service.dispose();
    fresh.dispose();
  });
});
