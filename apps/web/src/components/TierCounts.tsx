import type { ApiPositionTierCounts } from "../types/api";
import { PositionBadge } from "./PositionBadge";

const HINT =
  "Players still available in the two best remaining tiers of your ranking, per position. For example, “B: 2” means two players from your tier B are left.";

/** Players left in the best remaining tiers of your ranking, per
 * position — counts only, it doesn't reorder anything. */
export function TierCounts({ counts }: { counts: ApiPositionTierCounts[] }) {
  if (counts.length === 0) {
    return null;
  }

  return (
    <div className="tier-counts" title={HINT}>
      <span className="tier-counts__label">
        Left in your top tiers <span aria-hidden="true">ⓘ</span>
        <span className="visually-hidden">: {HINT}</span>
      </span>
      {counts.map(({ position, tiers }) => (
        <span key={position} className="tier-counts__position">
          <PositionBadge position={position} />
          {tiers.map(({ tier, remaining }) => (
            <span key={tier} className="tier-counts__tier">
              {tier}: {remaining}
            </span>
          ))}
        </span>
      ))}
    </div>
  );
}
