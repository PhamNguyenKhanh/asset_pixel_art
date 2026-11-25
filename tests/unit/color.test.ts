import { describe, expect, it } from "vitest";
import {
  hexToRgba,
  hsvToRgb,
  packRGBA,
  rgbaToHex,
  rgbToHsv,
  unpackRGBA,
} from "@/core/image-processing/color";

describe("Color utilities", () => {
  it("packs and unpacks RGBA consistently", () => {
    const samples = [
      { r: 0, g: 0, b: 0, a: 0 },
      { r: 255, g: 255, b: 255, a: 255 },
      { r: 245, g: 166, b: 35, a: 255 },
      { r: 18, g: 52, b: 86, a: 120 },
    ];
    for (const s of samples) {
      const packed = packRGBA(s.r, s.g, s.b, s.a);
      expect(unpackRGBA(packed)).toEqual(s);
    }
  });

  it("parses and formats hex colors across 3/4/6/8 digit forms", () => {
    expect(hexToRgba("#f0a")).toEqual({ r: 255, g: 0, b: 170, a: 255 });
    expect(hexToRgba("#f0a8")).toEqual({ r: 255, g: 0, b: 170, a: 136 });
    expect(hexToRgba("#1A2B3C")).toEqual({ r: 26, g: 43, b: 60, a: 255 });
    expect(hexToRgba("1A2B3C80")).toEqual({ r: 26, g: 43, b: 60, a: 128 });
    expect(hexToRgba("not-a-color")).toBeNull();

    expect(rgbaToHex({ r: 26, g: 43, b: 60, a: 255 })).toBe("#1A2B3C");
    expect(rgbaToHex({ r: 26, g: 43, b: 60, a: 128 }, true)).toBe("#1A2B3C80");
  });

  it("converts between RGB and HSV accurately", () => {
    expect(rgbToHsv(255, 0, 0)).toEqual({ h: 0, s: 100, v: 100 });
    expect(rgbToHsv(0, 255, 0)).toEqual({ h: 120, s: 100, v: 100 });
    expect(rgbToHsv(0, 0, 255)).toEqual({ h: 240, s: 100, v: 100 });
    expect(rgbToHsv(128, 128, 128)).toEqual({ h: 0, s: 0, v: 50 });

    expect(hsvToRgb(0, 100, 100)).toEqual({ r: 255, g: 0, b: 0 });
    expect(hsvToRgb(120, 100, 100)).toEqual({ r: 0, g: 255, b: 0 });
    expect(hsvToRgb(240, 100, 100)).toEqual({ r: 0, g: 0, b: 255 });
  });
});
