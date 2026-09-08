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
    <fieldset>
      <legend>Filter by position</legend>
      {POSITIONS.map((position) => (
        <label key={position}>
          <input
            type="checkbox"
            checked={selected.includes(position)}
            onChange={() => toggle(position)}
          />
          {position}
        </label>
      ))}
    </fieldset>
  );
}