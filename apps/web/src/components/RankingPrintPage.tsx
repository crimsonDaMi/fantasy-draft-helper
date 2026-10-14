import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";

import { getRanking } from "../api/fantasy-api";
import { queryKeys } from "../api/query-keys";
import { useSelectedRanking } from "../hooks/useSelectedRanking";
import { useTierDisplayMode } from "../hooks/useTierDisplayMode";
import { buildPrintTiers, type PrintRow } from "../utils/ranking-print";
import { ErrorMessage } from "./ErrorMessage";
import { formatTierHeading } from "./ranking-editor-logic";

const FLAG_SYMBOL = { watch: "★", avoid: "⊘" } as const;

function PrintRowItem({ row }: { row: PrintRow }) {
  return (
    <li
      className={
        row.flag
          ? `ranking-print__row ranking-print__row--${row.flag}`
          : "ranking-print__row"
      }
    >
      <span className="ranking-print__rank">{row.rank}</span>
      <span className="ranking-print__flag">
        {row.flag && (
          <span
            role="img"
            aria-label={row.flag === "watch" ? "Watched" : "Avoided"}
          >
            {FLAG_SYMBOL[row.flag]}
          </span>
        )}
      </span>
      <span className="ranking-print__name">{row.name}</span>
      <span className="ranking-print__meta">
        {[row.position, row.team, row.bye !== undefined && `Bye ${row.bye}`]
          .filter(Boolean)
          .join(" · ")}
      </span>
      {row.note && <span className="ranking-print__note">{row.note}</span>}
    </li>
  );
}

/** The selected ranking as a compact, printable cheat sheet, for a paper
 * or PDF backup on draft day. The browser's print dialog does the rest. */
export function RankingPrintPage() {
  const { selectedRanking, isLoading } = useSelectedRanking();
  const rankingId = selectedRanking?.id;
  const [tierDisplayMode] = useTierDisplayMode();

  const detailQuery = useQuery({
    queryKey: queryKeys.rankingDetail(rankingId),
    queryFn: () => getRanking(rankingId!),
    enabled: Boolean(rankingId),
  });

  if (isLoading || detailQuery.isLoading) {
    return <p className="status-bar">Loading ranking…</p>;
  }

  if (!selectedRanking) {
    return (
      <p className="status-bar">
        No ranking to print yet. <Link to="/rankings/edit">Start one</Link>.
      </p>
    );
  }

  if (detailQuery.error) {
    return (
      <ErrorMessage>
        Couldn't load the ranking: {detailQuery.error.message}
      </ErrorMessage>
    );
  }

  const tiers = detailQuery.data ? buildPrintTiers(detailQuery.data) : [];
  const playerCount = tiers.reduce((sum, tier) => sum + tier.rows.length, 0);

  return (
    <section className="ranking-print">
      <div className="ranking-print__actions">
        <Link to="/rankings/edit" className="button-secondary">
          Back to the editor
        </Link>
        <button
          type="button"
          className="button-secondary"
          onClick={() => window.print()}
        >
          Print or save as PDF
        </button>
      </div>

      <header className="ranking-print__header">
        <h2>{selectedRanking.name}</h2>
        <p className="ranking-print__legend">
          {playerCount} players · ★ watch · ⊘ avoid
        </p>
      </header>

      <div className="ranking-print__tiers">
        {tiers.map((tier) => (
          <section key={tier.label ?? ""} className="ranking-print__tier">
            {tier.label && (
              <h3 className="ranking-print__tier-heading">
                {formatTierHeading(
                  tier.label,
                  tier.position ?? 1,
                  tierDisplayMode,
                )}
              </h3>
            )}
            <ol className="ranking-print__list">
              {tier.rows.map((row) => (
                <PrintRowItem key={row.rank} row={row} />
              ))}
            </ol>
          </section>
        ))}
      </div>
    </section>
  );
}
