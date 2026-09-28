import type { ApiRecommendation } from "../types/api";
import { InjuryBadge } from "./InjuryBadge";
import { PositionBadge } from "./PositionBadge";

interface RecommendationsListProps {
  recommendations: ApiRecommendation[];
}

function PlayerMeta({ recommendation }: { recommendation: ApiRecommendation }) {
  return (
    <>
      {recommendation.player.team}
      {recommendation.tier && ` · Tier ${recommendation.tier}`}
      {recommendation.adp && (
        <>
          {" · "}
          <AdpBadge recommendation={recommendation} />
        </>
      )}
    </>
  );
}

function AdpBadge({ recommendation }: { recommendation: ApiRecommendation }) {
  if (!recommendation.adp) {
    return null;
  }

  const { diff } = recommendation.adp;
  const rounded = Math.abs(diff).toFixed(1);

  const variant =
    diff > 1
      ? "adp-diff--value"
      : diff < -1
        ? "adp-diff--reach"
        : "adp-diff--neutral";

  return (
    <span className={`adp-diff ${variant}`}>
      {diff >= 0 ? "▼" : "▲"} {rounded} ADP
    </span>
  );
}

export function RecommendationsList({
  recommendations,
}: RecommendationsListProps) {
  if (recommendations.length === 0) {
    return (
      <section>
        <p className="rec-list__empty">No recommendations available yet.</p>
      </section>
    );
  }

  const [topPick, ...rest] = recommendations;

  return (
    <section>
      <div className="hero">
        <span className="hero__rank">#{topPick.rank}</span>
        <div className="hero__body">
          <span className="hero__title">
            <PositionBadge position={topPick.player.position} />
            <span className="hero__name">{topPick.player.fullName}</span>
            <InjuryBadge status={topPick.player.injuryStatus} />
          </span>
          <span className="hero__meta">
            <PlayerMeta recommendation={topPick} />
          </span>
        </div>
      </div>

      {rest.length > 0 && (
        <ol className="rec-list">
          {rest.map((recommendation) => (
            <li className="rec-list__row" key={recommendation.player.sleeperId}>
              <span className="rec-list__rank">#{recommendation.rank}</span>
              <PositionBadge position={recommendation.player.position} />
              <span className="rec-list__name">
                {recommendation.player.fullName}{" "}
                <InjuryBadge status={recommendation.player.injuryStatus} />
              </span>
              <span className="rec-list__meta">
                <PlayerMeta recommendation={recommendation} />
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
