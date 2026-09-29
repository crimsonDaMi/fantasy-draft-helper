import type { PlayerFlag } from "../types/api";

interface FlagButtonsProps {
  playerName: string;
  flag?: PlayerFlag;
  onChange: (flag: PlayerFlag | null) => void;
}

/** Watch (★) and avoid (⊘) toggles for a player. Pressing the active one
 * clears it. Pointer-down and touch-start don't propagate, so inside a
 * draggable row the buttons click instead of starting a drag. */
export function FlagButtons({ playerName, flag, onChange }: FlagButtonsProps) {
  const toggle = (target: PlayerFlag) =>
    onChange(flag === target ? null : target);

  return (
    <span
      className="flag-buttons"
      onPointerDown={(event) => event.stopPropagation()}
      onTouchStart={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        className="flag-buttons__button flag-buttons__button--watch"
        aria-pressed={flag === "watch"}
        aria-label={`Watch ${playerName}`}
        title="Watch"
        onClick={() => toggle("watch")}
      >
        ★
      </button>
      <button
        type="button"
        className="flag-buttons__button flag-buttons__button--avoid"
        aria-pressed={flag === "avoid"}
        aria-label={`Avoid ${playerName}`}
        title="Avoid (hide from recommendations)"
        onClick={() => toggle("avoid")}
      >
        ⊘
      </button>
    </span>
  );
}
