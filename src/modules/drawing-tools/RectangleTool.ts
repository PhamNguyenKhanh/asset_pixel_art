import type { Point } from "@/types/editor";
import { getRectanglePoints } from "@/core/image-processing/shapes";
import { ShapeToolBase } from "@/modules/drawing-tools/ShapeToolBase";

export class RectangleTool extends ShapeToolBase {
  readonly id = "rectangle" as const;
  readonly label = "Rectangle";
  readonly shortcut = "U";

  protected computeShapePoints(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    filled: boolean,
    constrain: boolean,
  ): Point[] {
    return getRectanglePoints(x0, y0, x1, y1, filled, constrain);
  }

  protected getCommandName(): string {
    return "Rectangle";
  }
}
