import type { ApiDraftInfo, ApiDraftPick, DraftStatus } from "../types/api";
import {
  fillRoster,
  formatPick,
  nextPickFor,
  ROSTER_SLOT_LABELS,
} from "../utils/draft-order";
import { POSITIONS } from "../utils/positions";
import { PositionBadge } from "./PositionBadge";

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

  const label = formatPick(next.pickNo, draft.teams);

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

/** Roster fill against the league's lineup, e.g. "QB 1/1 · SF 0/1". */
export function RosterNeeds({
  myPicks,
  rosterSlots,
}: {
  myPicks: ApiDraftPick[];
  rosterSlots: Record<string, number>;
}) {
  const fills = fillRoster(
    myPicks.map((pick) => pick.position),
    rosterSlots,
  );

  if (fills.length === 0) {
    return null;
  }

  return (
    <p className="my-team__needs" aria-label="Roster slots filled">
      {fills.map((fill) => (
        <span
          key={fill.slot}
          className={`my-team__need${
            fill.slot !== "BN" && fill.filled < fill.required
              ? " my-team__need--open"
              : ""
          }`}
        >
          {ROSTER_SLOT_LABELS[fill.slot] ?? fill.slot} {fill.filled}/
          {fill.required}
        </span>
      ))}
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
}: MyTeamPanelProps) {
  const teams = draft.teams ?? 0;
  const canPickSlot = !slotFromSleeper && teams > 0;
  const showNextPick =
    slot !== undefined &&
    draftStatus !== "COMPLETE" &&
    draft.type !== "auction";

  return (
    <section className="side-panel my-team" aria-labelledby="my-team-heading">
      <div className="side-panel__header">
        <h2 id="my-team-heading">My team</h2>
        {canPickSlot && (
          <label className="my-team__slot">
            Slot{" "}
            <select
              value={slot ?? ""}
              onChange={(event) => onSlotChange(Number(event.target.value))}
            >
              {slot === undefined && <option value="">–</option>}
              {Array.from({ length: teams }, (_, index) => index + 1).map(
                (value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ),
              )}
            </select>
          </label>
        )}
      </div>

      {slot === undefined ? (
        <p className="side-panel__empty">
          {canPickSlot
            ? "Choose your draft slot to follow your picks."
            : "Your draft slot isn't known yet."}
        </p>
      ) : (
        <>
          {showNextPick && (
            <NextPickLine
              draft={draft}
              slot={slot}
              currentPickNo={currentPickNo}
            />
          )}

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

          <RosterNeeds myPicks={myPicks} rosterSlots={draft.rosterSlots} />
        </>
      )}
    </section>
  );
}
