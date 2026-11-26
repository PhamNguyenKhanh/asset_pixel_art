/**
 * Deterministic PRNG & 2D spatial value noise utilities for Pixel Art algorithms.
 * Pure TypeScript — zero Math.random() usage so every seed is 100% reproducible.
 */

/** Mulberry32 fast deterministic PRNG returning values in [0, 1). */
export function createSeededRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic integer coordinate hash returning [0, 1). */
export function hash2D(ix: number, iy: number, seed: number): number {
  let h = (Math.imul(ix | 0, 374761393) + Math.imul(iy | 0, 668265263) + Math.imul(seed | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967296;
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Smooth 2D value noise in [0, 1]. */
export function valueNoise2D(x: number, y: number, seed: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = smoothstep(x - x0);
  const fy = smoothstep(y - y0);

  const n00 = hash2D(x0, y0, seed);
  const n10 = hash2D(x0 + 1, y0, seed);
  const n01 = hash2D(x0, y0 + 1, seed);
  const n11 = hash2D(x0 + 1, y0 + 1, seed);

  const nx0 = n00 + (n10 - n00) * fx;
  const nx1 = n01 + (n11 - n01) * fx;
  return nx0 + (nx1 - nx0) * fy;
}

/** Multi-octave fractal value noise (fBM) returning normalized value in [0, 1]. */
export function fbm2D(
  x: number,
  y: number,
  seed: number,
  octaves = 2,
  lacunarity = 2.0,
  gain = 0.5,
): number {
  let amplitude = 1;
  let frequency = 1;
  let sum = 0;
  let norm = 0;

  for (let i = 0; i < octaves; i++) {
    sum += valueNoise2D(x * frequency, y * frequency, seed + i * 1013) * amplitude;
    norm += amplitude;
    amplitude *= gain;
    frequency *= lacunarity;
  }

  return norm > 0 ? sum / norm : 0.5;
}

/** Classic 4x4 Bayer ordered dithering threshold matrix normalized to [0, 1). */
const BAYER_4X4 = [
  0, 8, 2, 10,
  12, 4, 14, 6,
  3, 11, 1, 9,
  15, 7, 13, 5,
] as const;

export function bayerThreshold4x4(x: number, y: number): number {
  const bx = ((x % 4) + 4) % 4;
  const by = ((y % 4) + 4) % 4;
  return (BAYER_4X4[by * 4 + bx]! + 0.5) / 16;
}
