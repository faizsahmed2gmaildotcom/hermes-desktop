/**
 * The 31 editable theme tokens and the derivation graph behind Auto-set.
 *
 * Each token keeps a small, independent state: whether Auto-set is on, plus the
 * last manual HSVA. Manual values feed the graph immediately, so painting
 * `--text-primary` also moves every derived text/border token.
 */

import {
  clampHsva,
  contrastRatio,
  hsvaToRgba,
  isLightColor,
  mix,
  rgbaToHsva,
  withAlpha,
  type HSVA,
  type RGBA,
} from "./color";

/** Tokens in the same order they are declared in `main.css`. */
export const THEME_TOKENS = [
  "bg-primary",
  "bg-secondary",
  "bg-tertiary",
  "bg-elevated",
  "bg-hover",
  "bg-active",
  "accent",
  "accent-hover",
  "accent-subtle",
  "accent-text",
  "primary-yellow",
  "text-primary",
  "text-secondary",
  "text-muted",
  "border",
  "border-bright",
  "border-focus",
  "success",
  "success-bg",
  "error",
  "error-bg",
  "warning",
  "warning-bg",
  "user-bubble",
  "user-bubble-text",
  "agent-bubble",
  "agent-bubble-text",
  "code-bg",
  "scrollbar-thumb",
  "scrollbar-hover",
  "selection",
] as const;

export type ThemeToken = (typeof THEME_TOKENS)[number];

export const TOKEN_LABELS: Record<ThemeToken, string> = {
  "bg-primary": "App background",
  "bg-secondary": "Secondary background",
  "bg-tertiary": "Tertiary background",
  "bg-elevated": "Elevated background",
  "bg-hover": "Hover background",
  "bg-active": "Active background",
  accent: "Accent",
  "accent-hover": "Accent hover",
  "accent-subtle": "Accent subtle",
  "accent-text": "Accent text",
  "primary-yellow": "Primary yellow",
  "text-primary": "Primary text",
  "text-secondary": "Secondary text",
  "text-muted": "Muted text",
  border: "Border",
  "border-bright": "Bright border",
  "border-focus": "Focus border",
  success: "Success",
  "success-bg": "Success background",
  error: "Error",
  "error-bg": "Error background",
  warning: "Warning",
  "warning-bg": "Warning background",
  "user-bubble": "User bubble",
  "user-bubble-text": "User bubble text",
  "agent-bubble": "Agent bubble",
  "agent-bubble-text": "Agent bubble text",
  "code-bg": "Code background",
  "scrollbar-thumb": "Scrollbar thumb",
  "scrollbar-hover": "Scrollbar hover",
  selection: "Selection",
};

/** The three roots bound to the simple-mode slots. */
export const SEED_TOKENS = ["bg-primary", "bg-secondary", "accent"] as const;
export type SeedToken = (typeof SEED_TOKENS)[number];

export const ALPHA_TOKENS: ReadonlySet<ThemeToken> = new Set([
  "border",
  "border-bright",
  "accent-subtle",
  "success-bg",
  "error-bg",
  "warning-bg",
  "selection",
]);

/** Tokens without a formula: their Auto-set value is an accent tint. */
export const NO_FORMULA_TOKENS: ReadonlySet<ThemeToken> = new Set([
  "success",
  "error",
  "warning",
]);

export const ACCENT_TINT_AMOUNT = 0.35;

const WHITE: RGBA = { r: 255, g: 255, b: 255, a: 1 };
const BLACK: RGBA = { r: 0, g: 0, b: 0, a: 1 };

const DEFAULT_SEED_HEX: Record<SeedToken, string> = {
  "bg-primary": "#212121",
  "bg-secondary": "#171717",
  accent: "#003f7a",
};

const DEFAULT_SEMANTIC_HEX: Record<"success" | "error" | "warning", string> = {
  success: "#22C55E",
  error: "#EF4444",
  warning: "#F59E0B",
};

function opaque(hex: string): RGBA {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
    a: 1,
  };
}

const DEFAULT_SEEDS = Object.fromEntries(
  Object.entries(DEFAULT_SEED_HEX).map(([token, hex]) => [token, opaque(hex)]),
) as Record<SeedToken, RGBA>;

const DEFAULT_SEMANTIC = Object.fromEntries(
  Object.entries(DEFAULT_SEMANTIC_HEX).map(([token, hex]) => [
    token,
    opaque(hex),
  ]),
) as Record<"success" | "error" | "warning", RGBA>;

export interface TokenState {
  auto: boolean;
  manual: HSVA;
}

export type TokenStates = ReadonlyMap<ThemeToken, TokenState>;

function withoutAlpha(token: ThemeToken, color: RGBA): RGBA {
  return ALPHA_TOKENS.has(token) ? color : { ...color, a: 1 };
}

export function normalizeHsvaForToken(token: ThemeToken, hsva: HSVA): HSVA {
  const clamped = clampHsva(hsva);
  return ALPHA_TOKENS.has(token) ? clamped : { ...clamped, a: 1 };
}

/** Initial state for a token the first time a slot selects it. */
export function createInitialTokenState(
  token: ThemeToken,
  states: TokenStates,
): TokenState {
  if ((SEED_TOKENS as readonly ThemeToken[]).includes(token)) {
    return {
      auto: false,
      manual: rgbaToHsva(DEFAULT_SEEDS[token as SeedToken]),
    };
  }
  if (NO_FORMULA_TOKENS.has(token)) {
    return {
      auto: false,
      manual: rgbaToHsva(
        DEFAULT_SEMANTIC[token as "success" | "error" | "warning"],
      ),
    };
  }
  return {
    auto: true,
    manual: rgbaToHsva(resolveToken(token, states)),
  };
}

export interface ResolvedPalette {
  appearance: "dark" | "light";
  colors: Record<ThemeToken, RGBA>;
}

/**
 * Resolve every token once. Manual states win; Auto-set states derive; missing
 * states fall back to the token's default. Seeds are always manual roots.
 */
export function resolvePalette(states: TokenStates): ResolvedPalette {
  const colors = {} as Record<ThemeToken, RGBA>;
  const resolving = new Set<ThemeToken>();

  const resolve = (token: ThemeToken): RGBA => {
    const cached = colors[token];
    if (cached) return cached;

    // Guard against a malformed graph rather than recursing forever.
    if (resolving.has(token)) {
      return DEFAULT_SEEDS["bg-primary"];
    }
    resolving.add(token);

    const state = states.get(token);
    let color: RGBA;

    if ((SEED_TOKENS as readonly ThemeToken[]).includes(token)) {
      color = state
        ? hsvaToRgba(state.manual)
        : DEFAULT_SEEDS[token as SeedToken];
    } else if (state && !state.auto) {
      color = hsvaToRgba(state.manual);
    } else if (NO_FORMULA_TOKENS.has(token)) {
      const base = DEFAULT_SEMANTIC[token as "success" | "error" | "warning"];
      color = state?.auto
        ? mix(base, resolve("accent"), ACCENT_TINT_AMOUNT)
        : base;
    } else {
      color = derive(token, resolve);
    }

    color = withoutAlpha(token, color);
    colors[token] = color;
    resolving.delete(token);
    return color;
  };

  for (const token of THEME_TOKENS) resolve(token);

  const appearance = isLightColor(colors["bg-primary"]) ? "light" : "dark";
  return { appearance, colors };
}

function derive(token: ThemeToken, resolve: (token: ThemeToken) => RGBA): RGBA {
  switch (token) {
    case "bg-tertiary":
      return mix(resolve("bg-primary"), resolve("text-primary"), 0.07);
    case "bg-elevated":
      return resolve("bg-tertiary");
    case "bg-hover":
      return mix(resolve("bg-primary"), resolve("text-primary"), 0.1);
    case "bg-active":
      return mix(resolve("bg-primary"), resolve("text-primary"), 0.14);
    case "code-bg":
      return resolve("bg-secondary");
    case "text-primary": {
      const light = isLightColor(resolve("bg-primary"));
      return light
        ? { r: 17, g: 17, b: 17, a: 1 }
        : { r: 236, g: 236, b: 236, a: 1 };
    }
    case "text-secondary":
      return mix(resolve("text-primary"), resolve("bg-primary"), 0.22);
    case "text-muted":
      return mix(resolve("text-primary"), resolve("bg-primary"), 0.42);
    case "border-focus":
      return resolve("accent");
    case "accent-hover": {
      const dark = !isLightColor(resolve("bg-primary"));
      return dark
        ? mix(resolve("accent"), WHITE, 0.1)
        : mix(resolve("accent"), BLACK, 0.1);
    }
    case "accent-text": {
      const accent = resolve("accent");
      const background = resolve("bg-primary");
      const textPrimary = resolve("text-primary");
      let candidate = accent;
      for (let amount = 0; amount <= 1.0001; amount += 0.05) {
        candidate = mix(accent, textPrimary, amount);
        if (contrastRatio(candidate, background) >= 4.5) break;
      }
      return candidate;
    }
    case "accent-subtle": {
      const light = isLightColor(resolve("bg-primary"));
      return withAlpha(resolve("accent"), light ? 0.08 : 0.15);
    }
    case "selection": {
      const light = isLightColor(resolve("bg-primary"));
      return withAlpha(resolve("accent-text"), light ? 0.3 : 0.7);
    }
    case "user-bubble":
      return resolve("accent");
    case "user-bubble-text": {
      const bubble = resolve("user-bubble");
      const background = resolve("bg-primary");
      return contrastRatio(WHITE, bubble) >= contrastRatio(background, bubble)
        ? WHITE
        : background;
    }
    case "agent-bubble":
      return resolve("bg-tertiary");
    case "agent-bubble-text":
      return resolve("text-primary");
    case "primary-yellow":
      return resolve("warning");
    case "success-bg": {
      const light = isLightColor(resolve("bg-primary"));
      return withAlpha(resolve("success"), light ? 0.08 : 0.14);
    }
    case "error-bg": {
      const light = isLightColor(resolve("bg-primary"));
      return withAlpha(resolve("error"), light ? 0.06 : 0.12);
    }
    case "warning-bg": {
      const light = isLightColor(resolve("bg-primary"));
      return withAlpha(resolve("warning"), light ? 0.08 : 0.14);
    }
    case "border": {
      const light = isLightColor(resolve("bg-primary"));
      return light
        ? mix(resolve("bg-primary"), resolve("text-primary"), 0.1)
        : withAlpha(resolve("text-primary"), 0.06);
    }
    case "border-bright": {
      const light = isLightColor(resolve("bg-primary"));
      return light
        ? mix(resolve("bg-primary"), resolve("text-primary"), 0.16)
        : withAlpha(resolve("text-primary"), 0.11);
    }
    case "scrollbar-thumb":
      return resolve("bg-active");
    case "scrollbar-hover":
      return resolve("text-muted");
    default:
      // Seeds, no-formula tokens, and any future token without a case.
      return DEFAULT_SEEDS["bg-primary"];
  }
}

export function resolveToken(token: ThemeToken, states: TokenStates): RGBA {
  return resolvePalette(states).colors[token];
}

export function tokenLabel(token: ThemeToken): string {
  return TOKEN_LABELS[token] ?? token.replace(/^--/, "");
}

/** Seeds used by the simple-mode slots and documented in the modal copy. */
export const SEED_DEFAULTS: Record<SeedToken, RGBA> = DEFAULT_SEEDS;
export const SEMANTIC_DEFAULTS: Record<"success" | "error" | "warning", RGBA> =
  DEFAULT_SEMANTIC;
