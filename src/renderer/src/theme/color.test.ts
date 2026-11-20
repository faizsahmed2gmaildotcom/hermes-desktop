import { describe, expect, it } from "vitest";
import {
  clamp,
  clampHsva,
  contrastRatio,
  hsvToRgb,
  isLightColor,
  mix,
  normalizeHue,
  parseHex,
  perceivedLuminance,
  rgbaToCss,
  rgbaToHex,
  rgbaToHexDigits,
  rgbaToHsva,
  rgbToHsv,
  wheelHsToPosition,
  wheelPositionToHs,
  withAlpha,
  type RGBA,
} from "./color";

const white: RGBA = { r: 255, g: 255, b: 255, a: 1 };
const black: RGBA = { r: 0, g: 0, b: 0, a: 1 };
const red: RGBA = { r: 255, g: 0, b: 0, a: 1 };

describe("colour maths", () => {
  it("converts the HSV primaries to RGB", () => {
    expect(hsvToRgb(0, 1, 255)).toEqual({ r: 255, g: 0, b: 0 });
    expect(hsvToRgb(120, 1, 255)).toEqual({ r: 0, g: 255, b: 0 });
    expect(hsvToRgb(240, 1, 255)).toEqual({ r: 0, g: 0, b: 255 });
    expect(hsvToRgb(0, 0, 255)).toEqual({ r: 255, g: 255, b: 255 });
    expect(hsvToRgb(0, 0, 0)).toEqual({ r: 0, g: 0, b: 0 });
  });

  it("round-trips RGB through HSV", () => {
    const hsv = rgbToHsv(0, 63, 122);
    const rgb = hsvToRgb(hsv.h, hsv.s, hsv.v);
    expect(rgb).toEqual({ r: 0, g: 63, b: 122 });
  });

  it("keeps the previous hue for greys and saturation for black", () => {
    const hsv = rgbToHsv(128, 128, 128, { h: 210, s: 0.4 });
    expect(hsv.h).toBe(210);
    expect(hsv.s).toBe(0);

    const blackHsv = rgbToHsv(0, 0, 0, { h: 90, s: 0.8 });
    expect(blackHsv.h).toBe(90);
    expect(blackHsv.s).toBe(0.8);
  });

  it("parses only strict six-digit hex and formats uppercase", () => {
    expect(parseHex("#22c55e")).toEqual({ r: 34, g: 197, b: 94, a: 1 });
    expect(parseHex("22C55E")).toEqual({ r: 34, g: 197, b: 94, a: 1 });
    expect(parseHex("#abc")).toBeNull();
    expect(parseHex("#22c55")).toBeNull();
    expect(parseHex("nope")).toBeNull();
    expect(rgbaToHexDigits(red)).toBe("FF0000");
    expect(rgbaToHex(red)).toBe("#FF0000");
  });

  it("clamps alpha and channels", () => {
    expect(clamp(300, 0, 255)).toBe(255);
    expect(clamp(-2, 0, 255)).toBe(0);
    expect(normalizeHue(-30)).toBe(330);
    expect(normalizeHue(400)).toBe(40);
    expect(clampHsva({ h: -10, s: 2, v: 300, a: -1 })).toEqual({
      h: 350,
      s: 1,
      v: 255,
      a: 0,
    });
    expect(withAlpha(red, 2).a).toBe(1);
  });

  it("mixes in sRGB and reports contrast and brightness", () => {
    expect(mix(black, white, 0.5)).toEqual({
      r: 127.5,
      g: 127.5,
      b: 127.5,
      a: 1,
    });
    expect(contrastRatio(black, white)).toBeCloseTo(21, 5);
    expect(perceivedLuminance(white)).toBe(255);
    expect(isLightColor(white)).toBe(true);
    expect(isLightColor({ r: 33, g: 33, b: 33, a: 1 })).toBe(false);
  });

  it("maps wheel pointer positions to hue/saturation", () => {
    expect(wheelPositionToHs(200, 100, 200, 0)).toEqual({ h: 0, s: 1 });
    expect(wheelPositionToHs(100, 200, 200, 0).h).toBeCloseTo(90);
    expect(wheelPositionToHs(0, 100, 200, 0).h).toBeCloseTo(180);
    expect(wheelPositionToHs(100, 0, 200, 0).h).toBeCloseTo(270);

    const centre = wheelPositionToHs(100, 100, 200, 123);
    expect(centre).toEqual({ h: 123, s: 0 });

    const outside = wheelPositionToHs(260, 100, 200, 0);
    expect(outside.s).toBe(1);
  });

  it("converts HSVA to wheel percentages", () => {
    expect(wheelHsToPosition(0, 1)).toEqual({ x: 100, y: 50 });
    expect(wheelHsToPosition(90, 1).y).toBeCloseTo(100);
    expect(wheelHsToPosition(0, 0)).toEqual({ x: 50, y: 50 });
  });

  it("round-trips RGBA and preserves the previous hue", () => {
    const hsva = rgbaToHsva({ r: 33, g: 33, b: 33, a: 0.4 }, undefined);
    expect(hsva.a).toBe(0.4);
    const preserved = rgbaToHsva({ r: 40, g: 40, b: 40, a: 1 }, hsva);
    expect(preserved.h).toBe(hsva.h);
  });

  it("serialises RGBA to a CSS colour with rounded channels", () => {
    expect(rgbaToCss({ r: 12.4, g: 0, b: 255, a: 1 })).toBe(
      "rgba(12, 0, 255, 1)",
    );
    expect(rgbaToCss({ r: 34, g: 197, b: 94, a: 0.1 })).toBe(
      "rgba(34, 197, 94, 0.1)",
    );
  });
});
