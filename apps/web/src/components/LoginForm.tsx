import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { ErrorMessage } from "./ErrorMessage";

interface LoginFormProps {
  error?: string;
  onLogin: (username: string, password: string) => Promise<void>;
  onRegister: (username: string, password: string) => Promise<void>;
}

export function LoginForm({ error, onLogin, onRegister }: LoginFormProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const usernameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    usernameInputRef.current?.focus();
  }, [mode]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
          onClick={() => setMode("login")}
        >
          Log in
        </button>
        <button
          type="button"
          className={mode === "register" ? "login-panel__tab--active" : ""}
          onClick={() => setMode("register")}
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
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          {...(mode === "register" && { minLength: 8, maxLength: 128 })}
        />
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "..." : mode === "login" ? "Log in" : "Register"}
        </button>
      </form>

      {mode === "register" && (
        <p className="login-panel__hint">
          Usernames are 3–32 letters, digits, _, . or -; passwords at least 8
          characters. League instances only accept usernames on their allowlist.
        </p>
      )}

      {error && <ErrorMessage>{error}</ErrorMessage>}

      <Link to="/privacy" className="login-panel__hint">
        Privacy notice
      </Link>
    </div>
  );
}
