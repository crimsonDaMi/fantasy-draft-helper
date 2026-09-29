/** A row of mutually exclusive buttons; the selected one is pressed. */
export function SegmentedToggle<T extends string>({
  label,
  className,
  options,
  value,
  onChange,
}: {
  /** Accessible name of the group. */
  label: string;
  className: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className={className} role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={
            option.value === value
              ? "ranking-editor__mode-button ranking-editor__mode-button--active"
              : "ranking-editor__mode-button"
          }
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
