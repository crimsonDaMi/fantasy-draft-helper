const POSITIONS = ["QB", "RB", "WR", "TE", "K", "DEF"] as const;

interface PositionFilterProps {
  selected: string[];
  onChange: (positions: string[]) => void;
}

export function PositionFilter({
  selected,
  onChange,
}: PositionFilterProps) {
  const toggle = (position: string) => {
    if (selected.includes(position)) {
      onChange(selected.filter((p) => p !== position));
    } else {
      onChange([...selected, position].sort());
    }
  };

  return (
    <div className="position-filter" role="group" aria-label="Filter by position">
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
    </div>
  );
}