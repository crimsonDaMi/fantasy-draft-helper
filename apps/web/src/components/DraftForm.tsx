import { useState } from "react";
import { useMutation } from "@tanstack/react-query";

import { findUserDrafts } from "../api/fantasy-api";
import type { ApiUserDraft } from "../types/api";
import { parseDraftId } from "../utils/draft-id";
import {
  readStoredSleeperUsername,
  writeStoredSleeperUsername,
} from "../utils/stored-sleeper-username";

interface DraftSelection {
  draftId: string;
  /** Set when the draft was picked from a Sleeper user's draft list. */
  sleeperUserId?: string;
}

interface DraftFormProps {
  initialDraftId?: string;
  onSubmit: (selection: DraftSelection) => void;
}

const STATUS_LABELS: Record<ApiUserDraft["status"], string> = {
  PRE_DRAFT: "not started",
  DRAFTING: "live",
  COMPLETE: "complete",
  UNKNOWN: "unknown",
};

function describeDraft(draft: ApiUserDraft): string {
  const format = [draft.teams && `${draft.teams}-team`, draft.type]
    .filter(Boolean)
    .join(" ");

  return [format, STATUS_LABELS[draft.status]].filter(Boolean).join(" · ");
}

export function DraftForm({ initialDraftId, onSubmit }: DraftFormProps) {
  const [draftId, setDraftId] = useState(initialDraftId ?? "");
  const [username, setUsername] = useState(readStoredSleeperUsername);
  const [season, setSeason] = useState(() => String(new Date().getFullYear()));

  const lookup = useMutation({
    mutationFn: ({ name, year }: { name: string; year: string }) =>
      findUserDrafts(name, year),
  });

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedDraftId = parseDraftId(draftId);
    if (!parsedDraftId) {
      return;
    }
    // Show the bare ID, so a pasted link visibly turned into one.
    setDraftId(parsedDraftId);
    onSubmit({ draftId: parsedDraftId });
  }

  function handleLookup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      return;
    }
    writeStoredSleeperUsername(trimmedUsername);
    lookup.mutate({ name: trimmedUsername, year: season });
  }

  return (
    <div className="draft-form">
      <h2>Monitor draft</h2>

      <form className="draft-form__lookup" onSubmit={handleLookup}>
        <input
          type="text"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="Sleeper username"
          aria-label="Sleeper username"
        />
        <input
          type="number"
          className="draft-form__season"
          value={season}
          min={2017}
          max={2100}
          onChange={(event) => setSeason(event.target.value)}
          aria-label="Season"
        />
        <button type="submit" disabled={lookup.isPending}>
          Find drafts
        </button>
      </form>
      <p className="draft-form__hint">
        Mock drafts aren't listed by Sleeper — paste the mock draft's link or ID
        below instead.
      </p>

      {lookup.error && (
        <p className="draft-form__error" role="alert">
          {lookup.error.message}
        </p>
      )}

      {lookup.data && lookup.data.drafts.length === 0 && (
        <p className="draft-form__hint">No drafts found for {season}.</p>
      )}

      {lookup.data && lookup.data.drafts.length > 0 && (
        <ul className="draft-form__drafts">
          {lookup.data.drafts.map((draft) => (
            <li key={draft.draftId} className="draft-form__draft">
              <span className="draft-form__draft-name">
                {draft.name ?? `Draft ${draft.draftId}`}
              </span>
              <span className="draft-form__draft-meta">
                {describeDraft(draft)}
              </span>
              <button
                type="button"
                onClick={() => {
                  setDraftId(draft.draftId);
                  onSubmit({
                    draftId: draft.draftId,
                    sleeperUserId: lookup.data.sleeperUserId,
                  });
                }}
              >
                Monitor
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="draft-form__hint">Or enter a draft link or ID:</p>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={draftId}
          onChange={(event) => setDraftId(event.target.value)}
          placeholder="Sleeper draft link or ID"
          aria-label="Sleeper draft link or ID"
        />
        <button type="submit">Start</button>
      </form>
    </div>
  );
}
