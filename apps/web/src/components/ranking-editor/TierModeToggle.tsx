import type { TierDisplayMode } from "../ranking-editor-logic";

const MODES: { mode: TierDisplayMode; label: string }[] = [
  { mode: "alpha", label: "Letters" },
  { mode: "numeric", label: "Numbers" },
];

export function TierModeToggle({
  value,
  onChange,
}: {
  value: TierDisplayMode;
  onChange: (mode: TierDisplayMode) => void;
}) {
  return (
    <div
      className="ranking-editor__tier-mode-toggle"
      role="group"
      aria-label="Tier label format"
    >
      {MODES.map(({ mode, label }) => (
        <button
          key={mode}
          type="button"
          className={
            mode === value
              ? "ranking-editor__mode-button ranking-editor__mode-button--active"
              : "ranking-editor__mode-button"
          }
          onClick={() => onChange(mode)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
