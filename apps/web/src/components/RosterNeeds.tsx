import type { ApiDraftPick } from "../types/api";
import {
  BENCH_SLOT,
  fillRoster,
  ROSTER_SLOT_LABELS,
} from "../utils/roster-fill";

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
            fill.slot !== BENCH_SLOT && fill.filled < fill.required
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
