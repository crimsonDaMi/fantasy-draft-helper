import type { ApiDraftPick, ApiPlayer } from "../types/api";

/** The user's drafted RBs the player backs up: those on the same NFL
 * team whose depth chart spot is directly above the player's. By name,
 * in pick order. Players without depth chart data never handcuff. */
export function handcuffedRbs(
  player: ApiPlayer,
  myPicks: ApiDraftPick[],
): string[] {
  const depth = player.depthChart;

  if (!player.team || depth?.position !== "RB") {
    return [];
  }

  return myPicks
    .filter(
      (pick) =>
        pick.team === player.team &&
        pick.depthChart?.position === "RB" &&
        pick.depthChart.order === depth.order - 1,
    )
    .map((pick) => pick.playerName ?? pick.playerId);
}
