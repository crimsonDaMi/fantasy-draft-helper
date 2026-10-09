import { useId, useState } from "react";

import { ErrorMessage } from "./ErrorMessage";
import { PasswordInput } from "./PasswordInput";

interface ChangePasswordFormProps {
  onChangePassword: (
    currentPassword: string,
    newPassword: string,
  ) => Promise<void>;
}

export function ChangePasswordForm({
  onChangePassword,
}: ChangePasswordFormProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  // Checked on submit, like at registration.
  const [mismatch, setMismatch] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [changed, setChanged] = useState(false);
  const mismatchId = useId();

  function onEdit(setValue: (value: string) => void) {
    return (event: React.ChangeEvent<HTMLInputElement>) => {
      setValue(event.target.value);
      setMismatch(false);
      setChanged(false);
    };
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      setMismatch(true);
      return;
    }
    setIsSaving(true);
    setError(undefined);
    try {
      await onChangePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setChanged(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Changing the password failed.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="account-page__section" onSubmit={handleSubmit}>
      <h3>Change password</h3>
      <p className="account-page__hint">
        8–128 characters. Changing it logs you out on all other devices.
      </p>
      <PasswordInput
        value={currentPassword}
        onChange={onEdit(setCurrentPassword)}
        placeholder="Current password"
        aria-label="Current password"
        autoComplete="current-password"
        required
      />
      <PasswordInput
        value={newPassword}
        onChange={onEdit(setNewPassword)}
        placeholder="New password"
        aria-label="New password"
        autoComplete="new-password"
        minLength={8}
        maxLength={128}
        required
      />
      <PasswordInput
        value={confirmPassword}
        onChange={onEdit(setConfirmPassword)}
        placeholder="Confirm new password"
        aria-label="Confirm new password"
        autoComplete="new-password"
        minLength={8}
        maxLength={128}
        required
        aria-invalid={mismatch}
        aria-describedby={mismatch ? mismatchId : undefined}
      />
      <button
        type="submit"
        className="account-page__submit"
        disabled={isSaving}
      >
        {isSaving ? "Changing…" : "Change password"}
      </button>
      {mismatch ? (
        <div id={mismatchId}>
          <ErrorMessage>Passwords don&apos;t match.</ErrorMessage>
        </div>
      ) : (
        error && <ErrorMessage>{error}</ErrorMessage>
      )}
      {changed && (
        <p className="account-page__hint" role="status">
          Password changed. You&apos;ve been logged out on all other devices.
        </p>
      )}
    </form>
  );
}
