import type { TierDisplayMode } from "../ranking-editor-logic";
import { SegmentedToggle } from "./SegmentedToggle";

const MODES = [
  { value: "alpha", label: "Letters" },
  { value: "numeric", label: "Numbers" },
] as const;

export function TierModeToggle({
  value,
  onChange,
}: {
  value: TierDisplayMode;
  onChange: (mode: TierDisplayMode) => void;
}) {
  return (
    <SegmentedToggle
      label="Tier label format"
      className="ranking-editor__tier-mode-toggle"
      options={MODES}
      value={value}
      onChange={onChange}
    />
  );
}
