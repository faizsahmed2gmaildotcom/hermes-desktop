import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import {
  clamp,
  parseHex,
  rgbaToHexDigits,
  wheelHsToPosition,
  wheelPositionToHs,
  WHEEL_GRADIENT,
  type HSVA,
  type RGBA,
} from "../../../theme/color";

export interface ColorWheelProps {
  hsva: HSVA;
  onChange: (next: HSVA) => void;
  disabled?: boolean;
  label: string;
}

/** CSS-only HSV wheel: conic hues at V=255 plus a white radial overlay. */
export function ColorWheel({
  hsva,
  onChange,
  disabled = false,
  label,
}: ColorWheelProps): React.JSX.Element {
  const wheelRef = useRef<HTMLDivElement>(null);
  const position = wheelHsToPosition(hsva.h, hsva.s);

  const updateFromPointer = (event: PointerEvent<HTMLDivElement>): void => {
    const wheel = wheelRef.current;
    if (!wheel) return;
    const rect = wheel.getBoundingClientRect();
    const { h, s } = wheelPositionToHs(
      event.clientX - rect.left,
      event.clientY - rect.top,
      rect.width,
      hsva.h,
    );
    onChange({ ...hsva, h, s });
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    if (disabled) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    updateFromPointer(event);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    if (disabled) return;
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    updateFromPointer(event);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (disabled) return;
    const amount = event.shiftKey ? 10 : 1;
    let next = hsva;
    if (event.key === "ArrowLeft") {
      next = { ...hsva, h: hsva.h - amount };
    } else if (event.key === "ArrowRight") {
      next = { ...hsva, h: hsva.h + amount };
    } else if (event.key === "ArrowUp") {
      next = { ...hsva, s: clamp(hsva.s + amount / 100, 0, 1) };
    } else if (event.key === "ArrowDown") {
      next = { ...hsva, s: clamp(hsva.s - amount / 100, 0, 1) };
    } else {
      return;
    }
    event.preventDefault();
    onChange(next);
  };

  return (
    <div
      ref={wheelRef}
      className={`theme-creator-wheel ${disabled ? "is-disabled" : ""}`}
      style={{ background: WHEEL_GRADIENT }}
      role="slider"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={360}
      aria-valuenow={Math.round(hsva.h)}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onKeyDown={onKeyDown}
    >
      <span className="theme-creator-wheel-overlay" aria-hidden="true" />
      <span
        className="theme-creator-wheel-thumb"
        style={{ left: `${position.x}%`, top: `${position.y}%` }}
        aria-hidden="true"
      />
    </div>
  );
}

export interface ColorSliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  gradient?: string;
  orientation?: "horizontal" | "vertical";
  label: string;
  disabled?: boolean;
}

/** Pointer/keyboard/wheel slider; the track is a presentation div. */
export function ColorSlider({
  value,
  min,
  max,
  step = 1,
  onChange,
  gradient,
  orientation = "horizontal",
  label,
  disabled = false,
}: ColorSliderProps): React.JSX.Element {
  const trackRef = useRef<HTMLDivElement>(null);
  const range = max - min || 1;
  const ratio = clamp((value - min) / range, 0, 1);
  const decimals = step < 1 ? 2 : 0;
  const snap = useCallback(
    (raw: number): number => {
      const snapped = Math.round(raw / step) * step;
      const bounded = clamp(snapped, min, max);
      return Number(bounded.toFixed(decimals));
    },
    [decimals, max, min, step],
  );

  const updateFromPointer = (event: PointerEvent<HTMLDivElement>): void => {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const nextRatio =
      orientation === "horizontal"
        ? (event.clientX - rect.left) / rect.width
        : 1 - (event.clientY - rect.top) / rect.height;
    onChange(snap(min + clamp(nextRatio, 0, 1) * range));
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    if (disabled) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    updateFromPointer(event);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    if (disabled) return;
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    updateFromPointer(event);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (disabled) return;
    let next: number | null = null;
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      next = snap(value - step);
    } else if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      next = snap(value + step);
    } else if (event.key === "Home") {
      next = min;
    } else if (event.key === "End") {
      next = max;
    }
    if (next === null) return;
    event.preventDefault();
    onChange(next);
  };

  // React's onWheel is passive in Chromium, so bind natively to stop the modal
  // body from scrolling while the pointer is over a slider.
  useEffect(() => {
    const track = trackRef.current;
    if (!track || disabled) return;
    const handleWheel = (event: WheelEvent): void => {
      event.preventDefault();
      onChange(snap(value + (event.deltaY < 0 ? step : -step)));
    };
    track.addEventListener("wheel", handleWheel, { passive: false });
    return () => track.removeEventListener("wheel", handleWheel);
  }, [disabled, onChange, snap, step, value]);

  const thumbStyle =
    orientation === "horizontal"
      ? { left: `${ratio * 100}%` }
      : { top: `${(1 - ratio) * 100}%` };

  return (
    <div
      ref={trackRef}
      className={`theme-creator-slider theme-creator-slider-${orientation} ${
        gradient ? "has-gradient" : ""
      } ${disabled ? "is-disabled" : ""}`}
      style={gradient ? { background: gradient } : undefined}
      role="slider"
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onKeyDown={onKeyDown}
    >
      <span
        className="theme-creator-slider-thumb"
        style={thumbStyle}
        aria-hidden="true"
      />
    </div>
  );
}

export interface NumberFieldProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  label: string;
  disabled?: boolean;
  decimals?: number;
}

/** Numeric text field: valid input commits live, invalid input turns red. */
export function NumberField({
  value,
  min,
  max,
  step = 1,
  onChange,
  label,
  disabled = false,
  decimals = 0,
}: NumberFieldProps): React.JSX.Element {
  const format = (next: number): string =>
    decimals > 0 ? next.toFixed(decimals) : String(Math.round(next));
  const [draft, setDraft] = useState(() => format(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(format(value));
    // `format` only depends on `decimals`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, focused, decimals]);

  const parsed = Number(draft.trim());
  const invalid =
    draft.trim() === "" ||
    !Number.isFinite(parsed) ||
    parsed < min ||
    parsed > max;

  return (
    <input
      type="text"
      inputMode={decimals > 0 ? "decimal" : "numeric"}
      className={`theme-creator-field ${invalid ? "is-invalid" : ""}`}
      value={draft}
      aria-label={label}
      aria-invalid={invalid}
      disabled={disabled}
      onFocus={() => setFocused(true)}
      onChange={(event) => {
        const nextDraft = event.target.value;
        setDraft(nextDraft);
        const next = Number(nextDraft.trim());
        if (
          nextDraft.trim() !== "" &&
          Number.isFinite(next) &&
          next >= min &&
          next <= max
        ) {
          onChange(Number((Math.round(next / step) * step).toFixed(decimals)));
        }
      }}
      onBlur={() => {
        setFocused(false);
        const next = Number(draft.trim());
        if (draft.trim() !== "" && Number.isFinite(next)) {
          const bounded = clamp(Math.round(next / step) * step, min, max);
          const normalized = Number(bounded.toFixed(decimals));
          setDraft(format(normalized));
          onChange(normalized);
        } else {
          setDraft(format(value));
        }
      }}
    />
  );
}

export interface HexFieldProps {
  rgba: RGBA;
  onChange: (rgba: RGBA) => void;
  label: string;
  disabled?: boolean;
}

/** Six uppercase hex digits; the `#` is a static sibling, not part of the value. */
export function HexField({
  rgba,
  onChange,
  label,
  disabled = false,
}: HexFieldProps): React.JSX.Element {
  const current = rgbaToHexDigits(rgba);
  const [draft, setDraft] = useState(current);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(current);
  }, [current, focused]);

  const parsed = parseHex(draft);

  return (
    <div className="theme-creator-hex">
      <span className="theme-creator-hex-hash" aria-hidden="true">
        #
      </span>
      <input
        type="text"
        className={`theme-creator-field theme-creator-hex-input ${
          parsed ? "" : "is-invalid"
        }`}
        value={draft}
        maxLength={6}
        aria-label={label}
        aria-invalid={parsed === null}
        disabled={disabled}
        onFocus={() => setFocused(true)}
        onChange={(event) => {
          const next = event.target.value.replace(/^#/, "").toUpperCase();
          setDraft(next);
          const color = parseHex(next);
          if (color) onChange({ ...color, a: rgba.a });
        }}
        onBlur={() => {
          setFocused(false);
          const color = parseHex(draft);
          if (color) {
            setDraft(rgbaToHexDigits(color));
            onChange({ ...color, a: rgba.a });
          } else {
            setDraft(current);
          }
        }}
      />
    </div>
  );
}
