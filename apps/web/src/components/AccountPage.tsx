import { useState } from "react";
import { useNavigate } from "react-router";

import { ErrorMessage } from "./ErrorMessage";

interface AccountPageProps {
  username: string;
  onDeleteAccount: (password: string) => Promise<void>;
}

export function AccountPage({ username, onDeleteAccount }: AccountPageProps) {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string>();

  async function handleDelete(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsDeleting(true);
    setError(undefined);
    try {
      await onDeleteAccount(password);
      // Back to the start page, so logging in again doesn't land here.
      void navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Deleting failed.");
      setIsDeleting(false);
    }
  }

  return (
    <section className="account-page">
      <h2>Account</h2>
      <p className="account-page__hint">
        Logged in as <strong>{username}</strong>.
      </p>

      <form className="account-page__section" onSubmit={handleDelete}>
        <h3>Delete account</h3>
        <p className="account-page__hint">
          Permanently deletes your account and all of your rankings, tiers and
          watch/avoid flags. This can&apos;t be undone — export any ranking you
          want to keep as CSV first.
        </p>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Your password"
          autoComplete="current-password"
          aria-label="Your password"
          required
        />
        <button
          type="submit"
          className="account-page__delete"
          disabled={isDeleting || password === ""}
        >
          {isDeleting ? "Deleting…" : "Delete my account"}
        </button>
        {error && <ErrorMessage>{error}</ErrorMessage>}
      </form>
    </section>
  );
}
