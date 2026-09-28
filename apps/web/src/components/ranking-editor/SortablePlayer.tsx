import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import type { PlayerFlag } from "../../types/api";
import { FlagButtons } from "../FlagButtons";
import type { EditorPlayer } from "../ranking-editor-logic";
import { PlayerLabel } from "./PlayerLabel";

interface SortablePlayerProps {
  player: EditorPlayer;
  rank?: number;
  offsetTop: number;
  /** Shows watch/avoid toggles (ranked rows only). */
  onFlagChange?: (sleeperId: string, flag: PlayerFlag | null) => void;
}

export function SortablePlayer({
  player,
  rank,
  offsetTop,
  onFlagChange,
}: SortablePlayerProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: player.sleeperId });

  const style: React.CSSProperties = {
    position: "absolute",
    top: offsetTop,
    left: 0,
    right: 0,
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
    touchAction: "none",
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={player.flag ? `flagged--${player.flag}` : undefined}
      {...attributes}
      {...listeners}
    >
      {rank !== undefined && (
        <span className="ranking-editor__rank">#{rank}</span>
      )}
      <PlayerLabel player={player} showNameTitle />
      {onFlagChange && (
        <FlagButtons
          playerName={player.fullName}
          flag={player.flag}
          onChange={(flag) => onFlagChange(player.sleeperId, flag)}
        />
      )}
    </li>
  );
}
