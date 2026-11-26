import { describe, expect, it } from "vitest";
import { EditorApplicationService } from "@/services/EditorApplicationService";
import { packRGBA } from "@/core/image-processing/color";

describe("Dynamic Lighting Studio integration workflow", () => {
  it("keeps original pixels untouched during preview, supports WYSIWYG composite, bakes across all frames with Undo/Redo, and persists in project JSON", () => {
    const service = new EditorApplicationService({}, 16, 16);
    const wood = packRGBA(145, 92, 54, 255);
    const green = packRGBA(72, 148, 82, 255);

    // Frame 0: wooden block
    const f0Layer = service.document.getActiveLayer();
    for (let y = 3; y <= 12; y++) {
      for (let x = 3; x <= 12; x++) {
        f0Layer.buffer.setPacked(x, y, wood);
      }
    }

    // Frame 1: leafy canopy block
    service.addFrame();
    const f1Layer = service.document.getActiveLayer();
    for (let y = 3; y <= 12; y++) {
      for (let x = 3; x <= 12; x++) {
        f1Layer.buffer.setPacked(x, y, green);
      }
    }
    service.selectFrame(0);

    const f0Original = new Uint8ClampedArray(service.document.frames[0]!.layers[0]!.buffer.data);
    const f1Original = new Uint8ClampedArray(service.document.frames[1]!.layers[0]!.buffer.data);

    // Enable lighting & sync from Tree context
    service.setAssetType("tree");
    service.syncLightingFromAssetContext();
    expect(service.getLightingConfig().enabled).toBe(true);

    // Original layer pixel buffers MUST stay 100% immutable while live lighting is active
    expect(Array.from(service.document.frames[0]!.layers[0]!.buffer.data)).toEqual(
      Array.from(f0Original),
    );
    expect(Array.from(service.document.frames[1]!.layers[0]!.buffer.data)).toEqual(
      Array.from(f1Original),
    );

    // Composited output applies live lighting ONLY to the active frame by default
    const litFrame0 = service.getCompositedFrameBuffer(0)!;
    const unlitFrame1 = service.getCompositedFrameBuffer(1)!;
    expect(Array.from(litFrame0.data)).not.toEqual(Array.from(f0Original));
    expect(Array.from(unlitFrame1.data)).toEqual(Array.from(f1Original));

    // Explicit includeLighting (e.g. animation playback / all-frame export) lights inactive frames on demand
    const explicitlyLitFrame1 = service.getCompositedFrameBuffer(1, { includeLighting: true })!;
    expect(Array.from(explicitlyLitFrame1.data)).not.toEqual(Array.from(f1Original));

    // Tuning lighting bumps lightingRevision without bumping per-frame content revisions
    const metaBeforeTune = service.getDocumentMeta();
    service.setLightingConfig({ intensity: 1.2 });
    const metaAfterTune = service.getDocumentMeta();
    expect(metaAfterTune.lightingRevision).toBeGreaterThan(metaBeforeTune.lightingRevision);
    expect(metaAfterTune.frames[0]!.revision).toBe(metaBeforeTune.frames[0]!.revision);
    expect(metaAfterTune.frames[1]!.revision).toBe(metaBeforeTune.frames[1]!.revision);

    // Switching active frame transfers live lighting to the newly selected frame; previous frame loses lighting
    service.selectFrame(1);
    expect(Array.from(service.getCompositedFrameBuffer(0)!.data)).toEqual(Array.from(f0Original));
    expect(Array.from(service.getCompositedFrameBuffer(1)!.data)).not.toEqual(
      Array.from(f1Original),
    );
    service.selectFrame(0);

    // Project serialization preserves lighting settings cleanly
    const exported = service.exportSerializedProject();
    expect(exported.lighting?.enabled).toBe(true);

    const restored = new EditorApplicationService({}, 8, 8);
    restored.loadSerializedProject(JSON.parse(JSON.stringify(exported)));
    expect(restored.getLightingConfig().enabled).toBe(true);
    expect(restored.getLightingConfig().intensity).toBe(service.getLightingConfig().intensity);

    // Bake across All Frames -> commits permanently, disables live lighting, and supports full Undo!
    expect(service.applyLightingBake("all-frames")).toBe(true);
    expect(service.getLightingConfig().enabled).toBe(false);
    expect(Array.from(service.document.frames[0]!.layers[0]!.buffer.data)).not.toEqual(
      Array.from(f0Original),
    );
    expect(Array.from(service.document.frames[1]!.layers[0]!.buffer.data)).not.toEqual(
      Array.from(f1Original),
    );

    // Single Undo restores BOTH frames back to exact original pre-bake pixels
    expect(service.undo()).toBe(true);
    expect(Array.from(service.document.frames[0]!.layers[0]!.buffer.data)).toEqual(
      Array.from(f0Original),
    );
    expect(Array.from(service.document.frames[1]!.layers[0]!.buffer.data)).toEqual(
      Array.from(f1Original),
    );

    service.dispose();
    restored.dispose();
  });
});
