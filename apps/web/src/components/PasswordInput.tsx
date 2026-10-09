import { useEffect, useId, useRef, useState } from "react";

type PasswordInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type"
>;

/** A password input with an eye button that shows or hides what was typed.
 * Submitting the surrounding form masks it again, so a revealed password
 * doesn't stay on screen and password managers see a password field. */
export function PasswordInput({ id, ...inputProps }: PasswordInputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const inputRef = useRef<HTMLInputElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const form = inputRef.current?.form;
    if (!form) {
      return;
    }

    const hide = () => setVisible(false);
    form.addEventListener("submit", hide);
    return () => form.removeEventListener("submit", hide);
  }, []);

  const label = visible ? "Hide password" : "Show password";

  return (
    <span className="password-input">
      <input
        {...inputProps}
        id={inputId}
        ref={inputRef}
        type={visible ? "text" : "password"}
      />
      <button
        type="button"
        className="password-input__toggle"
        aria-label={label}
        aria-pressed={visible}
        aria-controls={inputId}
        title={label}
        onClick={() => setVisible((current) => !current)}
      >
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
          <circle cx="12" cy="12" r="3" />
          {visible && <path d="M4 4l16 16" />}
        </svg>
      </button>
    </span>
  );
}
