import type { ApiDraftPick } from "../types/api";
import { formatPick, positionalRun } from "../utils/draft-order";
import { PositionBadge } from "./PositionBadge";

const RECENT_PICK_COUNT = 10;
const RUN_WINDOW = 8;

interface RecentPicksProps {
  picks: ApiDraftPick[];
  teams?: number;
}

/** A pick taken a full round (or more) away from where you ranked the
 * player: earlier is a reach, later a steal. */
function RankComparison({
  pick,
  threshold,
}: {
  pick: ApiDraftPick;
  threshold: number;
}) {
  if (pick.rank === undefined) {
    return <span className="recent-picks__rank">unranked</span>;
  }

  const diff = pick.pickNo - pick.rank;
  const variant =
    diff >= threshold
      ? "adp-diff--value"
      : diff <= -threshold
        ? "adp-diff--reach"
        : undefined;

  return (
    <span className="recent-picks__rank">
      your #{pick.rank}
      {variant && (
        <span className={`adp-diff ${variant}`}>
          {" "}
          {variant === "adp-diff--value" ? "steal" : "reach"}
        </span>
      )}
    </span>
  );
}

export function RecentPicks({ picks, teams }: RecentPicksProps) {
  const recent = [...picks]
    .sort((a, b) => b.pickNo - a.pickNo)
    .slice(0, RECENT_PICK_COUNT);
  const run = positionalRun(picks, RUN_WINDOW);
  const threshold = teams ?? 12;

  return (
    <section
      className="side-panel recent-picks"
      aria-labelledby="recent-picks-heading"
    >
      <div className="side-panel__header">
        <h2 id="recent-picks-heading">Recent picks</h2>
      </div>

      {recent.length === 0 ? (
        <p className="side-panel__empty">No picks yet.</p>
      ) : (
        <>
          {run.length > 0 && (
            <p className="recent-picks__run">
              Last {Math.min(RUN_WINDOW, picks.length)}:{" "}
              {run
                .map(({ position, count }) => `${position} ${count}`)
                .join(" · ")}
            </p>
          )}
          <ol className="recent-picks__list">
            {recent.map((pick) => (
              <li key={pick.pickNo} className="recent-picks__row">
                <span className="recent-picks__pick">
                  {formatPick(pick.pickNo, teams)}
                </span>
                <PositionBadge position={pick.position} />
                <span className="recent-picks__name">
                  {pick.playerName ?? pick.playerId}
                </span>
                <RankComparison pick={pick} threshold={threshold} />
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}
