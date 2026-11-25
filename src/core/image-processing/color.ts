import type { HSV, RGBA } from "@/types/editor";

const IS_LITTLE_ENDIAN = (() => {
  const buffer = new ArrayBuffer(4);
  const view8 = new Uint8Array(buffer);
  const view32 = new Uint32Array(buffer);
  view32[0] = 0x0a0b0c0d;
  return view8[0] === 0x0d;
})();

export function clampByte(value: number): number {
  if (value <= 0) return 0;
  if (value >= 255) return 255;
  return Math.round(value);
}

export function packRGBA(r: number, g: number, b: number, a: number): number {
  const cr = clampByte(r);
  const cg = clampByte(g);
  const cb = clampByte(b);
  const ca = clampByte(a);

  if (IS_LITTLE_ENDIAN) {
    return ((ca << 24) | (cb << 16) | (cg << 8) | cr) >>> 0;
  }
  return ((cr << 24) | (cg << 16) | (cb << 8) | ca) >>> 0;
}

export function packColor(color: RGBA): number {
  return packRGBA(color.r, color.g, color.b, color.a);
}

export function unpackRGBA(packed: number): RGBA {
  const u = packed >>> 0;
  if (IS_LITTLE_ENDIAN) {
    return {
      r: u & 0xff,
      g: (u >>> 8) & 0xff,
      b: (u >>> 16) & 0xff,
      a: (u >>> 24) & 0xff,
    };
  }
  return {
    r: (u >>> 24) & 0xff,
    g: (u >>> 16) & 0xff,
    b: (u >>> 8) & 0xff,
    a: u & 0xff,
  };
}

export const TRANSPARENT_PACKED = packRGBA(0, 0, 0, 0);

export const TRANSPARENT_RGBA: RGBA = { r: 0, g: 0, b: 0, a: 0 };

export function colorsEqual(a: RGBA, b: RGBA): boolean {
  return a.r === b.r && a.g === b.g && a.b === b.b && a.a === b.a;
}

function byteToHex(value: number): string {
  return clampByte(value).toString(16).padStart(2, "0");
}

export function rgbaToHex(color: RGBA, includeAlpha = false): string {
  const base = `#${byteToHex(color.r)}${byteToHex(color.g)}${byteToHex(color.b)}`;
  if (!includeAlpha) {
    return base.toUpperCase();
  }
  return `${base}${byteToHex(color.a)}`.toUpperCase();
}

export function rgbaToCss(color: RGBA): string {
  const alpha = Math.round((clampByte(color.a) / 255) * 1000) / 1000;
  return `rgba(${clampByte(color.r)}, ${clampByte(color.g)}, ${clampByte(color.b)}, ${alpha})`;
}

export function hexToRgba(input: string): RGBA | null {
  const cleaned = input.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(cleaned)) {
    const r = parseInt(cleaned[0]! + cleaned[0]!, 16);
    const g = parseInt(cleaned[1]! + cleaned[1]!, 16);
    const b = parseInt(cleaned[2]! + cleaned[2]!, 16);
    return { r, g, b, a: 255 };
  }
  if (/^[0-9a-fA-F]{4}$/.test(cleaned)) {
    const r = parseInt(cleaned[0]! + cleaned[0]!, 16);
    const g = parseInt(cleaned[1]! + cleaned[1]!, 16);
    const b = parseInt(cleaned[2]! + cleaned[2]!, 16);
    const a = parseInt(cleaned[3]! + cleaned[3]!, 16);
    return { r, g, b, a };
  }
  if (/^[0-9a-fA-F]{6}$/.test(cleaned)) {
    const r = parseInt(cleaned.slice(0, 2), 16);
    const g = parseInt(cleaned.slice(2, 4), 16);
    const b = parseInt(cleaned.slice(4, 6), 16);
    return { r, g, b, a: 255 };
  }
  if (/^[0-9a-fA-F]{8}$/.test(cleaned)) {
    const r = parseInt(cleaned.slice(0, 2), 16);
    const g = parseInt(cleaned.slice(2, 4), 16);
    const b = parseInt(cleaned.slice(4, 6), 16);
    const a = parseInt(cleaned.slice(6, 8), 16);
    return { r, g, b, a };
  }
  return null;
}

export function rgbToHsv(r: number, g: number, b: number): HSV {
  const rn = clampByte(r) / 255;
  const gn = clampByte(g) / 255;
  const bn = clampByte(b) / 255;

  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === rn) {
      h = 60 * (((gn - bn) / delta) % 6);
    } else if (max === gn) {
      h = 60 * ((bn - rn) / delta + 2);
    } else {
      h = 60 * ((rn - gn) / delta + 4);
    }
  }
  if (h < 0) h += 360;

  const s = max === 0 ? 0 : (delta / max) * 100;
  const v = max * 100;

  return {
    h: Math.round(h) % 360,
    s: Math.round(s),
    v: Math.round(v),
  };
}

export function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  const hn = ((h % 360) + 360) % 360;
  const sn = Math.max(0, Math.min(100, s)) / 100;
  const vn = Math.max(0, Math.min(100, v)) / 100;

  const c = vn * sn;
  const x = c * (1 - Math.abs(((hn / 60) % 2) - 1));
  const m = vn - c;

  let rp = 0;
  let gp = 0;
  let bp = 0;

  if (hn < 60) {
    rp = c;
    gp = x;
  } else if (hn < 120) {
    rp = x;
    gp = c;
  } else if (hn < 180) {
    gp = c;
    bp = x;
  } else if (hn < 240) {
    gp = x;
    bp = c;
  } else if (hn < 300) {
    rp = x;
    bp = c;
  } else {
    rp = c;
    bp = x;
  }

  return {
    r: clampByte((rp + m) * 255),
    g: clampByte((gp + m) * 255),
    b: clampByte((bp + m) * 255),
  };
}
