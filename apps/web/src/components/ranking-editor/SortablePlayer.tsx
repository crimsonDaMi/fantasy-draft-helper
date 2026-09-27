import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import type { EditorPlayer } from "../ranking-editor-logic";
import { PlayerLabel } from "./PlayerLabel";

interface SortablePlayerProps {
  player: EditorPlayer;
  rank?: number;
  offsetTop: number;
}

export function SortablePlayer({
  player,
  rank,
  offsetTop,
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
    <li ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {rank !== undefined && (
        <span className="ranking-editor__rank">#{rank}</span>
      )}
      <PlayerLabel player={player} showNameTitle />
    </li>
  );
}
