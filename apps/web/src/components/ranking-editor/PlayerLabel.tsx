import { InjuryBadge } from "../InjuryBadge";
import { PositionBadge } from "../PositionBadge";
import type { EditorPlayer } from "../ranking-editor-logic";

/** Position badge, name and team — shared by sortable rows and the drag
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
      <PositionBadge position={player.position} />
      <span
        className="ranking-editor__name"
        title={showNameTitle ? player.fullName : undefined}
      >
        {player.fullName}
      </span>
      <InjuryBadge status={player.injuryStatus} />
      <span className="ranking-editor__meta">{player.team}</span>
    </>
  );
}
