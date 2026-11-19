import { Toggle } from "../../common/Toggle";
import { SelectMenu, type SelectMenuOption } from "../../common/SelectMenu";
import { useI18n } from "../../useI18n";
import {
  hsvaToRgba,
  hsvToRgb,
  rgbaToHsva,
  type HSVA,
  type RGBA,
} from "../../../theme/color";
import type { ThemeToken } from "../../../theme/tokens";
import { ColorSlider, ColorWheel, HexField, NumberField } from "./controls";

export interface ColorPickerProps {
  target: ThemeToken;
  /** Alias in simple mode, token label in advanced mode. */
  targetLabel: string;
  options: readonly SelectMenuOption[];
  hsva: HSVA;
  onChange: (next: HSVA) => void;
  onTargetChange: (target: ThemeToken) => void;
  targetSelectDisabled: boolean;
  showAutoSet: boolean;
  auto: boolean;
  onAutoChange: (checked: boolean) => void;
  alphaEnabled: boolean;
}

function rgbCss(r: number, g: number, b: number, alpha = 1): string {
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${alpha})`;
}

/** One full picker column: style, wheel, brightness, RGB(A), hex, Auto-set. */
export default function ColorPicker({
  target,
  targetLabel,
  options,
  hsva,
  onChange,
  onTargetChange,
  targetSelectDisabled,
  showAutoSet,
  auto,
  onAutoChange,
  alphaEnabled,
}: ColorPickerProps): React.JSX.Element {
  const { t } = useI18n();
  const rgba = hsvaToRgba(hsva);
  const rgb = hsvToRgb(hsva.h, hsva.s, hsva.v);
  const controlsDisabled = auto;

  const setChannel = (channel: "r" | "g" | "b", value: number): void => {
    const next: RGBA = { ...rgb, [channel]: value, a: hsva.a };
    onChange(rgbaToHsva(next, hsva));
  };

  const brightRgb = hsvToRgb(hsva.h, hsva.s, 255);
  const brightTop = rgbCss(brightRgb.r, brightRgb.g, brightRgb.b);

  return (
    <div className="theme-creator-picker">
      <div className="theme-creator-picker-style">
        <SelectMenu
          value={target}
          triggerLabel={targetLabel}
          label={`${t("settings.theme.creator.style")}: ${targetLabel}`}
          options={options}
          onSelect={(value) => onTargetChange(value as ThemeToken)}
          disabled={targetSelectDisabled}
        />
      </div>

      <ColorWheel
        hsva={hsva}
        onChange={onChange}
        disabled={controlsDisabled}
        label={t("settings.theme.creator.wheel")}
      />

      <div className="theme-creator-brightness">
        <ColorSlider
          orientation="vertical"
          value={Math.round(hsva.v)}
          min={0}
          max={255}
          step={1}
          onChange={(value) => onChange({ ...hsva, v: value })}
          gradient={`linear-gradient(to top, #000000, ${brightTop})`}
          label={t("settings.theme.creator.brightness")}
          disabled={controlsDisabled}
        />
        <NumberField
          value={Math.round(hsva.v)}
          min={0}
          max={255}
          step={1}
          onChange={(value) => onChange({ ...hsva, v: value })}
          label={t("settings.theme.creator.brightness")}
          disabled={controlsDisabled}
        />
      </div>

      <div className="theme-creator-channels">
        <div className="theme-creator-channel">
          <span className="theme-creator-channel-label" aria-hidden="true">
            R
          </span>
          <ColorSlider
            value={rgb.r}
            min={0}
            max={255}
            step={1}
            onChange={(value) => setChannel("r", value)}
            gradient={`linear-gradient(to right, ${rgbCss(0, rgb.g, rgb.b)}, ${rgbCss(255, rgb.g, rgb.b)})`}
            label={t("settings.theme.creator.red")}
            disabled={controlsDisabled}
          />
          <NumberField
            value={rgb.r}
            min={0}
            max={255}
            step={1}
            onChange={(value) => setChannel("r", value)}
            label={t("settings.theme.creator.red")}
            disabled={controlsDisabled}
          />
        </div>

        <div className="theme-creator-channel">
          <span className="theme-creator-channel-label" aria-hidden="true">
            G
          </span>
          <ColorSlider
            value={rgb.g}
            min={0}
            max={255}
            step={1}
            onChange={(value) => setChannel("g", value)}
            gradient={`linear-gradient(to right, ${rgbCss(rgb.r, 0, rgb.b)}, ${rgbCss(rgb.r, 255, rgb.b)})`}
            label={t("settings.theme.creator.green")}
            disabled={controlsDisabled}
          />
          <NumberField
            value={rgb.g}
            min={0}
            max={255}
            step={1}
            onChange={(value) => setChannel("g", value)}
            label={t("settings.theme.creator.green")}
            disabled={controlsDisabled}
          />
        </div>

        <div className="theme-creator-channel">
          <span className="theme-creator-channel-label" aria-hidden="true">
            B
          </span>
          <ColorSlider
            value={rgb.b}
            min={0}
            max={255}
            step={1}
            onChange={(value) => setChannel("b", value)}
            gradient={`linear-gradient(to right, ${rgbCss(rgb.r, rgb.g, 0)}, ${rgbCss(rgb.r, rgb.g, 255)})`}
            label={t("settings.theme.creator.blue")}
            disabled={controlsDisabled}
          />
          <NumberField
            value={rgb.b}
            min={0}
            max={255}
            step={1}
            onChange={(value) => setChannel("b", value)}
            label={t("settings.theme.creator.blue")}
            disabled={controlsDisabled}
          />
        </div>
      </div>

      <div className="theme-creator-channel theme-creator-alpha">
        <span className="theme-creator-channel-label" aria-hidden="true">
          {t("settings.theme.creator.alpha")}
        </span>
        <ColorSlider
          value={hsva.a}
          min={0}
          max={1}
          step={0.01}
          onChange={(value) => onChange({ ...hsva, a: value })}
          gradient={`linear-gradient(to right, ${rgbCss(rgb.r, rgb.g, rgb.b, 0)}, ${rgbCss(rgb.r, rgb.g, rgb.b, 1)})`}
          label={t("settings.theme.creator.alpha")}
          disabled={controlsDisabled || !alphaEnabled}
        />
        <NumberField
          value={hsva.a}
          min={0}
          max={1}
          step={0.01}
          decimals={2}
          onChange={(value) => onChange({ ...hsva, a: value })}
          label={t("settings.theme.creator.alpha")}
          disabled={controlsDisabled || !alphaEnabled}
        />
      </div>

      <HexField
        rgba={rgba}
        onChange={(next) => onChange(rgbaToHsva(next, hsva))}
        label={t("settings.theme.creator.hex")}
        disabled={controlsDisabled}
      />

      {showAutoSet && (
        <div className="theme-creator-auto-set">
          <span>{t("settings.theme.creator.autoSet")}</span>
          <Toggle
            checked={auto}
            label={t("settings.theme.creator.autoSet")}
            onCheckedChange={onAutoChange}
          />
        </div>
      )}
    </div>
  );
}
