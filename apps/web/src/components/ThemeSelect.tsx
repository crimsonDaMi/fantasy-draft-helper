import { THEMES } from "../themes";

interface ThemeSelectProps {
  themeId: string;
  onChange: (id: string) => void;
}

export function ThemeSelect({ themeId, onChange }: ThemeSelectProps) {
  return (
    <select
      className="theme-select"
      value={themeId}
      onChange={(event) => onChange(event.target.value)}
      aria-label="Color theme"
    >
      {THEMES.map((theme) => (
        <option key={theme.id} value={theme.id} title={theme.description}>
          {theme.name}
        </option>
      ))}
    </select>
  );
}
