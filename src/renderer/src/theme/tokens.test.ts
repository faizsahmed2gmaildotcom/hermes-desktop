import { describe, expect, it } from "vitest";
import { contrastRatio, parseHex, rgbaToHsva, type HSVA } from "./color";
import {
  ALPHA_TOKENS,
  SEED_TOKENS,
  THEME_TOKENS,
  createInitialTokenState,
  resolvePalette,
  resolveToken,
  tokenLabel,
  type ThemeToken,
  type TokenState,
  type TokenStates,
} from "./tokens";

function hsva(hex: string, alpha = 1): HSVA {
  const rgba = parseHex(hex);
  if (!rgba) throw new Error(`Bad fixture: ${hex}`);
  return rgbaToHsva({ ...rgba, a: alpha });
}

function states(
  entries: Partial<Record<ThemeToken, TokenState>> = {},
): Map<ThemeToken, TokenState> {
  const map = new Map<ThemeToken, TokenState>();
  for (const token of SEED_TOKENS) {
    map.set(token, { auto: false, manual: hsva("#000000") });
  }
  for (const [token, state] of Object.entries(entries)) {
    if (state) map.set(token as ThemeToken, state);
  }
  return map;
}

function darkStates(
  entries: Partial<Record<ThemeToken, TokenState>> = {},
): Map<ThemeToken, TokenState> {
  const map = states(entries);
  map.set("bg-primary", { auto: false, manual: hsva("#212121") });
  map.set("bg-secondary", { auto: false, manual: hsva("#171717") });
  map.set("accent", { auto: false, manual: hsva("#003F7A") });
  return map;
}

function lightStates(): Map<ThemeToken, TokenState> {
  const map = states();
  map.set("bg-primary", { auto: false, manual: hsva("#FFFFFF") });
  map.set("bg-secondary", { auto: false, manual: hsva("#F8F8F8") });
  map.set("accent", { auto: false, manual: hsva("#003F7A") });
  return map;
}

describe("theme token registry", () => {
  it("keeps all 31 main.css tokens with labels", () => {
    expect(THEME_TOKENS).toHaveLength(31);
    expect(new Set(THEME_TOKENS).size).toBe(31);
    expect(tokenLabel("bg-primary")).toBe("App background");
    expect(tokenLabel("selection")).toBe("Selection");
  });

  it("marks the seven tint tokens", () => {
    expect([...ALPHA_TOKENS].sort()).toEqual(
      [
        "accent-subtle",
        "border",
        "border-bright",
        "error-bg",
        "selection",
        "success-bg",
        "warning-bg",
      ].sort(),
    );
  });

  it("creates the right initial auto state per token", () => {
    const map = darkStates();
    expect(createInitialTokenState("bg-tertiary", map).auto).toBe(true);
    expect(createInitialTokenState("success", map)).toMatchObject({
      auto: false,
    });
    expect(createInitialTokenState("border", map).auto).toBe(true);
  });
});

describe("auto-set derivation", () => {
  it("derives the dark palette from the three seeds", () => {
    const { appearance, colors } = resolvePalette(darkStates());
    expect(appearance).toBe("dark");
    expect(colors["bg-tertiary"].r).toBeCloseTo(33 + (236 - 33) * 0.07, 4);
    expect(colors["bg-elevated"]).toEqual(colors["bg-tertiary"]);
    expect(colors["text-primary"]).toEqual({ r: 236, g: 236, b: 236, a: 1 });
    expect(colors["border"].a).toBeCloseTo(0.06);
    expect(colors["border-bright"].a).toBeCloseTo(0.11);
    expect(colors["accent-subtle"].a).toBeCloseTo(0.15);
    expect(colors["selection"].a).toBeCloseTo(0.7);
  });

  it("switches to the light branch when the seed background is light", () => {
    const { appearance, colors } = resolvePalette(lightStates());
    expect(appearance).toBe("light");
    expect(colors["text-primary"]).toEqual({ r: 17, g: 17, b: 17, a: 1 });
    expect(colors["border"].a).toBe(1);
    expect(colors["border-bright"].a).toBe(1);
    expect(colors["accent-subtle"].a).toBeCloseTo(0.08);
    expect(colors["selection"].a).toBeCloseTo(0.3);
    expect(colors["accent-hover"].b).toBeLessThan(colors.accent.b);
  });

  it("keeps accent text readable against the background", () => {
    for (const map of [darkStates(), lightStates()]) {
      const { colors } = resolvePalette(map);
      expect(
        contrastRatio(colors["accent-text"], colors["bg-primary"]),
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("picks the higher-contrast user bubble text", () => {
    const { colors } = resolvePalette(darkStates());
    expect(
      contrastRatio(colors["user-bubble-text"], colors["user-bubble"]),
    ).toBeGreaterThanOrEqual(
      contrastRatio(colors["bg-primary"], colors["user-bubble"]),
    );
  });

  it("propagates manual overrides to derived children", () => {
    const base = resolvePalette(darkStates());
    const overridden = resolvePalette(
      darkStates({
        "text-primary": { auto: false, manual: hsva("#FF0000") },
      }),
    );
    expect(overridden.colors["text-secondary"]).not.toEqual(
      base.colors["text-secondary"],
    );
    expect(overridden.colors["text-secondary"].r).toBeGreaterThan(
      overridden.colors["bg-primary"].r,
    );
    expect(overridden.colors["agent-bubble-text"]).toEqual(
      overridden.colors["text-primary"],
    );
  });

  it("defaults status colours and tints them with the accent", () => {
    const off = resolvePalette(darkStates());
    expect(off.colors.success).toEqual({ r: 34, g: 197, b: 94, a: 1 });
    expect(off.colors.error).toEqual({ r: 239, g: 68, b: 68, a: 1 });
    expect(off.colors.warning).toEqual({ r: 245, g: 158, b: 11, a: 1 });

    const on = resolvePalette(
      darkStates({
        success: { auto: true, manual: hsva("#22C55E") },
        error: { auto: true, manual: hsva("#EF4444") },
        warning: { auto: true, manual: hsva("#F59E0B") },
      }),
    );
    expect(on.colors.success).not.toEqual(off.colors.success);
    expect(on.colors.error).not.toEqual(off.colors.error);
    expect(on.colors.warning).not.toEqual(off.colors.warning);
    expect(on.colors.success.b).toBeGreaterThan(off.colors.success.b);
  });

  it("derives status backgrounds from their foreground", () => {
    const { colors } = resolvePalette(darkStates());
    expect(colors["success-bg"]).toMatchObject({
      r: colors.success.r,
      g: colors.success.g,
      b: colors.success.b,
    });
    expect(colors["success-bg"].a).toBeCloseTo(0.14);
    expect(colors["error-bg"].a).toBeCloseTo(0.12);
    expect(colors["warning-bg"].a).toBeCloseTo(0.14);
  });

  it("makes primary yellow follow warning, including manual edits", () => {
    const { colors } = resolvePalette(
      darkStates({
        warning: { auto: false, manual: hsva("#123456") },
      }),
    );
    expect(colors["primary-yellow"]).toEqual(colors.warning);
  });

  it("keeps structural aliases in step", () => {
    const { colors } = resolvePalette(darkStates());
    expect(colors["code-bg"]).toEqual(colors["bg-secondary"]);
    expect(colors["agent-bubble"]).toEqual(colors["bg-tertiary"]);
    expect(colors["scrollbar-thumb"]).toEqual(colors["bg-active"]);
    expect(colors["scrollbar-hover"]).toEqual(colors["text-muted"]);
    expect(colors["border-focus"]).toEqual(colors.accent);
    expect(colors["user-bubble"]).toEqual(colors.accent);
  });

  it("forces opacity on tokens without alpha", () => {
    const map = darkStates({
      accent: { auto: false, manual: hsva("#003F7A", 0.25) },
      border: { auto: false, manual: hsva("#FFFFFF", 0.2) },
    });
    const { colors } = resolvePalette(map);
    expect(colors.accent.a).toBe(1);
    expect(colors.border.a).toBeCloseTo(0.2);
  });

  it("supports the single-token resolver", () => {
    const map: TokenStates = darkStates();
    expect(resolveToken("bg-primary", map)).toEqual({
      r: 33,
      g: 33,
      b: 33,
      a: 1,
    });
  });
});
