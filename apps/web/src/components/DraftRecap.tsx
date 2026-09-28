import type { ApiDraftInfo, ApiDraftPick } from "../types/api";
import { formatPick } from "../utils/draft-order";
import { toRecapCsv } from "../utils/recap-csv";
import { RosterNeeds } from "./MyTeamPanel";
import { PositionBadge } from "./PositionBadge";

function downloadCsv(csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "draft-recap.csv";
  link.click();
  URL.revokeObjectURL(url);
}

/** Positive when the player came later than you ranked (or than ADP). */
function Value({ diff }: { diff?: number }) {
  if (diff === undefined) {
    return <td />;
  }

  const rounded = Math.round(diff * 10) / 10;
  const variant =
    rounded > 0
      ? "adp-diff--value"
      : rounded < 0
        ? "adp-diff--reach"
        : "adp-diff--neutral";

  return (
    <td className={`adp-diff ${variant}`}>
      {rounded > 0 ? "+" : ""}
      {rounded}
    </td>
  );
}

interface DraftRecapProps {
  draft: ApiDraftInfo;
  myPicks: ApiDraftPick[];
}

export function DraftRecap({ draft, myPicks }: DraftRecapProps) {
  const picks = [...myPicks].sort((a, b) => a.pickNo - b.pickNo);

  return (
    <section className="draft-recap" aria-labelledby="draft-recap-heading">
      <div className="draft-recap__header">
        <h2 id="draft-recap-heading">Draft recap</h2>
        {picks.length > 0 && (
          <button
            type="button"
            onClick={() => downloadCsv(toRecapCsv(picks, draft.teams))}
          >
            Download CSV
          </button>
        )}
      </div>

      {picks.length === 0 ? (
        <p className="rec-list__empty">
          Choose your draft slot under "My team" to see your picks.
        </p>
      ) : (
        <>
          <table className="draft-recap__table">
            <thead>
              <tr>
                <th>Pick</th>
                <th>Player</th>
                <th>Your rank</th>
                <th title="Pick number minus your rank">vs. rank</th>
                <th>ADP</th>
                <th title="Pick number minus ADP">vs. ADP</th>
              </tr>
            </thead>
            <tbody>
              {picks.map((pick) => (
                <tr key={pick.pickNo}>
                  <td>{formatPick(pick.pickNo, draft.teams)}</td>
                  <td>
                    <span className="draft-recap__player">
                      <PositionBadge position={pick.position} />
                      {pick.playerName ?? pick.playerId}
                    </span>
                  </td>
                  <td>{pick.rank === undefined ? "–" : `#${pick.rank}`}</td>
                  <Value
                    diff={
                      pick.rank === undefined
                        ? undefined
                        : pick.pickNo - pick.rank
                    }
                  />
                  <td>{pick.adp === undefined ? "–" : pick.adp.toFixed(1)}</td>
                  <Value
                    diff={
                      pick.adp === undefined
                        ? undefined
                        : pick.pickNo - pick.adp
                    }
                  />
                </tr>
              ))}
            </tbody>
          </table>
          <RosterNeeds myPicks={picks} rosterSlots={draft.rosterSlots} />
        </>
      )}
    </section>
  );
}
