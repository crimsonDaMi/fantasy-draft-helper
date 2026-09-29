import { useCallback, useEffect, useRef } from "react";
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
  /** Roving tabindex: only the container's current row is a tab stop. */
  isTabStop: boolean;
  /** Focuses the row once it's mounted, then calls `onFocused`. */
  shouldFocus: boolean;
  onFocused: () => void;
  onFocus: () => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLLIElement>) => void;
  /** Shows watch/avoid toggles (ranked rows only). */
  onFlagChange?: (sleeperId: string, flag: PlayerFlag | null) => void;
  /** Tap handler (phones only: opens the move menu). */
  onSelect?: (sleeperId: string) => void;
}

export function SortablePlayer({
  player,
  rank,
  offsetTop,
  isTabStop,
  shouldFocus,
  onFocused,
  onFocus,
  onKeyDown,
  onFlagChange,
  onSelect,
}: SortablePlayerProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: player.sleeperId });
  const nodeRef = useRef<HTMLLIElement | null>(null);

  const setRef = useCallback(
    (node: HTMLLIElement | null) => {
      nodeRef.current = node;
      setNodeRef(node);
    },
    [setNodeRef],
  );

  useEffect(() => {
    if (shouldFocus) {
      nodeRef.current?.focus();
      onFocused();
    }
  }, [shouldFocus, onFocused]);

  const style: React.CSSProperties = {
    position: "absolute",
    top: offsetTop,
    left: 0,
    right: 0,
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
    touchAction: "manipulation",
  };

  return (
    <li
      ref={setRef}
      style={style}
      className={player.flag ? `flagged--${player.flag}` : undefined}
      {...attributes}
      {...listeners}
      tabIndex={isTabStop ? 0 : -1}
      aria-label={[
        rank === undefined ? player.fullName : `#${rank} ${player.fullName}`,
        player.position,
        player.team,
      ]
        .filter(Boolean)
        .join(", ")}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
      onClick={onSelect ? () => onSelect(player.sleeperId) : undefined}
    >
      {rank !== undefined && (
        <span className="ranking-editor__rank">#{rank}</span>
      )}
      <PlayerLabel player={player} showNameTitle />
      {onFlagChange && (
        <FlagButtons
          playerName={player.fullName}
          flag={player.flag}
          tabIndex={isTabStop ? undefined : -1}
          onChange={(flag) => onFlagChange(player.sleeperId, flag)}
        />
      )}
    </li>
  );
}
