import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RGBA } from "../theme/color";
import { THEME_TOKENS, type ThemeToken } from "../theme/tokens";
import { CUSTOM_THEME_ID, ThemeProvider, useTheme } from "./ThemeProvider";

const DARK_BACKGROUND: RGBA = { r: 33, g: 33, b: 33, a: 1 };
const LIGHT_BACKGROUND: RGBA = { r: 240, g: 240, b: 240, a: 1 };

function palette(background: RGBA): Record<ThemeToken, RGBA> {
  const colors = {} as Record<ThemeToken, RGBA>;
  for (const token of THEME_TOKENS)
    colors[token] = { r: 10, g: 20, b: 30, a: 1 };
  colors["bg-primary"] = background;
  return colors;
}

function Probe({ background }: { background: RGBA }): React.JSX.Element {
  const { theme, resolved, resolvedAppearance, setTheme, applyCustomPalette } =
    useTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="resolved">{resolved}</span>
      <span data-testid="appearance">{resolvedAppearance}</span>
      <button onClick={() => applyCustomPalette(palette(background))}>
        apply
      </button>
      <button onClick={() => setTheme("light")}>light</button>
    </div>
  );
}

function renderProbe(background: RGBA): void {
  render(
    <ThemeProvider>
      <Probe background={background} />
    </ThemeProvider>,
  );
}

function inline(token: ThemeToken): string {
  return document.documentElement.style.getPropertyValue(`--${token}`);
}

describe("ThemeProvider custom palettes", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.removeAttribute("style");
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockReturnValue({
        matches: false,
        addEventListener: () => {},
        removeEventListener: () => {},
      }),
    });
  });

  it("applies every token inline and selects the custom id", () => {
    renderProbe(DARK_BACKGROUND);
    fireEvent.click(screen.getByText("apply"));

    expect(document.documentElement.getAttribute("data-theme")).toBe(
      CUSTOM_THEME_ID,
    );
    expect(screen.getByTestId("resolved")).toHaveTextContent(CUSTOM_THEME_ID);
    for (const token of THEME_TOKENS) {
      expect(inline(token)).not.toBe("");
    }
    expect(inline("bg-primary")).toBe("rgba(33, 33, 33, 1)");
  });

  it("removes the inline tokens when a built-in theme is selected", () => {
    renderProbe(DARK_BACKGROUND);
    fireEvent.click(screen.getByText("apply"));
    fireEvent.click(screen.getByText("light"));

    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    for (const token of THEME_TOKENS) {
      expect(inline(token)).toBe("");
    }
    expect(localStorage.getItem("hermes-theme")).toBe("light");
  });

  it("never persists the custom id", () => {
    renderProbe(DARK_BACKGROUND);
    fireEvent.click(screen.getByText("apply"));

    expect(localStorage.getItem("hermes-theme")).toBeNull();
  });

  it("derives the appearance from the palette background", () => {
    renderProbe(LIGHT_BACKGROUND);
    fireEvent.click(screen.getByText("apply"));

    expect(screen.getByTestId("appearance")).toHaveTextContent("light");
  });

  it("keeps a dark appearance for a dark palette", () => {
    renderProbe(DARK_BACKGROUND);
    fireEvent.click(screen.getByText("apply"));

    expect(screen.getByTestId("appearance")).toHaveTextContent("dark");
  });
});
