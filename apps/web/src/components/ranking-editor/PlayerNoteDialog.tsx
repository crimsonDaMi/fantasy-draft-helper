import { useCallback, useState } from "react";

import type { EditorPlayer } from "../ranking-editor-logic";

/** Keep in sync with the API's MAX_NOTE_LENGTH. */
const MAX_NOTE_LENGTH = 500;

interface PlayerNoteDialogProps {
  player: EditorPlayer;
  /** Saves the note; an empty one clears it. */
  onSave: (note: string) => void;
  onClose: () => void;
}

/** Edits a ranked player's note, shown on draft day. A native modal
 * <dialog>, like `PlayerMoveMenu`, for focus trapping and Escape. */
export function PlayerNoteDialog({
  player,
  onSave,
  onClose,
}: PlayerNoteDialogProps) {
  const [note, setNote] = useState(player.note ?? "");

  const openDialog = useCallback((node: HTMLDialogElement | null) => {
    if (!node || node.open) {
      return;
    }
    // jsdom doesn't implement showModal.
    if (typeof node.showModal === "function") {
      node.showModal();
    } else {
      node.setAttribute("open", "");
    }
  }, []);

  function save(value: string) {
    const trimmed = value.trim();
    if (trimmed !== (player.note ?? "")) {
      onSave(trimmed);
    }
    onClose();
  }

  return (
    <dialog
      ref={openDialog}
      className="ranking-editor__move-menu"
      aria-label={`Note on ${player.fullName}`}
      onClose={onClose}
      // A click on the dialog itself (not its content) is on the backdrop.
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <form
        className="ranking-editor__move-menu-content"
        onSubmit={(event) => {
          event.preventDefault();
          save(note);
        }}
      >
        <h3>{player.fullName}</h3>
        <label className="ranking-editor__note-field">
          <span className="ranking-editor__move-menu-label">
            Note, shown on draft day
          </span>
          <textarea
            value={note}
            maxLength={MAX_NOTE_LENGTH}
            rows={4}
            autoFocus
            onChange={(event) => setNote(event.target.value)}
            onKeyDown={(event) => {
              // Ctrl/⌘+Enter saves; plain Enter is a line break.
              if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                event.preventDefault();
                save(note);
              }
            }}
          />
        </label>
        <button type="submit">Save note</button>
        {player.note && (
          <button
            type="button"
            className="ranking-editor__move-menu-remove"
            onClick={() => save("")}
          >
            Clear note
          </button>
        )}
        <button
          type="button"
          className="ranking-editor__move-menu-cancel"
          onClick={onClose}
        >
          Cancel
        </button>
      </form>
    </dialog>
  );
}
