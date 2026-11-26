"use client";

import React from "react";
import { Keyboard } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SHORTCUT_GROUPS = [
  {
    title: "Drawing & Selection Tools",
    items: [
      ["P", "Pencil"],
      ["E", "Eraser"],
      ["B", "Bucket / Smart Fill"],
      ["I", "Color Picker (Eyedropper)"],
      ["L", "Line (Shift: 45° snap)"],
      ["U", "Rectangle (Shift: Square)"],
      ["O", "Ellipse (Shift: Circle)"],
      ["M", "Rectangular Select"],
      ["V", "Move Layer / Selection"],
    ],
  },
  {
    title: "Brush, Color & View",
    items: [
      ["[ / ]", "Decrease / Increase Brush Size"],
      ["X", "Swap Primary & Secondary Colors"],
      ["Right-click", "Draw / Pick Secondary Color"],
      ["G", "Toggle Pixel Grid"],
      ["Space + Drag", "Pan Canvas (or Middle-click)"],
      ["Wheel / + / -", "Zoom In / Out"],
      ["0", "Fit Canvas to Viewport"],
    ],
  },
  {
    title: "Edit, History & Animation",
    items: [
      ["Ctrl + Z", "Undo"],
      ["Ctrl + Shift + Z / Y", "Redo"],
      ["Ctrl + C / X / V", "Copy / Cut / Paste Selection"],
      ["Ctrl + A / D", "Select All / Deselect"],
      ["Delete / Backspace", "Clear Selected Pixels"],
      [", / .", "Previous / Next Frame"],
      ["Enter / Esc", "Apply / Cancel Smart Fill Preview"],
      ["?", "Open Keyboard Shortcuts"],
    ],
  },
] as const;

export function ShortcutsDialog({ open, onOpenChange }: ShortcutsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="shortcuts-dialog" className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-4 w-4 text-amber-400" />
            <span>Keyboard Shortcuts</span>
          </DialogTitle>
          <DialogDescription>
            Quick reference for drawing, navigation, animation, and preview controls.
          </DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[65vh] gap-4 overflow-y-auto pr-1 sm:grid-cols-2">
          {SHORTCUT_GROUPS.map((group) => (
            <section
              key={group.title}
              className="rounded-md border border-white/8 bg-[#12141a] p-3 last:sm:col-span-2"
            >
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-amber-300">
                {group.title}
              </h3>
              <dl className="flex flex-col gap-1.5">
                {group.items.map(([keys, desc]) => (
                  <div
                    key={keys}
                    className="flex items-center justify-between gap-2 text-xs"
                  >
                    <dt className="text-zinc-300">{desc}</dt>
                    <dd className="shrink-0 rounded border border-white/12 bg-[#1c1f27] px-1.5 py-0.5 font-mono text-[10px] text-zinc-200">
                      {keys}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
