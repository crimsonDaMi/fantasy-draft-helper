import { useCallback } from "react";

import type { RankingTierDto } from "../../types/api";
import {
  UNRANKED_CONTAINER,
  formatTierHeading,
  type EditorPlayer,
  type TierDisplayMode,
} from "../ranking-editor-logic";

interface PlayerMoveMenuProps {
  player: EditorPlayer;
  /** The tier label the player is in, or `UNRANKED_CONTAINER`. */
  currentContainer: string;
  tiers: RankingTierDto[];
  tierDisplayMode: TierDisplayMode;
  onMoveToTier: (tier: string) => void;
  onRemove: () => void;
  onClose: () => void;
}

/** Phone replacement for dragging between far-apart containers: a bottom
 * sheet that moves the tapped player to the end of a tier, or out of the
 * ranking. A native modal <dialog> gives focus trapping and Escape. */
export function PlayerMoveMenu({
  player,
  currentContainer,
  tiers,
  tierDisplayMode,
  onMoveToTier,
  onRemove,
  onClose,
}: PlayerMoveMenuProps) {
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

  return (
    <dialog
      ref={openDialog}
      className="ranking-editor__move-menu"
      aria-label={`Move ${player.fullName}`}
      onClose={onClose}
      // A click on the dialog itself (not its content) is on the backdrop.
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="ranking-editor__move-menu-content">
        <h3>{player.fullName}</h3>
        <p className="ranking-editor__move-menu-label">Move to the end of</p>
        <div className="ranking-editor__move-menu-tiers">
          {tiers.map((tier) => (
            <button
              key={tier.label}
              type="button"
              aria-current={tier.label === currentContainer || undefined}
              onClick={() => onMoveToTier(tier.label)}
            >
              {formatTierHeading(tier.label, tier.position, tierDisplayMode)}
            </button>
          ))}
        </div>
        {currentContainer !== UNRANKED_CONTAINER && (
          <button
            type="button"
            className="ranking-editor__move-menu-remove"
            onClick={onRemove}
          >
            Remove from ranking
          </button>
        )}
        <button
          type="button"
          className="ranking-editor__move-menu-cancel"
          onClick={onClose}
        >
          Cancel
        </button>
      </div>
    </dialog>
  );
}
