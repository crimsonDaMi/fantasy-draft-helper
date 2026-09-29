import { useCallback, useRef } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useVirtualizer } from "@tanstack/react-virtual";

import type { PlayerFlag } from "../../types/api";
import {
  PLAYER_ROW_HEIGHT,
  withForcedActiveRow,
  type EditorPlayer,
} from "../ranking-editor-logic";
import { SortablePlayer } from "./SortablePlayer";

interface TierRemoveControl {
  canRemove: boolean;
  /** Players in the tier, ignoring any position filter on `players`. */
  playerCount: number;
  /** The last (worst) tier merges into the tier above, not the next one. */
  isLastTier: boolean;
  isConfirming: boolean;
  isPending: boolean;
  onRequestRemove: () => void;
  onConfirmRemove: () => void;
  onCancelRemove: () => void;
}

interface DroppableContainerProps {
  id: string;
  title: string;
  players: EditorPlayer[];
  showRank: boolean;
  className: string;
  removeControl?: TierRemoveControl;
  activeId?: string;
  registerScrollElement?: (id: string, node: HTMLDivElement | null) => void;
  onFlagChange?: (sleeperId: string, flag: PlayerFlag | null) => void;
  onSelectPlayer?: (sleeperId: string) => void;
}

export function DroppableContainer({
  id,
  title,
  players,
  showRank,
  className,
  removeControl,
  activeId,
  registerScrollElement,
  onFlagChange,
  onSelectPlayer,
}: DroppableContainerProps) {
  const { setNodeRef } = useDroppable({ id });
  const scrollElementRef = useRef<HTMLDivElement>(null);

  const setScrollRef = useCallback(
    (node: HTMLDivElement | null) => {
      scrollElementRef.current = node;
      setNodeRef(node);
      registerScrollElement?.(id, node);
    },
    [setNodeRef, registerScrollElement, id],
  );

  // eslint-disable-next-line react-hooks/incompatible-library -- @tanstack/react-virtual's API is inherently incompatible with React Compiler memoization; harmless since Compiler isn't enabled in this project.
  const virtualizer = useVirtualizer({
    count: players.length,
    getScrollElement: () => scrollElementRef.current,
    estimateSize: () => PLAYER_ROW_HEIGHT,
    overscan: 8,
  });

  const virtualRows = withForcedActiveRow(
    virtualizer.getVirtualItems(),
    players,
    activeId,
  );

  return (
    <div className={className}>
      <div className="ranking-editor__tier-header">
        <h3>{title}</h3>
        {removeControl?.canRemove &&
          (removeControl.isConfirming ? (
            <span className="ranking-editor__tier-confirm">
              <span>
                Merge {removeControl.playerCount} player(s) into the{" "}
                {removeControl.isLastTier ? "tier above" : "next tier"}?
              </span>
              <button
                type="button"
                onClick={removeControl.onConfirmRemove}
                disabled={removeControl.isPending}
              >
                Confirm
              </button>
              <button type="button" onClick={removeControl.onCancelRemove}>
                Cancel
              </button>
            </span>
          ) : (
            <button
              type="button"
              className="ranking-editor__tier-remove"
              onClick={removeControl.onRequestRemove}
            >
              Remove tier
            </button>
          ))}
      </div>
      <SortableContext
        items={players.map((player) => player.sleeperId)}
        strategy={verticalListSortingStrategy}
      >
        <div ref={setScrollRef} className="ranking-editor__player-list">
          {players.length === 0 && (
            <p className="ranking-editor__empty-hint">Drop players here</p>
          )}
          <ol
            className="ranking-editor__player-list-inner"
            style={{ height: virtualizer.getTotalSize() }}
          >
            {virtualRows.map((virtualRow) => {
              const player = players[virtualRow.index];
              if (!player) {
                return null;
              }
              return (
                <SortablePlayer
                  key={player.sleeperId}
                  player={player}
                  rank={showRank ? player.globalRank : undefined}
                  offsetTop={virtualRow.start}
                  onFlagChange={onFlagChange}
                  onSelect={onSelectPlayer}
                />
              );
            })}
          </ol>
        </div>
      </SortableContext>
    </div>
  );
}
