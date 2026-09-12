import type {
  ApiRecommendation,
} from "../types/api";

interface RecommendationsListProps {
  recommendations: ApiRecommendation[];
}

function PlayerMeta({
  recommendation,
}: {
  recommendation: ApiRecommendation;
}) {
  return (
    <>
      {recommendation.player.position}
      {" · "}
      {recommendation.player.team}
      {recommendation.tier && ` · Tier ${recommendation.tier}`}
    </>
  );
}

function AdpBadge({
  recommendation,
}: {
  recommendation: ApiRecommendation;
}) {
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
        <p className="rec-list__empty">
          No recommendations available yet.
        </p>
      </section>
    );
  }

  const [topPick, ...rest] = recommendations;

  return (
    <section>
      <div className="hero">
        <span className="hero__rank">#{topPick.rank}</span>
        <div className="hero__body">
          <span className="hero__name">{topPick.player.fullName}</span>
          <span className="hero__meta">
            <PlayerMeta recommendation={topPick} />
            {topPick.adp && (
              <>
                {" · "}
                <AdpBadge recommendation={topPick} />
              </>
            )}
          </span>
        </div>
      </div>

      {rest.length > 0 && (
        <ol className="rec-list">
          {rest.map((recommendation) => (
            <li className="rec-list__row" key={recommendation.player.sleeperId}>
              <span className="rec-list__rank">#{recommendation.rank}</span>
              <span className="rec-list__name">
                {recommendation.player.fullName}
              </span>
              <span className="rec-list__meta">
                <PlayerMeta recommendation={recommendation} />
                {recommendation.adp && (
                  <>
                    {" · "}
                    <AdpBadge recommendation={recommendation} />
                  </>
                )}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}