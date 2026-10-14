import type { ApiDraftPick, ApiPlayer } from "../types/api";

const PASS_CATCHERS = ["WR", "TE"];

/** Whether a QB and a WR/TE (in either order) can form a stack. */
function stacks(a?: string, b?: string): boolean {
  return (
    (a === "QB" && PASS_CATCHERS.includes(b ?? "")) ||
    (b === "QB" && PASS_CATCHERS.includes(a ?? ""))
  );
}

/** The user's picks that would stack with the player: a QB with WRs and
 * TEs on the same NFL team, or a WR/TE with QBs. By name, in pick
 * order. Free agents (no team) never stack. */
export function stackPartners(
  player: ApiPlayer,
  myPicks: ApiDraftPick[],
): string[] {
  if (!player.team) {
    return [];
  }

  return myPicks
    .filter(
      (pick) =>
        pick.team === player.team && stacks(player.position, pick.position),
    )
    .map((pick) => pick.playerName ?? pick.playerId);
}
