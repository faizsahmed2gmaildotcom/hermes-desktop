# Theme creator

The Theme Creator is a nested modal that edits all 31 theme tokens through three colour pickers; it keeps a session draft and does not save, name, or apply a theme yet.

[[src/renderer/src/components/settings/theme-creator/ThemeCreator.tsx#ThemeCreator]] opens above the Settings modal through the shared [[src/renderer/src/components/modal/AppModal.tsx#AppModal]] shell. [[src/renderer/src/components/settings/AppearancePane.tsx]] owns only the `creatorOpen` state and the trailing "+" tile, so closing and reopening the creator preserves its draft for the life of the pane.

## Simple mode

Simple mode binds the three pickers to Appearance (`--bg-primary`), Background (`--bg-secondary`), and Accent (`--accent`), and locks their style dropdowns.

Simple mode starts on. Turning it off enables the dropdowns and leaves the slots where they are; turning it back on rebinds all three slots to the seed tokens without discarding advanced-token memory. The seed values are fixed dark defaults (`#212121`, `#171717`, `#003F7A`); reading the active theme is deferred until the edit/save flow exists. Theme test coverage lives in [[src/renderer/src/components/settings/theme-creator/ThemeCreator.test.tsx]].

## Style assignment

Each picker's style menu lists the 31 tokens from [[src/renderer/src/assets/main.css]] and hides all three current targets, including the slot's own.

The trigger always names the current selection: the simple-mode alias while simple mode is on, the human token label in advanced mode. Labels come from [[src/renderer/src/theme/tokens.ts#TOKEN_LABELS]] with the raw token as fallback, and every list is sorted Z→A by label. The menu reuses the extracted [[src/renderer/src/components/common/SelectMenu.tsx#SelectMenu]] and its `.settings-language-*` styling, which the language pane now shares.

## Auto-set

Auto-set resolves formula tokens from their parent tokens, while manual overrides flow to every derived child immediately.

Seeds are manual roots and never show the toggle. Formula tokens start with Auto-set on; `--success`, `--error`, and `--warning` start off with their canonical colours because they have no formula. Turning Auto-set on derives the value and overwrites the manual one; turning it off snapshots the currently displayed value. Each token keeps `{ auto, manual }` by token, so pointing a slot away and back restores both. When Auto-set is on for a no-formula token, the status colour becomes `mix(default, accent, 35%)`; `--primary-yellow` always follows `--warning`. All resolution and derivation live in [[src/renderer/src/theme/tokens.ts#resolvePalette]].

## Controls

Every picker renders a wheel, a vertical brightness slider (255 at the top), R/G/B sliders, an alpha slider, a hex field, and the Auto-set toggle.

The wheel is CSS-only (`conic-gradient` plus a radial white overlay) at HSV V=255. Sliders support click-to-jump, drag, arrow keys, and non-passive wheel adjustment without scrolling the modal body. Numeric fields commit valid in-range values live, show a red outline while invalid, and clamp or revert on blur; hex is uppercase with the `#` outside the input. Alpha is always present but disabled and pinned at `1.00` for tokens outside the seven tint tokens. Every new non-circular surface uses the `--radius-*` tokens so the rounded-corners preference applies. The pure colour maths and wheel geometry are in [[src/renderer/src/theme/color.ts]].
