import type { ApiRecommendation, PlayerFlag } from "../types/api";
import { FlagButtons } from "./FlagButtons";
import { InfoTipButton, InfoTipPanel } from "./InfoTip";
import { useInfoTip } from "../hooks/useInfoTip";
import { InjuryBadge } from "./InjuryBadge";
import { PositionBadge } from "./PositionBadge";

interface RecommendationsListProps {
  recommendations: ApiRecommendation[];
  /** ADP format the badges compare against, e.g. `1QB PPR`. */
  adpFormat: string;
  /** Omit to render the list without watch/avoid controls. */
  onFlagChange?: (sleeperId: string, flag: PlayerFlag | null) => void;
}

function flagClass(recommendation: ApiRecommendation): string {
  return recommendation.flag ? ` flagged--${recommendation.flag}` : "";
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
  adpFormat,
  onFlagChange,
}: RecommendationsListProps) {
  const legend = useInfoTip();
  const flagButtons = (recommendation: ApiRecommendation) =>
    onFlagChange && (
      <FlagButtons
        playerName={recommendation.player.fullName}
        flag={recommendation.flag}
        onChange={(flag) => onFlagChange(recommendation.player.sleeperId, flag)}
      />
    );

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
      <div className={`hero${flagClass(topPick)}`}>
        <span className="hero__rank">#{topPick.rank}</span>
        <div className="hero__body">
          <span className="hero__title">
            <PositionBadge position={topPick.player.position} />
            <span className="hero__name">{topPick.player.fullName}</span>
            <InjuryBadge status={topPick.player.injuryStatus} />
            {flagButtons(topPick)}
          </span>
          <span className="hero__meta">
            <PlayerMeta recommendation={topPick} />
          </span>
        </div>
        <span className="hero__info">
          <InfoTipButton
            label="About these recommendations"
            {...legend.buttonProps}
          />
        </span>
      </div>
      <InfoTipPanel id={legend.panelId} open={legend.open}>
        <ul className="info-tip__list">
          {onFlagChange && (
            <li>
              ★ watch a player (highlighted) · ⊘ avoid (hidden from the
              recommendations)
            </li>
          )}
          <li>
            <span className="adp-diff adp-diff--value">▼ ADP</span>: others
            draft the player that many picks earlier than your rank — a value
            while still available.
          </li>
          <li>
            <span className="adp-diff adp-diff--reach">▲ ADP</span>: others
            draft the player later than your rank — likely still available
            later.
          </li>
          <li>ADP is {adpFormat} ADP from Sleeper, matching this draft.</li>
          <li>
            Injury: Q questionable · D doubtful · O out · IR injured reserve
          </li>
        </ul>
      </InfoTipPanel>

      {rest.length > 0 && (
        <ol className="rec-list">
          {rest.map((recommendation) => (
            <li
              className={`rec-list__row${flagClass(recommendation)}`}
              key={recommendation.player.sleeperId}
            >
              <span className="rec-list__rank">#{recommendation.rank}</span>
              <PositionBadge position={recommendation.player.position} />
              <span className="rec-list__name">
                {recommendation.player.fullName}{" "}
                <InjuryBadge status={recommendation.player.injuryStatus} />
              </span>
              <span className="rec-list__meta">
                <PlayerMeta recommendation={recommendation} />
              </span>
              {flagButtons(recommendation)}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
