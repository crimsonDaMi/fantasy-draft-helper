import { useState } from "react";

import type { ApiPlayer, RankingPlayerDto } from "../../types/api";
import {
  filterPlayersByQuery,
  type EditorPlayer,
} from "../ranking-editor-logic";

const MAX_SEARCH_RESULTS = 8;

function describePlayer(player: { position?: string; team?: string }) {
  const details = [player.position, player.team].filter(Boolean).join(", ");
  return details ? ` (${details})` : "";
}

/** Import rows without a matched player: they're kept in the ranking but
 * never recommended until resolved to a player here, or removed. */
export function UnmatchedRows({
  rows,
  unrankedPlayers,
  isRanked,
  tierHeading,
  isSaving,
  onResolve,
  onRemove,
}: {
  rows: RankingPlayerDto[];
  /** The pool "Choose player…" searches. */
  unrankedPlayers: EditorPlayer[];
  isRanked: (sleeperId: string) => boolean;
  tierHeading: (label: string) => string;
  isSaving: boolean;
  onResolve: (row: RankingPlayerDto, sleeperId: string) => void;
  onRemove: (row: RankingPlayerDto) => void;
}) {
  const [searchingRank, setSearchingRank] = useState<number>();
  const [query, setQuery] = useState("");

  if (rows.length === 0) {
    return null;
  }

  function startSearch(row: RankingPlayerDto) {
    setSearchingRank(row.ranking.rank);
    setQuery(row.ranking.playerName);
  }

  function pick(row: RankingPlayerDto, player: ApiPlayer) {
    setSearchingRank(undefined);
    onResolve(row, player.sleeperId);
  }

  return (
    <details className="unmatched-rows" open>
      <summary>Not matched ({rows.length})</summary>
      <p className="unmatched-rows__intro">
        The import couldn't tie these rows to a Sleeper player, so they're never
        recommended. Pick the right player, or remove the row.
      </p>
      <ul className="unmatched-rows__list">
        {rows.map((row) => {
          const { rank, playerName, tier } = row.ranking;
          const candidates = row.candidates ?? [];
          const results =
            searchingRank === rank
              ? filterPlayersByQuery(unrankedPlayers, query).slice(
                  0,
                  MAX_SEARCH_RESULTS,
                )
              : [];

          return (
            <li key={`${rank}-${playerName}`} className="unmatched-rows__row">
              <span className="unmatched-rows__label">
                #{rank} {playerName}
                {describePlayer(row.ranking)}
                {tier && ` · ${tierHeading(tier)}`} —{" "}
                {candidates.length > 0
                  ? `${candidates.length} possible players`
                  : "no match"}
              </span>
              <span className="unmatched-rows__actions">
                {candidates.map((candidate) => (
                  <button
                    key={candidate.sleeperId}
                    type="button"
                    disabled={isSaving || isRanked(candidate.sleeperId)}
                    title={
                      isRanked(candidate.sleeperId)
                        ? "Already in this ranking"
                        : undefined
                    }
                    onClick={() => pick(row, candidate)}
                  >
                    Use {candidate.fullName}
                    {describePlayer(candidate)}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={isSaving}
                  aria-expanded={searchingRank === rank}
                  onClick={() =>
                    searchingRank === rank
                      ? setSearchingRank(undefined)
                      : startSearch(row)
                  }
                >
                  Choose player…
                </button>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => onRemove(row)}
                >
                  Remove
                </button>
              </span>
              {searchingRank === rank && (
                <div className="unmatched-rows__search">
                  <input
                    type="search"
                    className="search-input"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    aria-label={`Search a player for ${playerName}`}
                    autoFocus
                  />
                  {results.length > 0 ? (
                    <ul className="unmatched-rows__results">
                      {results.map((player) => (
                        <li key={player.sleeperId}>
                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() => pick(row, player)}
                          >
                            {player.fullName}
                            {describePlayer(player)}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="unmatched-rows__empty">
                      No unranked player matches.
                    </p>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </details>
  );
}
