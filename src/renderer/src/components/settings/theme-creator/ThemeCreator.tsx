import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { AppModal, AppModalTitle } from "../../modal/AppModal";
import { Toggle } from "../../common/Toggle";
import type { SelectMenuOption } from "../../common/SelectMenu";
import { useI18n } from "../../useI18n";
import { rgbaToHsva, type HSVA } from "../../../theme/color";
import {
  ALPHA_TOKENS,
  SEED_DEFAULTS,
  SEED_TOKENS,
  THEME_TOKENS,
  createInitialTokenState,
  normalizeHsvaForToken,
  resolvePalette,
  resolveToken,
  tokenLabel,
  type SeedToken,
  type ThemeToken,
  type TokenState,
} from "../../../theme/tokens";
import ColorPicker from "./ColorPicker";

export interface ThemeCreatorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SLOT_COUNT = SEED_TOKENS.length;

function initialStates(): Map<ThemeToken, TokenState> {
  const states = new Map<ThemeToken, TokenState>();
  for (const token of SEED_TOKENS) {
    states.set(token, {
      auto: false,
      manual: rgbaToHsva(SEED_DEFAULTS[token]),
    });
  }
  return states;
}

/** Three-column color editor. Draft-only: no save, name, or persistence yet. */
export default function ThemeCreator({
  open,
  onOpenChange,
}: ThemeCreatorProps): React.JSX.Element {
  const { t } = useI18n();
  const [simpleMode, setSimpleMode] = useState(true);
  const [targets, setTargets] = useState<ThemeToken[]>([...SEED_TOKENS]);
  const [states, setStates] =
    useState<Map<ThemeToken, TokenState>>(initialStates);

  const palette = useMemo(() => resolvePalette(states), [states]);

  const simpleLabels: Record<SeedToken, string> = {
    "bg-primary": t("settings.theme.creator.appearance"),
    "bg-secondary": t("settings.theme.creator.background"),
    accent: t("settings.theme.creator.accent"),
  };

  const excluded = new Set<ThemeToken>(targets);
  const options: SelectMenuOption[] = THEME_TOKENS.filter(
    (token) => !excluded.has(token),
  )
    .map((token) => ({ value: token, label: tokenLabel(token) }))
    .sort((a, b) =>
      b.label.localeCompare(a.label, undefined, { sensitivity: "base" }),
    );

  const selectTarget = (index: number, token: ThemeToken): void => {
    setStates((previous) => {
      if (previous.has(token)) return previous;
      const next = new Map(previous);
      next.set(token, createInitialTokenState(token, previous));
      return next;
    });
    setTargets((previous) => {
      const next = [...previous];
      next[index] = token;
      return next;
    });
  };

  const updateColor = (token: ThemeToken, next: HSVA): void => {
    setStates((previous) => {
      const map = new Map(previous);
      map.set(token, {
        auto: false,
        manual: normalizeHsvaForToken(token, next),
      });
      return map;
    });
  };

  const updateAuto = (token: ThemeToken, checked: boolean): void => {
    setStates((previous) => {
      const map = new Map(previous);
      if (checked) {
        const autoMap = new Map(previous);
        const current =
          previous.get(token) ?? createInitialTokenState(token, previous);
        autoMap.set(token, { ...current, auto: true });
        map.set(token, {
          auto: true,
          manual: normalizeHsvaForToken(
            token,
            rgbaToHsva(resolveToken(token, autoMap)),
          ),
        });
      } else {
        map.set(token, {
          auto: false,
          manual: normalizeHsvaForToken(
            token,
            rgbaToHsva(resolveToken(token, previous)),
          ),
        });
      }
      return map;
    });
  };

  const toggleSimpleMode = (enabled: boolean): void => {
    setSimpleMode(enabled);
    if (enabled) setTargets([...SEED_TOKENS]);
  };

  return (
    <AppModal
      open={open}
      onOpenChange={onOpenChange}
      className="theme-creator-modal"
      overlayClassName="theme-creator-modal-overlay"
      labelledBy="theme-creator-title"
    >
      <div className="theme-creator-shell">
        <div className="theme-creator-header">
          <AppModalTitle
            id="theme-creator-title"
            className="theme-creator-title"
          >
            {t("settings.theme.creator.title")}
          </AppModalTitle>
          <div className="theme-creator-header-actions">
            <div className="theme-creator-simple-mode">
              <span>{t("settings.theme.creator.simpleMode")}</span>
              <Toggle
                checked={simpleMode}
                label={t("settings.theme.creator.simpleMode")}
                onCheckedChange={toggleSimpleMode}
              />
            </div>
            <button
              type="button"
              className="settings-modal-close"
              onClick={() => onOpenChange(false)}
              aria-label={t("common.close")}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="theme-creator-body">
          <div className="theme-creator-grid">
            {targets.slice(0, SLOT_COUNT).map((target, index) => {
              const state = states.get(target);
              const auto = state?.auto ?? false;
              const hsva =
                state && !state.auto
                  ? state.manual
                  : rgbaToHsva(palette.colors[target]);
              const targetLabel = simpleMode
                ? (simpleLabels[target as SeedToken] ?? tokenLabel(target))
                : tokenLabel(target);
              const isSeed = (SEED_TOKENS as readonly ThemeToken[]).includes(
                target,
              );

              return (
                <ColorPicker
                  key={index}
                  target={target}
                  targetLabel={targetLabel}
                  options={options}
                  hsva={hsva}
                  onChange={(next) => updateColor(target, next)}
                  onTargetChange={(next) => selectTarget(index, next)}
                  targetSelectDisabled={simpleMode}
                  showAutoSet={!isSeed}
                  auto={auto}
                  onAutoChange={(checked) => updateAuto(target, checked)}
                  alphaEnabled={ALPHA_TOKENS.has(target)}
                />
              );
            })}
          </div>
        </div>
      </div>
    </AppModal>
  );
}
