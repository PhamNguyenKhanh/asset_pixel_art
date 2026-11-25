import type { ITool, IToolContext, PointerInputEvent } from "@/core/contracts";

export class EyedropperTool implements ITool {
  readonly id = "eyedropper" as const;
  readonly label = "Color Picker";
  readonly shortcut = "I";
  readonly cursor = "copy";

  private sampling = false;

  onPointerDown(event: PointerInputEvent, ctx: IToolContext): void {
    this.sampling = true;
    this.sample(event, ctx);
  }

  onPointerMove(event: PointerInputEvent, ctx: IToolContext): void {
    if (!this.sampling) return;
    this.sample(event, ctx);
  }

  onPointerUp(_event: PointerInputEvent, _ctx: IToolContext): void {
    this.sampling = false;
  }

  onCancel(): void {
    this.sampling = false;
  }

  private sample(event: PointerInputEvent, ctx: IToolContext): void {
    const layer = ctx.document.getActiveLayer();
    if (!layer.buffer.isInBounds(event.pixelX, event.pixelY)) return;

    const picked = layer.buffer.getPixel(event.pixelX, event.pixelY);
    if (event.button === 2) {
      ctx.setSecondaryColor(picked);
    } else {
      ctx.setPrimaryColor(picked);
    }
    if (picked.a > 0) {
      ctx.recordRecentColor(picked);
    }
  }
}
