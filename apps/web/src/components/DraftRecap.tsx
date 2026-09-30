import type { ApiDraftInfo, ApiDraftPick } from "../types/api";
import { formatPick } from "../utils/draft-order";
import { toRecapCsv } from "../utils/recap-csv";
import { InfoTipButton, InfoTipPanel } from "./InfoTip";
import { useInfoTip } from "../hooks/useInfoTip";
import { RosterNeeds } from "./RosterNeeds";
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
  /** ADP format of the ADP column, e.g. `1QB PPR`. */
  adpFormat: string;
  myPicks: ApiDraftPick[];
}

export function DraftRecap({ draft, adpFormat, myPicks }: DraftRecapProps) {
  const picks = [...myPicks].sort((a, b) => a.pickNo - b.pickNo);
  const { open, panelId, buttonProps } = useInfoTip();

  return (
    <section className="draft-recap" aria-labelledby="draft-recap-heading">
      <div className="draft-recap__header">
        <span className="draft-recap__title">
          <h2 id="draft-recap-heading">Draft recap</h2>
          {picks.length > 0 && (
            <InfoTipButton label="About the recap columns" {...buttonProps} />
          )}
        </span>
        {picks.length > 0 && (
          <button
            type="button"
            onClick={() => downloadCsv(toRecapCsv(picks, draft.teams))}
          >
            Download CSV
          </button>
        )}
      </div>
      <InfoTipPanel id={panelId} open={open && picks.length > 0}>
        <p>
          vs. rank: pick number minus your rank. Positive means you got the
          player later than you ranked them (a steal); negative, earlier (a
          reach).
        </p>
        <p>vs. ADP: the same, measured against {adpFormat} ADP.</p>
      </InfoTipPanel>

      {picks.length === 0 ? (
        <p className="rec-list__empty">
          Choose your draft slot under "My team" to see your picks.
        </p>
      ) : (
        <>
          {/* Scrolls on its own on narrow screens instead of the page. */}
          <div className="draft-recap__scroll">
            <table className="draft-recap__table">
              <thead>
                <tr>
                  <th>Pick</th>
                  <th>Player</th>
                  <th>Your rank</th>
                  <th title="Pick number minus your rank">vs. rank</th>
                  <th>ADP ({adpFormat})</th>
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
                    <td>
                      {pick.adp === undefined ? "–" : pick.adp.toFixed(1)}
                    </td>
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
          </div>
          <RosterNeeds myPicks={picks} rosterSlots={draft.rosterSlots} />
        </>
      )}
    </section>
  );
}
