import type { RGBA } from "@/types/editor";
import type { IToolContext, PointerInputEvent } from "@/core/contracts";
import { packColor } from "@/core/image-processing/color";
import { StrokeToolBase } from "@/modules/drawing-tools/StrokeToolBase";

export class PencilTool extends StrokeToolBase {
  readonly id = "pencil" as const;
  readonly label = "Pencil";
  readonly shortcut = "P";
  readonly cursor = "crosshair";

  protected resolveStrokeColor(
    event: PointerInputEvent,
    ctx: IToolContext,
  ): { packed: number; rgba: RGBA | null } {
    const color = event.button === 2 ? ctx.getSecondaryColor() : ctx.getPrimaryColor();
    return { packed: packColor(color), rgba: color };
  }

  protected getCommandName(): string {
    return "Pencil Stroke";
  }

  protected override supportsPixelPerfect(): boolean {
    return true;
  }
}
