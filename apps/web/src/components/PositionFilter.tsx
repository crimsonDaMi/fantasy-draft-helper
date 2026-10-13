import { POSITIONS } from "../utils/positions";

interface PositionFilterProps {
  selected: string[];
  onChange: (positions: string[]) => void;
  rookies?: boolean;
  /** Omit to leave out the Rookies pill. */
  onRookiesChange?: (rookies: boolean) => void;
}

export function PositionFilter({
  selected,
  onChange,
  rookies = false,
  onRookiesChange,
}: PositionFilterProps) {
  const toggle = (position: string) => {
    if (selected.includes(position)) {
      onChange(selected.filter((p) => p !== position));
    } else {
      onChange([...selected, position].sort());
    }
  };

  return (
    <div
      className="position-filter"
      role="group"
      aria-label="Filter by position"
    >
      {POSITIONS.map((position) => (
        <span className="position-filter__pill" key={position}>
          <input
            type="checkbox"
            id={`position-${position}`}
            checked={selected.includes(position)}
            onChange={() => toggle(position)}
          />
          <label htmlFor={`position-${position}`}>{position}</label>
        </span>
      ))}
      {onRookiesChange && (
        <span className="position-filter__pill">
          <input
            type="checkbox"
            id="position-filter-rookies"
            checked={rookies}
            onChange={(event) => onRookiesChange(event.target.checked)}
          />
          <label htmlFor="position-filter-rookies">Rookies</label>
        </span>
      )}
    </div>
  );
}
