import type { Theme } from "../hooks/useTheme";

const THEMES: { value: Theme; label: string }[] = [
  { value: "forest", label: "Forest" },
  { value: "steel", label: "Steel" },
];

interface ThemeToggleProps {
  theme: Theme;
  onChange: (theme: Theme) => void;
}

export function ThemeToggle({ theme, onChange }: ThemeToggleProps) {
  return (
    <div className="theme-toggle" role="radiogroup" aria-label="Color theme" >
      {
        THEMES.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={theme === value}
            className={`theme-toggle__option${theme === value ? " theme-toggle__option--active" : ""
              }`
            }
            onClick={() => onChange(value)}
          >
            {label}
          </button >
        ))
      }
    </div >
  );
}