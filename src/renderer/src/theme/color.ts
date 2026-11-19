/**
 * Colour maths for the Theme Creator.
 *
 * The picker's canonical state is HSVA. RGB/hex are derived for display and
 * converted back only when a field changes, so hue and saturation survive a
 * brightness or RGB edit.
 */

export interface RGBA {
  /** 0–255 */
  r: number;
  /** 0–255 */
  g: number;
  /** 0–255 */
  b: number;
  /** 0–1 */
  a: number;
}

export interface HSVA {
  /** 0–360 */
  h: number;
  /** 0–1 */
  s: number;
  /** 0–255 */
  v: number;
  /** 0–1 */
  a: number;
}

export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function normalizeHue(hue: number): number {
  const wrapped = hue % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}

/** Clamp every channel to its legal range without changing the colour type. */
export function clampHsva(hsva: HSVA): HSVA {
  return {
    h: normalizeHue(hsva.h),
    s: clamp(hsva.s, 0, 1),
    v: clamp(hsva.v, 0, 255),
    a: clamp(hsva.a, 0, 1),
  };
}

/** HSV (V in 0–255) to rounded sRGB channels. */
export function hsvToRgb(
  h: number,
  s: number,
  v: number,
): { r: number; g: number; b: number } {
  const hue = normalizeHue(h);
  const saturation = clamp(s, 0, 1);
  const value = clamp(v, 0, 255);
  const chroma = (value / 255) * saturation;
  const section = hue / 60;
  const x = chroma * (1 - Math.abs((section % 2) - 1));
  const m = value / 255 - chroma;

  let r = 0;
  let g = 0;
  let b = 0;
  if (section >= 0 && section < 1) [r, g, b] = [chroma, x, 0];
  else if (section < 2) [r, g, b] = [x, chroma, 0];
  else if (section < 3) [r, g, b] = [0, chroma, x];
  else if (section < 4) [r, g, b] = [0, x, chroma];
  else if (section < 5) [r, g, b] = [x, 0, chroma];
  else [r, g, b] = [chroma, 0, x];

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

/**
 * sRGB to HSV. `previous` keeps the old hue/saturation for greys and black,
 * where hue is mathematically undefined but the picker should not jump.
 */
export function rgbToHsv(
  r: number,
  g: number,
  b: number,
  previous?: Pick<HSVA, "h" | "s">,
): { h: number; s: number; v: number } {
  const red = clamp(r, 0, 255) / 255;
  const green = clamp(g, 0, 255) / 255;
  const blue = clamp(b, 0, 255) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;

  let hue = previous?.h ?? 0;
  if (delta !== 0) {
    if (max === red) hue = ((green - blue) / delta) % 6;
    else if (max === green) hue = (blue - red) / delta + 2;
    else hue = (red - green) / delta + 4;
    hue *= 60;
    hue = normalizeHue(hue);
  }

  const saturation = max === 0 ? (previous?.s ?? 0) : delta / max;
  return { h: hue, s: clamp(saturation, 0, 1), v: max * 255 };
}

export function hsvaToRgba(hsva: HSVA): RGBA {
  const { r, g, b } = hsvToRgb(hsva.h, hsva.s, hsva.v);
  return { r, g, b, a: clamp(hsva.a, 0, 1) };
}

export function rgbaToHsva(rgba: RGBA, previous?: HSVA): HSVA {
  const { h, s, v } = rgbToHsv(rgba.r, rgba.g, rgba.b, previous);
  return { h, s, v, a: clamp(rgba.a, 0, 1) };
}

/** Strict six-digit parse; returns null for anything else. */
export function parseHex(value: string): RGBA | null {
  const digits = value.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(digits)) return null;
  return {
    r: parseInt(digits.slice(0, 2), 16),
    g: parseInt(digits.slice(2, 4), 16),
    b: parseInt(digits.slice(4, 6), 16),
    a: 1,
  };
}

function channelHex(channel: number): string {
  return Math.round(clamp(channel, 0, 255))
    .toString(16)
    .padStart(2, "0")
    .toUpperCase();
}

/** Six uppercase digits without the leading `#`. */
export function rgbaToHexDigits(rgba: RGBA): string {
  return `${channelHex(rgba.r)}${channelHex(rgba.g)}${channelHex(rgba.b)}`;
}

/** Uppercase `#RRGGBB`; alpha lives in its own control. */
export function rgbaToHex(rgba: RGBA): string {
  return `#${rgbaToHexDigits(rgba)}`;
}

/** Linear sRGB interpolation, matching `color-mix(in srgb)` closely enough. */
export function mix(a: RGBA, b: RGBA, amount: number): RGBA {
  const t = clamp(amount, 0, 1);
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
    a: a.a + (b.a - a.a) * t,
  };
}

export function withAlpha(color: RGBA, alpha: number): RGBA {
  return { ...color, a: clamp(alpha, 0, 1) };
}

export function forceOpaque(color: RGBA): RGBA {
  return { ...color, a: 1 };
}

/** WCAG relative luminance, 0 (black) – 1 (white). */
export function relativeLuminance(color: RGBA): number {
  const linear = (channel: number): number => {
    const value = clamp(channel, 0, 255) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * linear(color.r) +
    0.7152 * linear(color.g) +
    0.0722 * linear(color.b)
  );
}

/** WCAG contrast ratio, 1–21. */
export function contrastRatio(a: RGBA, b: RGBA): number {
  const lighter = Math.max(relativeLuminance(a), relativeLuminance(b));
  const darker = Math.min(relativeLuminance(a), relativeLuminance(b));
  return (lighter + 0.05) / (darker + 0.05);
}

/** Perceived brightness used to infer the theme's light/dark appearance. */
export function perceivedLuminance(color: RGBA): number {
  return 0.299 * color.r + 0.587 * color.g + 0.114 * color.b;
}

export function isLightColor(color: RGBA): boolean {
  return perceivedLuminance(color) >= 128;
}

/**
 * Pointer position inside a square wheel to hue/saturation.
 * CSS conic gradients start at the top and move clockwise; the wheel uses
 * `from 90deg`, so hue 0 (red) sits at the right edge.
 */
export function wheelPositionToHs(
  x: number,
  y: number,
  size: number,
  previousHue: number,
): { h: number; s: number } {
  const radius = size / 2;
  if (radius <= 0) return { h: normalizeHue(previousHue), s: 0 };
  const dx = x - radius;
  const dy = y - radius;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const saturation = clamp(distance / radius, 0, 1);
  const hue =
    distance < 0.5
      ? normalizeHue(previousHue)
      : normalizeHue((Math.atan2(dy, dx) * 180) / Math.PI);
  return { h: hue, s: saturation };
}

/** Hue/saturation to a position inside the wheel, as percentages of its box. */
export function wheelHsToPosition(
  hue: number,
  saturation: number,
): { x: number; y: number } {
  const radians = (normalizeHue(hue) * Math.PI) / 180;
  const radius = clamp(saturation, 0, 1);
  return {
    x: 50 + Math.cos(radians) * radius * 50,
    y: 50 + Math.sin(radians) * radius * 50,
  };
}

/** CSS stops for the wheel at full brightness (HSV V = 255). */
export const WHEEL_GRADIENT =
  "conic-gradient(from 90deg, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)";
