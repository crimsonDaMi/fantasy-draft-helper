import type { ApiDraftInfo, ApiDraftPick, DraftStatus } from "../types/api";
import { auctionBudget, formatPick, nextPickFor } from "../utils/draft-order";
import { POSITIONS } from "../utils/positions";
import { PositionBadge } from "./PositionBadge";
import { RosterNeeds } from "./RosterNeeds";

interface MyTeamPanelProps {
  draft: ApiDraftInfo;
  draftStatus: DraftStatus;
  currentPickNo: number;
  /** Undefined until the user's slot is known or chosen. */
  slot?: number;
  /** Whether the slot came from Sleeper's draft order (not changeable). */
  slotFromSleeper: boolean;
  myPicks: ApiDraftPick[];
  onSlotChange: (slot: number) => void;
  /** Collapsed to the heading and next pick until opened (phones). */
  collapsible?: boolean;
}

function NextPickLine({
  draft,
  slot,
  currentPickNo,
}: {
  draft: ApiDraftInfo;
  slot: number;
  currentPickNo: number;
}) {
  const next = nextPickFor(slot, currentPickNo, draft);

  if (!next) {
    return null;
  }

  const label = `${formatPick(next.pickNo, draft.teams)}${next.traded ? ", traded" : ""}`;

  return (
    <p
      className={`my-team__next${next.picksUntil === 0 ? " my-team__next--now" : ""}`}
    >
      {next.picksUntil === 0
        ? `You're on the clock (${label})`
        : `You pick in ${next.picksUntil} (${label})`}
    </p>
  );
}

function BudgetLine({
  draft,
  myPicks,
}: {
  draft: ApiDraftInfo;
  myPicks: ApiDraftPick[];
}) {
  const budget = auctionBudget(draft, myPicks);

  if (!budget) {
    return null;
  }

  return (
    <p className="my-team__next">
      ${budget.left} of ${budget.budget} left
      {budget.maxBid !== undefined && ` · max bid $${budget.maxBid}`}
    </p>
  );
}

/** The user's own draft: when they pick next, who they've drafted, and
 * how that fills the lineup. Purely informational. */
export function MyTeamPanel({
  draft,
  draftStatus,
  currentPickNo,
  slot,
  slotFromSleeper,
  myPicks,
  onSlotChange,
  collapsible = false,
}: MyTeamPanelProps) {
  const teams = draft.teams ?? 0;
  const canPickSlot = !slotFromSleeper && teams > 0;
  const showNextPick = slot !== undefined && draftStatus !== "COMPLETE";

  const heading = <h2 id="my-team-heading">My team</h2>;
  const slotSelect = canPickSlot && (
    <label className="my-team__slot">
      Slot{" "}
      <select
        value={slot ?? ""}
        onChange={(event) => onSlotChange(Number(event.target.value))}
      >
        {slot === undefined && <option value="">–</option>}
        {Array.from({ length: teams }, (_, index) => index + 1).map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </select>
    </label>
  );
  // Auctions have no pick order; their headline is the budget instead.
  const nextPick =
    showNextPick &&
    (draft.type === "auction" ? (
      <BudgetLine draft={draft} myPicks={myPicks} />
    ) : (
      <NextPickLine draft={draft} slot={slot} currentPickNo={currentPickNo} />
    ));
  const body =
    slot === undefined ? (
      <p className="side-panel__empty">
        {canPickSlot
          ? "Choose your draft slot to follow your picks."
          : "Your draft slot isn't known yet."}
      </p>
    ) : (
      <MyTeamRoster myPicks={myPicks} rosterSlots={draft.rosterSlots} />
    );

  if (collapsible) {
    // The slot select lives in the body: inside the summary, clicking it
    // would toggle the panel.
    return (
      <details
        className="side-panel my-team my-team--collapsible"
        aria-labelledby="my-team-heading"
      >
        <summary className="my-team__summary">
          {heading}
          {nextPick}
        </summary>
        {slotSelect}
        {body}
      </details>
    );
  }

  return (
    <section className="side-panel my-team" aria-labelledby="my-team-heading">
      <div className="side-panel__header">
        {heading}
        {slotSelect}
      </div>
      {nextPick}
      {body}
    </section>
  );
}

/** Drafted players by position and how they fill the lineup. */
function MyTeamRoster({
  myPicks,
  rosterSlots,
}: {
  myPicks: ApiDraftPick[];
  rosterSlots: Record<string, number>;
}) {
  return (
    <>
      {myPicks.length === 0 ? (
        <p className="side-panel__empty">No players drafted yet.</p>
      ) : (
        <ul className="my-team__groups">
          {POSITIONS.map((position) => {
            const players = myPicks.filter(
              (pick) => pick.position === position,
            );

            return (
              players.length > 0 && (
                <li key={position} className="my-team__group">
                  <PositionBadge position={position} />
                  <span>
                    {players
                      .map((pick) => pick.playerName ?? pick.playerId)
                      .join(", ")}
                  </span>
                </li>
              )
            );
          })}
        </ul>
      )}

      <RosterNeeds myPicks={myPicks} rosterSlots={rosterSlots} />
    </>
  );
}
