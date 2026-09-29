import type { ReactNode } from "react";

/** An error shown to the user: announced to screen readers, in the one
 * error style, with an optional Retry button. `className` is for layout
 * only (spacing, flex placement). */
export function ErrorMessage({
  children,
  className,
  onRetry,
}: {
  children: ReactNode;
  className?: string;
  onRetry?: () => void;
}) {
  return (
    <p
      className={className ? `error-message ${className}` : "error-message"}
      role="alert"
    >
      <span>{children}</span>
      {onRetry && (
        <button
          type="button"
          className="error-message__retry"
          onClick={onRetry}
        >
          Retry
        </button>
      )}
    </p>
  );
}
