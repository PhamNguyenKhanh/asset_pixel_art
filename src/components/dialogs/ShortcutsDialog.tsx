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
    title: "Công cụ vẽ & Chọn vùng",
    items: [
      ["P", "Bút chì"],
      ["E", "Tẩy"],
      ["B", "Đổ màu / Tô thông minh"],
      ["I", "Hút màu"],
      ["L", "Đường thẳng (Giữ Shift: 45°)"],
      ["U", "Hình chữ nhật (Giữ Shift: Vuông)"],
      ["O", "Hình elip (Giữ Shift: Tròn)"],
      ["M", "Chọn vùng chữ nhật"],
      ["V", "Di chuyển lớp / vùng chọn"],
    ],
  },
  {
    title: "Cọ vẽ, Màu sắc & Góc nhìn",
    items: [
      ["[ / ]", "Giảm / Tăng cỡ cọ"],
      ["X", "Đổi màu chính & màu phụ"],
      ["Chuột phải", "Vẽ / Hút màu phụ"],
      ["G", "Bật / tắt lưới pixel"],
      ["Shift + X", "Bật / tắt đối xứng ngang X"],
      ["Shift + Y", "Bật / tắt đối xứng dọc Y"],
      ["Shift + P", "Bật / tắt Pixel-Perfect Stroke (1px)"],
      ["Shift + T", "Bật / tắt Lặp gạch liền mạch 3×3"],
      ["Space + Kéo", "Di chuyển khung nhìn (hoặc Chuột giữa)"],
      ["Cuộn / + / -", "Phóng to / Thu nhỏ"],
      ["0", "Vừa khung nhìn"],
    ],
  },
  {
    title: "Chỉnh sửa, Lịch sử & Hoạt ảnh",
    items: [
      ["Ctrl + Z", "Hoàn tác (Undo)"],
      ["Ctrl + Shift + Z / Y", "Làm lại (Redo)"],
      ["Ctrl + C / X / V", "Sao chép / Cắt / Dán vùng chọn"],
      ["Ctrl + A / D", "Chọn tất cả / Bỏ chọn"],
      ["Delete / Backspace", "Xóa pixel vùng chọn"],
      [", / .", "Khung trước / Khung sau"],
      ["Enter / Esc", "Áp dụng / Hủy xem trước Tô thông minh"],
      ["?", "Mở bảng phím tắt"],
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
            <span>Bảng phím tắt</span>
          </DialogTitle>
          <DialogDescription>
            Tra cứu nhanh phím tắt vẽ, điều hướng, hoạt ảnh và xem trước trong Yui Art Studio.
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
