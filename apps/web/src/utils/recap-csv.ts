import type { ApiDraftPick } from "../types/api";
import { formatPick } from "./draft-order";

const CSV_HEADERS = [
  "pick",
  "overall",
  "player",
  "position",
  "team",
  "your_rank",
  "tier",
  "adp",
];

function escapeCsvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

/** The user's picks as a CSV, one row per pick. */
export function toRecapCsv(picks: ApiDraftPick[], teams?: number): string {
  const rows = picks.map((pick) =>
    [
      formatPick(pick.pickNo, teams),
      String(pick.pickNo),
      pick.playerName ?? pick.playerId,
      pick.position ?? "",
      pick.team ?? "",
      pick.rank === undefined ? "" : String(pick.rank),
      pick.tier ?? "",
      pick.adp === undefined ? "" : String(pick.adp),
    ]
      .map(escapeCsvField)
      .join(","),
  );

  return [CSV_HEADERS.join(","), ...rows].join("\n") + "\n";
}
