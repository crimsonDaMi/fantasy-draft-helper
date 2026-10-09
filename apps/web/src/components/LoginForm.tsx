import { useEffect, useId, useRef, useState } from "react";
import { ErrorMessage } from "./ErrorMessage";
import { PasswordInput } from "./PasswordInput";

interface LoginFormProps {
  error?: string;
  onLogin: (username: string, password: string) => Promise<void>;
  onRegister: (username: string, password: string) => Promise<void>;
}

export function LoginForm({ error, onLogin, onRegister }: LoginFormProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  // Checked on submit rather than while typing, so a half-typed
  // confirmation doesn't already count as a mismatch.
  const [mismatch, setMismatch] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const usernameInputRef = useRef<HTMLInputElement>(null);
  const mismatchId = useId();

  useEffect(() => {
    usernameInputRef.current?.focus();
  }, [mode]);

  function switchMode(next: "login" | "register") {
    setMode(next);
    setConfirmPassword("");
    setMismatch(false);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mode === "register" && password !== confirmPassword) {
      setMismatch(true);
      return;
    }
    setIsSubmitting(true);
    try {
      if (mode === "login") {
        await onLogin(username, password);
      } else {
        await onRegister(username, password);
      }
    } catch {
      // error state is surfaced via the `error` prop
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="login-panel">
      <h1>Fantasy Draft Helper</h1>

      <div className="login-panel__tabs">
        <button
          type="button"
          className={mode === "login" ? "login-panel__tab--active" : ""}
          onClick={() => switchMode("login")}
        >
          Log in
        </button>
        <button
          type="button"
          className={mode === "register" ? "login-panel__tab--active" : ""}
          onClick={() => switchMode("register")}
        >
          Register
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <input
          type="text"
          ref={usernameInputRef}
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="Username"
          autoComplete="username"
          {...(mode === "register" && {
            pattern: "[A-Za-z0-9_.\\-]{3,32}",
            title: "3–32 letters, digits, _, . or -",
          })}
        />
        <PasswordInput
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            setMismatch(false);
          }}
          placeholder="Password"
          aria-label="Password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          {...(mode === "register" && { minLength: 8, maxLength: 128 })}
        />
        {mode === "register" && (
          <PasswordInput
            value={confirmPassword}
            onChange={(event) => {
              setConfirmPassword(event.target.value);
              setMismatch(false);
            }}
            placeholder="Confirm password"
            aria-label="Confirm password"
            autoComplete="new-password"
            minLength={8}
            maxLength={128}
            aria-invalid={mismatch}
            aria-describedby={mismatch ? mismatchId : undefined}
          />
        )}
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "..." : mode === "login" ? "Log in" : "Register"}
        </button>
      </form>

      {mode === "register" && (
        <p className="login-panel__hint">
          Usernames are 3–32 letters, digits, _, . or -; passwords at least 8
          characters; enter yours twice to rule out typos. League instances only
          accept usernames on their allowlist.
        </p>
      )}

      {mismatch ? (
        <div id={mismatchId}>
          <ErrorMessage>Passwords don&apos;t match.</ErrorMessage>
        </div>
      ) : (
        error && <ErrorMessage>{error}</ErrorMessage>
      )}
    </div>
  );
}
