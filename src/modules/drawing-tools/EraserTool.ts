import type { RGBA } from "@/types/editor";
import type { IToolContext, PointerInputEvent } from "@/core/contracts";
import { TRANSPARENT_PACKED } from "@/core/image-processing/color";
import { StrokeToolBase } from "@/modules/drawing-tools/StrokeToolBase";

export class EraserTool extends StrokeToolBase {
  readonly id = "eraser" as const;
  readonly label = "Eraser";
  readonly shortcut = "E";
  readonly cursor = "crosshair";

  protected resolveStrokeColor(
    _event: PointerInputEvent,
    _ctx: IToolContext,
  ): { packed: number; rgba: RGBA | null } {
    return { packed: TRANSPARENT_PACKED, rgba: null };
  }

  protected getCommandName(): string {
    return "Eraser Stroke";
  }
}
