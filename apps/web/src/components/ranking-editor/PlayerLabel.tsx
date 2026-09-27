import type { EditorPlayer } from "../ranking-editor-logic";

/** Name plus "position · team" — shared by sortable rows and the drag
 * overlay so the dragged preview always matches the row it came from. */
export function PlayerLabel({
  player,
  showNameTitle = false,
}: {
  player: EditorPlayer;
  showNameTitle?: boolean;
}) {
  return (
    <>
      <span
        className="ranking-editor__name"
        title={showNameTitle ? player.fullName : undefined}
      >
        {player.fullName}
      </span>
      <span className="ranking-editor__meta">
        {player.position}
        {player.position && player.team && " · "}
        {player.team}
      </span>
    </>
  );
}
