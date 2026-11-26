import type { Point } from "@/types/editor";
import { getEllipsePoints } from "@/core/image-processing/shapes";
import { ShapeToolBase } from "@/modules/drawing-tools/ShapeToolBase";

export class EllipseTool extends ShapeToolBase {
  readonly id = "ellipse" as const;
  readonly label = "Ellipse";
  readonly shortcut = "O";

  protected computeShapePoints(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    filled: boolean,
    constrain: boolean,
  ): Point[] {
    return getEllipsePoints(x0, y0, x1, y1, filled, constrain);
  }

  protected getCommandName(): string {
    return "Ellipse";
  }
}
