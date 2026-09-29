import { Link } from "react-router";

import type { RankingImportResponse } from "../types/api";

type ImportIssuesProps = Pick<
  RankingImportResponse,
  "unmatchedPlayers" | "ambiguousPlayers"
>;

/** Rows the import couldn't match to a Sleeper player. They stay in the
 * ranking but are never recommended until fixed in the ranking editor. */
export function ImportIssues({
  unmatchedPlayers,
  ambiguousPlayers,
}: ImportIssuesProps) {
  const rows = [
    ...unmatchedPlayers.map((row) => ({
      rank: row.rank,
      name: row.name,
      details: [row.position, row.team].filter(Boolean).join(", "),
      reason: "no match",
    })),
    ...ambiguousPlayers.map((row) => ({
      rank: row.rank,
      name: row.name,
      details: "",
      reason: `${row.candidates?.length ?? 0} possible players`,
    })),
  ].sort((a, b) => a.rank - b.rank);

  if (rows.length === 0) {
    return null;
  }

  return (
    <section className="import-issues" aria-labelledby="import-issues-heading">
      <h3 id="import-issues-heading">
        {rows.length} {rows.length === 1 ? "player" : "players"} not matched
      </h3>
      <p>
        They stay in your ranking but aren't recommended until you{" "}
        <Link to="/rankings/edit">fix them in the ranking editor</Link>.
      </p>
      <ul className="import-issues__list">
        {rows.map((row) => (
          <li key={row.rank}>
            #{row.rank} {row.name}
            {row.details && ` (${row.details})`} — {row.reason}
          </li>
        ))}
      </ul>
    </section>
  );
}
