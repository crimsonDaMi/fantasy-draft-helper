import {
  useState,
} from "react";

interface DraftFormProps {
  onSubmit: (
    draftId: string,
  ) => void;
}

export function DraftForm({
  onSubmit,
}: DraftFormProps) {
  const [draftId, setDraftId] =
    useState("");

  function handleSubmit(
    event:
      React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const trimmedDraftId =
      draftId.trim();

    if (!trimmedDraftId) {
      return;
    }

    onSubmit(
      trimmedDraftId,
    );
  }

  return (
    <section>
      <h2>
        Monitor Draft
      </h2>

      <form
        onSubmit={handleSubmit}
      >
        <input
          value={draftId}

          onChange={(event) =>
            setDraftId(
              event.target.value,
            )
          }

          placeholder="Sleeper Draft ID"
        />

        <button
          type="submit"
        >
          Start Monitoring
        </button>
      </form>
    </section>
  );
}