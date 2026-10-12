import { useRef, type InputHTMLAttributes } from "react";

interface SearchFieldProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "value" | "onChange" | "className"
> {
  value: string;
  onValueChange: (value: string) => void;
  /** Layout class for the field (e.g. its flex sizing). */
  className?: string;
}

/** A search input with its own themed clear button: the browser's can't
 * be themed, so it's hidden in index.css. */
export function SearchField({
  value,
  onValueChange,
  className,
  ...inputProps
}: SearchFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <span className={className ? `search-field ${className}` : "search-field"}>
      <input
        {...inputProps}
        ref={inputRef}
        type="search"
        className="search-input search-field__input"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
      />
      {value !== "" && (
        <button
          type="button"
          className="search-field__clear"
          aria-label="Clear search"
          onClick={() => {
            onValueChange("");
            inputRef.current?.focus();
          }}
        >
          ×
        </button>
      )}
    </span>
  );
}
