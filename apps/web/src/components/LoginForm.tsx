import { useState } from "react";

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
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="Username"
          autoComplete="username"
        />
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Password"
          autoComplete={
            mode === "login" ? "current-password" : "new-password"
          }
        />
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? "..."
            : mode === "login"
              ? "Log in"
              : "Register"}
        </button>
      </form>

      {mode === "register" && (
        <p className="login-panel__hint">
          Registration only works for usernames on the league allowlist.
        </p>
      )}

      {error && <p className="upload-error">{error}</p>}
    </div>
  );
}