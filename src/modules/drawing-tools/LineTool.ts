import type { Point } from "@/types/editor";
import { getLinePoints } from "@/core/image-processing/shapes";
import { ShapeToolBase } from "@/modules/drawing-tools/ShapeToolBase";

export class LineTool extends ShapeToolBase {
  readonly id = "line" as const;
  readonly label = "Line";
  readonly shortcut = "L";

  protected override supportsFillMode(): boolean {
    return false;
  }

  protected computeShapePoints(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    _filled: boolean,
    constrain: boolean,
  ): Point[] {
    return getLinePoints(x0, y0, x1, y1, constrain);
  }

  protected getCommandName(): string {
    return "Line";
  }
}
