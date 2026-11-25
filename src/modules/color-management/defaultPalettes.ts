import type { RGBA } from "@/types/editor";
import { hexToRgba } from "@/core/image-processing/color";

/**
 * Curated 24-color starter studio palette covering warm/cool ramps,
 * skin/wood earth tones, foliage greens, sky blues, and crisp ink neutrals.
 */
export const DEFAULT_STUDIO_PALETTE_HEX: readonly string[] = [
  "#14161D",
  "#2F3545",
  "#5D687F",
  "#9BA6BC",
  "#DDE3EE",
  "#FFFFFF",
  "#6B1D2A",
  "#C73848",
  "#F06A5B",
  "#F6A954",
  "#F9DC6D",
  "#FCEFA8",
  "#24472E",
  "#3E7A47",
  "#6DB356",
  "#B6D96B",
  "#1D3D63",
  "#2D6CA8",
  "#4EA8DE",
  "#90E0EF",
  "#43275E",
  "#7B459E",
  "#5C3624",
  "#9C623E",
];

export const DEFAULT_STUDIO_PALETTE: readonly RGBA[] = DEFAULT_STUDIO_PALETTE_HEX.map(
  (hex) => hexToRgba(hex)!,
);
