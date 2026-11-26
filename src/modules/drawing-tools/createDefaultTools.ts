import type { ToolId } from "@/types/editor";
import type { ITool } from "@/core/contracts";
import { PencilTool } from "@/modules/drawing-tools/PencilTool";
import { EraserTool } from "@/modules/drawing-tools/EraserTool";
import { BucketFillTool } from "@/modules/drawing-tools/BucketFillTool";
import { EyedropperTool } from "@/modules/drawing-tools/EyedropperTool";
import { LineTool } from "@/modules/drawing-tools/LineTool";
import { RectangleTool } from "@/modules/drawing-tools/RectangleTool";
import { EllipseTool } from "@/modules/drawing-tools/EllipseTool";
import { SelectTool } from "@/modules/drawing-tools/SelectTool";
import { MoveTool } from "@/modules/drawing-tools/MoveTool";

export function createDefaultTools(): Record<ToolId, ITool> {
  return {
    pencil: new PencilTool(),
    eraser: new EraserTool(),
    bucket: new BucketFillTool(),
    eyedropper: new EyedropperTool(),
    line: new LineTool(),
    rectangle: new RectangleTool(),
    ellipse: new EllipseTool(),
    select: new SelectTool(),
    move: new MoveTool(),
  };
}
