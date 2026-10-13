interface NoteButtonProps {
  playerName: string;
  note?: string;
  onClick: () => void;
  /** -1 keeps the button out of the tab order (roving-focus rows). */
  tabIndex?: number;
}

/** Opens a ranked row's note editor; shown dimmed until the player has a
 * note. Like `FlagButtons`, it stops pointer-down, touch-start and click
 * propagation, so it doesn't start a drag or count as a tap on the row. */
export function NoteButton({
  playerName,
  note,
  onClick,
  tabIndex,
}: NoteButtonProps) {
  return (
    <button
      type="button"
      className="flag-buttons__button note-button"
      tabIndex={tabIndex}
      data-has-note={note ? true : undefined}
      aria-label={
        note ? `Edit note on ${playerName}` : `Add note on ${playerName}`
      }
      title={note ?? "Add note"}
      onPointerDown={(event) => event.stopPropagation()}
      onTouchStart={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    >
      ✎
    </button>
  );
}
