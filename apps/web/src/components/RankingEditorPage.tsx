import { useQuery } from "@tanstack/react-query";

import {
  getRanking,
  getRankingsStatus,
  getUnrankedPlayers,
} from "../api/fantasy-api";
import type { RankingPlayerDto } from "../types/api";

function groupByTier(players: RankingPlayerDto[]) {
  const groups = new Map<string, RankingPlayerDto[]>();

  for (const entry of players) {
    if (!entry.player) {
      continue;
    }

    const tier = entry.ranking.tier ?? "Untiered";
    const existing = groups.get(tier) ?? [];
    existing.push(entry);
    groups.set(tier, existing);
  }

  return groups;
}

export function RankingEditorPage() {
  const statusQuery = useQuery({
    queryKey: ["ranking-status"],
    queryFn: getRankingsStatus,
  });

  const rankingId = statusQuery.data?.rankingId;

  const detailQuery = useQuery({
    queryKey: ["ranking-detail", rankingId],
    queryFn: () => getRanking(rankingId!),
    enabled: Boolean(rankingId),
  });

  const unrankedQuery = useQuery({
    queryKey: ["ranking-unranked", rankingId],
    queryFn: () => getUnrankedPlayers(rankingId!),
    enabled: Boolean(rankingId),
  });

  if (statusQuery.isLoading) {
    return <p className="status-bar">Loading…</p>;
  }

  if (!rankingId) {
    return (
      <section className="ranking-editor">
        <h2>Edit rankings</h2>
        <p>
          Import a ranking on the Draft tab first, then come back here to edit
          it.
        </p>
      </section>
    );
  }

  if (detailQuery.isLoading || unrankedQuery.isLoading) {
    return <p className="status-bar">Loading ranking…</p>;
  }

  if (detailQuery.error || unrankedQuery.error) {
    return (
      <p className="status-bar status-bar__error">
        Failed to load the ranking.
      </p>
    );
  }

  const tiers = detailQuery.data?.tiers ?? [];
  const players = detailQuery.data?.players ?? [];
  const grouped = groupByTier(players);
  const unranked = unrankedQuery.data?.players ?? [];

  return (
    <section className="ranking-editor">
      <h2>Edit rankings</h2>

      <div className="ranking-editor__layout">
        <div className="ranking-editor__tiers">
          {tiers.map((tier) => (
            <div className="ranking-editor__tier" key={tier.label}>
              <h3>Tier {tier.label}</h3>
              <ol className="ranking-editor__player-list">
                {(grouped.get(tier.label) ?? []).map((entry) => (
                  <li key={entry.player!.sleeperId}>
                    <span className="ranking-editor__rank">
                      #{entry.ranking.rank}
                    </span>
                    <span className="ranking-editor__name">
                      {entry.player!.fullName}
                    </span>
                    <span className="ranking-editor__meta">
                      {entry.player!.position}
                      {entry.player!.position && entry.player!.team && " · "}
                      {entry.player!.team}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>

        <aside className="ranking-editor__unranked">
          <h3>Unranked</h3>
          <ul className="ranking-editor__player-list">
            {unranked.map((player) => (
              <li key={player.sleeperId}>
                <span className="ranking-editor__name">{player.fullName}</span>
                <span className="ranking-editor__meta">
                  {player.position}
                  {player.position && player.team && " · "}
                  {player.team}
                </span>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </section>
  );
}
