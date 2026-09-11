import { useState } from "react";

interface DraftFormProps {
  onSubmit: (draftId: string) => void;
}

export function DraftForm({ onSubmit }: DraftFormProps) {
  const [draftId, setDraftId] = useState("");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedDraftId = draftId.trim();
    if (!trimmedDraftId) {
      return;
    }
    onSubmit(trimmedDraftId);
  }

  return (
    <div>
      <h2>Monitor draft</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={draftId}
          onChange={(event) => setDraftId(event.target.value)}
          placeholder="Sleeper draft ID"
        />
        <button type="submit">Start</button>
      </form>
    </div>
  );
}