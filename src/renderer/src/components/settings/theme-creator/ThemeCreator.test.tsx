import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { ThemeProvider } from "../../ThemeProvider";
import ThemeCreator from "./ThemeCreator";

const translations = vi.hoisted(
  () =>
    ({
      "settings.theme.creator.title": "Theme Creator",
      "settings.theme.creator.simpleMode": "Simple mode",
      "settings.theme.creator.appearance": "Appearance",
      "settings.theme.creator.background": "Background",
      "settings.theme.creator.accent": "Accent",
      "settings.theme.creator.style": "Style",
      "settings.theme.creator.wheel": "Color wheel",
      "settings.theme.creator.brightness": "Brightness",
      "settings.theme.creator.red": "Red",
      "settings.theme.creator.green": "Green",
      "settings.theme.creator.blue": "Blue",
      "settings.theme.creator.alpha": "Alpha",
      "settings.theme.creator.hex": "Hex color",
      "settings.theme.creator.autoSet": "Auto-set",
      "common.close": "Close",
    }) satisfies Record<string, string>,
);

vi.mock("../../useI18n", () => ({
  useI18n: () => ({
    t: (key: string) => translations[key] ?? key,
    locale: "en",
    setLocale: vi.fn(),
  }),
}));

vi.mock("../../modal/AppModal", () => ({
  AppModal: ({
    open,
    onOpenChange,
    children,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    children: ReactNode;
  }) =>
    open ? (
      <div data-testid="creator">
        {children}
        <button type="button" onClick={() => onOpenChange(false)}>
          close
        </button>
      </div>
    ) : null,
  AppModalTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));

function renderCreator(): void {
  render(
    <ThemeProvider>
      <ThemeCreator open onOpenChange={vi.fn()} />
    </ThemeProvider>,
  );
}

function triggers(): HTMLElement[] {
  return screen.getAllByRole("button", { name: /^Style: / });
}

function openPicker(index: number): void {
  fireEvent.click(triggers()[index]);
}

function enableAdvancedMode(): void {
  const toggle = screen.getByRole("switch", { name: "Simple mode" });
  if (toggle.getAttribute("aria-checked") === "true") fireEvent.click(toggle);
}

function selectTarget(index: number, label: string): void {
  enableAdvancedMode();
  openPicker(index);
  fireEvent.click(screen.getByRole("option", { name: label }));
}

function hexFields(): HTMLInputElement[] {
  return screen.getAllByRole("textbox", {
    name: "Hex color",
  }) as HTMLInputElement[];
}

function brightnessFields(): HTMLInputElement[] {
  return screen.getAllByRole("textbox", {
    name: "Brightness",
  }) as HTMLInputElement[];
}

function alphaFields(): HTMLInputElement[] {
  return screen.getAllByRole("textbox", {
    name: "Alpha",
  }) as HTMLInputElement[];
}

describe("Theme Creator", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("style");
    document.documentElement.removeAttribute("data-theme");
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockReturnValue({
        matches: false,
        addEventListener: () => {},
        removeEventListener: () => {},
      }),
    });
    renderCreator();
  });

  it("applies the draft palette to the document while open", () => {
    // @lat: [[theme-creator#Live application]]
    const style = document.documentElement.style;
    expect(document.documentElement.getAttribute("data-theme")).toBe("custom");
    expect(style.getPropertyValue("--bg-primary")).toBe("rgba(33, 33, 33, 1)");

    fireEvent.change(hexFields()[0], { target: { value: "0000FF" } });

    expect(style.getPropertyValue("--bg-primary")).toBe("rgba(0, 0, 255, 1)");
  });

  it("opens in simple mode with three disabled alias pickers", () => {
    // @lat: [[theme-creator#Simple mode]]
    expect(screen.getByText("Theme Creator")).toBeInTheDocument();
    const buttons = triggers();
    expect(buttons).toHaveLength(3);
    expect(buttons[0]).toHaveTextContent("Appearance");
    expect(buttons[1]).toHaveTextContent("Background");
    expect(buttons[2]).toHaveTextContent("Accent");
    for (const button of buttons) expect(button).toBeDisabled();
  });

  it("enables the dropdowns and shows token labels in advanced mode", () => {
    // @lat: [[theme-creator#Simple mode]]
    fireEvent.click(screen.getByRole("switch", { name: "Simple mode" }));
    const buttons = triggers();
    expect(buttons[0]).toHaveTextContent("App background");
    expect(buttons[1]).toHaveTextContent("Secondary background");
    expect(buttons[2]).toHaveTextContent("Accent");
    for (const button of buttons) expect(button).toBeEnabled();
  });

  it("omits all three current targets from every style list", () => {
    // @lat: [[theme-creator#Style assignment]]
    fireEvent.click(screen.getByRole("switch", { name: "Simple mode" }));
    openPicker(0);
    expect(screen.queryByRole("option", { name: "App background" })).toBeNull();
    expect(screen.queryByRole("option", { name: "Accent" })).toBeNull();
    expect(
      screen.queryByRole("option", { name: "Secondary background" }),
    ).toBeNull();
    expect(screen.getByRole("option", { name: "Primary text" })).toBeEnabled();
  });

  it("lists style options in descending alphabetical order", () => {
    // @lat: [[theme-creator#Style assignment]]
    fireEvent.click(screen.getByRole("switch", { name: "Simple mode" }));
    openPicker(0);
    const labels = screen
      .getAllByRole("option")
      .map((option) => option.textContent ?? "");
    const expected = [...labels].sort((a, b) =>
      b.localeCompare(a, undefined, { sensitivity: "base" }),
    );
    expect(labels).toEqual(expected);
  });

  it("enables alpha only for tint tokens", () => {
    // @lat: [[theme-creator#Controls]]
    expect(alphaFields()[0]).toBeDisabled();
    expect(alphaFields()[0]).toHaveValue("1.00");

    selectTarget(0, "Border");
    expect(alphaFields()[0]).toBeDisabled();
    fireEvent.click(screen.getByRole("switch", { name: "Auto-set" }));
    expect(alphaFields()[0]).toBeEnabled();
    expect(alphaFields()[1]).toBeDisabled();

    selectTarget(0, "Primary text");
    expect(alphaFields()[0]).toBeDisabled();
    expect(alphaFields()[0]).toHaveValue("1.00");
  });

  it("starts no-formula tokens manual with their canonical colours", () => {
    // @lat: [[theme-creator#Auto-set]]
    selectTarget(0, "Success");
    expect(hexFields()[0]).toHaveValue("22C55E");
    expect(hexFields()[0]).toBeEnabled();
    expect(screen.getByRole("switch", { name: "Auto-set" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    expect(
      screen.getAllByRole("slider", { name: "Color wheel" })[0],
    ).toHaveAttribute("aria-disabled", "false");
    expect(alphaFields()[0]).toBeDisabled();
  });

  it("derives formula tokens and snapshots the value when Auto-set turns off", () => {
    // @lat: [[theme-creator#Auto-set]]
    selectTarget(0, "Tertiary background");
    const autoSwitch = screen.getByRole("switch", { name: "Auto-set" });
    expect(autoSwitch).toHaveAttribute("aria-checked", "true");
    expect(hexFields()[0]).toBeDisabled();

    fireEvent.click(autoSwitch);
    expect(hexFields()[0]).toBeEnabled();
    expect(hexFields()[0].value).not.toBe("");
  });

  it("remembers each token's manual colour across slot switches", () => {
    // @lat: [[theme-creator#Auto-set]]
    selectTarget(0, "Primary text");
    fireEvent.click(screen.getByRole("switch", { name: "Auto-set" }));
    fireEvent.change(hexFields()[0], { target: { value: "FF0000" } });
    expect(hexFields()[0]).toHaveValue("FF0000");

    selectTarget(0, "Muted text");
    selectTarget(0, "Primary text");

    expect(hexFields()[0]).toHaveValue("FF0000");
    expect(screen.getByRole("switch", { name: "Auto-set" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("overwrites the manual colour when Auto-set turns back on", () => {
    // @lat: [[theme-creator#Auto-set]]
    selectTarget(0, "Primary text");
    fireEvent.click(screen.getByRole("switch", { name: "Auto-set" }));
    fireEvent.change(hexFields()[0], { target: { value: "FF0000" } });
    fireEvent.click(screen.getByRole("switch", { name: "Auto-set" }));

    expect(hexFields()[0]).toBeDisabled();
    expect(hexFields()[0].value).not.toBe("FF0000");
  });

  it("flags invalid fields, reverts malformed hex, and clamps numbers on blur", () => {
    // @lat: [[theme-creator#Controls]]
    const hex = hexFields()[0];
    expect(hex).toHaveValue("212121");
    fireEvent.change(hex, { target: { value: "ZZZZZZ" } });
    expect(hex).toHaveAttribute("aria-invalid", "true");
    fireEvent.blur(hex);
    expect(hex).toHaveValue("212121");
    expect(hex).toHaveAttribute("aria-invalid", "false");

    const brightness = brightnessFields()[0];
    expect(brightness).toHaveValue("33");
    fireEvent.change(brightness, { target: { value: "300" } });
    expect(brightness).toHaveAttribute("aria-invalid", "true");
    fireEvent.blur(brightness);
    expect(brightness).toHaveValue("255");
    expect(brightness).toHaveAttribute("aria-invalid", "false");
  });

  it("uppercases hex while typing and commits live", () => {
    // @lat: [[theme-creator#Controls]]
    const hex = hexFields()[0];
    fireEvent.change(hex, { target: { value: "aabbcc" } });
    expect(hex).toHaveValue("AABBCC");
    fireEvent.change(hex, { target: { value: "AABBCC" } });
    expect(hex).toHaveValue("AABBCC");
  });

  it("adjusts hue from the wheel keyboard", () => {
    // @lat: [[theme-creator#Controls]]
    const wheel = screen.getAllByRole("slider", { name: "Color wheel" })[0];
    expect(wheel).toHaveAttribute("aria-valuenow", "0");
    fireEvent.keyDown(wheel, { key: "ArrowRight" });
    expect(wheel).toHaveAttribute("aria-valuenow", "1");
  });
});
