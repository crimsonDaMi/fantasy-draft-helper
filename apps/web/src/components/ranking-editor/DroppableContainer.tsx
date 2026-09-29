import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useVirtualizer } from "@tanstack/react-virtual";

import type { PlayerFlag } from "../../types/api";
import {
  PLAYER_ROW_HEIGHT,
  withForcedRows,
  type EditorPlayer,
  type KeyboardMove,
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
  /** The row the page wants focused next (keyboard navigation or a move). */
  focusRequestId?: string;
  onRequestFocus: (sleeperId: string) => void;
  onFocusHandled: () => void;
  /** Enter/Space on a row. */
  onOpenMenu: (sleeperId: string) => void;
  /** Alt+arrow/Home/End on a row (ranked tiers only). */
  onKeyboardMove?: (sleeperId: string, direction: KeyboardMove) => void;
}

const MOVE_KEYS: Record<string, KeyboardMove> = {
  ArrowUp: "up",
  ArrowDown: "down",
  Home: "top",
  End: "bottom",
};

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
  focusRequestId,
  onRequestFocus,
  onFocusHandled,
  onOpenMenu,
  onKeyboardMove,
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

  // Roving tabindex: one tab stop per container, falling back to the
  // first row when the current one is filtered out or moved away.
  const [currentId, setCurrentId] = useState<string>();
  const tabStopId = players.some((player) => player.sleeperId === currentId)
    ? currentId
    : players[0]?.sleeperId;

  // React restores focus to a row it merely moves, but not to one it
  // re-creates: a server resync that lands mid-way through several quick
  // keyboard moves can put the focused player back in the tier it just
  // left, remounting the row there and dropping focus to <body>. Note which
  // player has focus before the commit (read during render, so before the
  // DOM changes) and, if they're in this container, focus their row again.
  const focusedRowId = (
    document.activeElement?.closest("[data-sleeper-id]") as HTMLElement | null
  )?.dataset.sleeperId;
  const restoreFocusId = players.some(
    (player) => player.sleeperId === focusedRowId,
  )
    ? focusedRowId
    : undefined;

  useLayoutEffect(() => {
    if (!restoreFocusId || document.activeElement !== document.body) {
      return;
    }
    const rows =
      scrollElementRef.current?.querySelectorAll<HTMLElement>(
        "[data-sleeper-id]",
      ) ?? [];
    for (const row of rows) {
      if (row.dataset.sleeperId === restoreFocusId) {
        row.focus({ preventScroll: true });
        return;
      }
    }
  });

  // Keeps the dragged and the focused rows mounted when they scroll out.
  const virtualRows = withForcedRows(virtualizer.getVirtualItems(), players, [
    activeId,
    tabStopId,
    focusRequestId,
    restoreFocusId,
  ]);

  function handleRowKeyDown(
    event: React.KeyboardEvent<HTMLLIElement>,
    index: number,
  ) {
    // Keys on the row's own ★/⊘ buttons are theirs.
    if (event.target !== event.currentTarget) {
      return;
    }
    const sleeperId = players[index].sleeperId;
    const move = MOVE_KEYS[event.key];

    if (move && event.altKey) {
      if (onKeyboardMove) {
        event.preventDefault();
        onKeyboardMove(sleeperId, move);
      }
      return;
    }
    if (event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }

    let targetIndex: number | undefined;
    if (move === "up") {
      targetIndex = Math.max(index - 1, 0);
    } else if (move === "down") {
      targetIndex = Math.min(index + 1, players.length - 1);
    } else if (move === "top") {
      targetIndex = 0;
    } else if (move === "bottom") {
      targetIndex = players.length - 1;
    }

    if (targetIndex !== undefined) {
      event.preventDefault();
      onRequestFocus(players[targetIndex].sleeperId);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpenMenu(sleeperId);
    }
  }

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
                  isTabStop={player.sleeperId === tabStopId}
                  shouldFocus={player.sleeperId === focusRequestId}
                  onFocused={onFocusHandled}
                  onFocus={() => setCurrentId(player.sleeperId)}
                  onKeyDown={(event) =>
                    handleRowKeyDown(event, virtualRow.index)
                  }
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
