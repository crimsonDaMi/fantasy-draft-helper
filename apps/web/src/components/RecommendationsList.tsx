import type { ReactNode } from "react";

import type { ApiDraftPick, ApiRecommendation, PlayerFlag } from "../types/api";
import { FlagButtons } from "./FlagButtons";
import { InfoTipButton, InfoTipPanel } from "./InfoTip";
import { useInfoTip } from "../hooks/useInfoTip";
import { InjuryBadge } from "./InjuryBadge";
import { LastInTierBadge } from "./LastInTierBadge";
import { PositionBadge } from "./PositionBadge";
import { RookieBadge } from "./RookieBadge";
import { StackBadge } from "./StackBadge";
import { formatPositionRank } from "../utils/position-rank";
import { stackPartners } from "../utils/stacks";

interface RecommendationsListProps {
  recommendations: ApiRecommendation[];
  /** ADP format the badges compare against, e.g. `1QB PPR`. */
  adpFormat: string;
  /** Shows every row's note, instead of behind its ✎ toggle. */
  showAllNotes?: boolean;
  /** The user's picks so far, for the stack badges. */
  myPicks?: ApiDraftPick[];
  /** Omit to render the list without watch/avoid controls. */
  onFlagChange?: (sleeperId: string, flag: PlayerFlag | null) => void;
}

function flagClass(recommendation: ApiRecommendation): string {
  return recommendation.flag ? ` flagged--${recommendation.flag}` : "";
}

function PlayerMeta({ recommendation }: { recommendation: ApiRecommendation }) {
  const { position } = recommendation.player;
  const positionRank = formatPositionRank(
    position,
    recommendation.positionRank,
  );
  const adpPositionRank = formatPositionRank(
    position,
    recommendation.adp?.positionRank,
  );

  return (
    <>
      {recommendation.player.team}
      {recommendation.player.age !== undefined &&
        ` · Age ${recommendation.player.age}`}
      {positionRank && ` · ${positionRank}`}
      {recommendation.tier && (
        <>
          {` · Tier ${recommendation.tier}`}
          {/* Non-breaking, so "Last" stays on the tier's line. */}
          {recommendation.lastInTier && " "}
          <LastInTierBadge
            lastInTier={recommendation.lastInTier}
            position={position}
            tier={recommendation.tier}
          />
        </>
      )}
      {recommendation.bye !== undefined && ` · Bye ${recommendation.bye}`}
      {recommendation.adp && (
        <>
          {" · "}
          <AdpBadge recommendation={recommendation} />
        </>
      )}
      {/* Non-breaking, so the wrapped phone meta line keeps "ADP WR15"
          together. */}
      {adpPositionRank && ` · ADP ${adpPositionRank}`}
    </>
  );
}

/** A list row's note, behind a ✎ toggle (unless `showNote`) so rows
 * without one stay as they are; the top pick shows its note outright. */
function RecommendationRow({
  recommendation,
  showNote,
  flagButtons,
  myPicks,
}: {
  recommendation: ApiRecommendation;
  showNote: boolean;
  flagButtons: ReactNode;
  myPicks: ApiDraftPick[];
}) {
  const noteTip = useInfoTip();
  const { note } = recommendation;

  return (
    <li className={`rec-list__row${flagClass(recommendation)}`}>
      <span className="rec-list__rank">#{recommendation.rank}</span>
      <PositionBadge position={recommendation.player.position} />
      <span className="rec-list__name">
        {recommendation.player.fullName}{" "}
        <RookieBadge rookie={recommendation.player.rookie} />
        <InjuryBadge status={recommendation.player.injuryStatus} />
        <StackBadge
          team={recommendation.player.team}
          partners={stackPartners(recommendation.player, myPicks)}
        />
        {note && !showNote && (
          <button
            type="button"
            className="info-tip__button"
            aria-label={`Note on ${recommendation.player.fullName}`}
            title={note}
            {...noteTip.buttonProps}
          >
            ✎
          </button>
        )}
      </span>
      <span className="rec-list__meta">
        <PlayerMeta recommendation={recommendation} />
      </span>
      {flagButtons}
      {note && (
        <InfoTipPanel id={noteTip.panelId} open={showNote || noteTip.open}>
          <p className="player-note">{note}</p>
        </InfoTipPanel>
      )}
    </li>
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
  showAllNotes = false,
  myPicks = [],
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
            <RookieBadge rookie={topPick.player.rookie} />
            <InjuryBadge status={topPick.player.injuryStatus} />
            <StackBadge
              team={topPick.player.team}
              partners={stackPartners(topPick.player, myPicks)}
            />
            {flagButtons(topPick)}
          </span>
          <span className="hero__meta">
            <PlayerMeta recommendation={topPick} />
          </span>
          {topPick.note && (
            <span className="hero__note player-note">{topPick.note}</span>
          )}
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
          <li>
            WR12: the player's place among their position in your ranking · ADP
            WR15: the same by ADP
          </li>
          <li>
            <span className="last-in-tier-badge">Last</span>: the last player of
            their position left in that tier of your ranking.
          </li>
          <li>Bye: the player's bye week, from your ranking CSV.</li>
          <li>
            <span className="stack-badge">Stack</span>: shares an NFL team with
            a QB, WR or TE you drafted (QB with WR/TE).
          </li>
          <li>
            ✎ shows your note on the player, from your ranking ("Show all notes"
            opens every one).
          </li>
          <li>
            <span className="rookie-badge">R</span> rookie · Age: the player's
            age, from Sleeper
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
            <RecommendationRow
              key={recommendation.player.sleeperId}
              recommendation={recommendation}
              showNote={showAllNotes}
              flagButtons={flagButtons(recommendation)}
              myPicks={myPicks}
            />
          ))}
        </ol>
      )}
    </section>
  );
}
