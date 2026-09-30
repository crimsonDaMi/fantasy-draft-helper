# Development Plan

Current scope and roadmap. Per-release details are in `CHANGELOG.md`;
versioning and distribution (a single Docker image on GHCR,
`ghcr.io/crimsondami/fantasy-draft-helper`) are in `RELEASING.md`.

## Status

v1.0.0 is released. The MVP, every planned feature below, and the v1.0.0
readiness work are complete. No next feature is planned.

## Shipped

| Feature                                                     | Version |
| ----------------------------------------------------------- | ------- |
| MVP: CSV import, Sleeper matching, draft monitoring         | v0.1.0  |
| Position-based filtering                                    | v0.2.0  |
| Dev/prod UI switch (`VITE_UI_MODE`)                         | v0.3.0  |
| Draft-day view redesign                                     | v0.4.0  |
| ADP vs. personal ranking diff                               | v0.5.0  |
| Authentication and username allowlist                       | v0.6.1  |
| Shared-instance hosting setup                               | v0.6.3  |
| Per-user data separation and multi-user support             | v0.7.0  |
| Ranking editor ([history](docs/ranking-editor-history.md))  | v0.8.x  |
| v1.0 hardening (schema guardrail, CSV export, auth lockout) | v1.0.0  |
| Draft-day panels, search, injuries, draft lookup, recap     | v1.2.0  |
| Multiple saved rankings, watch/avoid flags                  | v1.2.0  |
| Wide-screen draft layout                                    | Unrel.  |
| Phone draft layout                                          | Unrel.  |
| Keyboard-operable ranking editor                            | Unrel.  |
| Ranking editor touch support and phone layout               | Unrel.  |
| Traded picks in "you pick in N", auction budget             | Unrel.  |
| Unmatched import rows: listed, resolvable in the editor     | Unrel.  |

## Out of scope

Payments, WebSockets, machine learning, automated drafting, positional
scarcity, value-over-replacement, roster optimization, advanced draft
strategy, and acting on Sleeper on the user's behalf.

Two of these are in scope only in a light, informational form:
**positional scarcity** as counts of players left per tier
of the user's own ranking plus a recent-picks positional run, and
**roster needs** as filled vs. required lineup slots. Neither may reorder,
weight, or filter recommendations or suggest a pick — scarcity-weighted
rankings and roster optimization stay out of scope.

## Deferred ideas

None. Accepted external limitations (Sleeper's pick propagation delay,
once-a-day injury data) are listed in
[`docs/known-issues.md`](docs/known-issues.md).

## Declined refactors

Reviewed and decided against; listed so they aren't re-raised without new
reasons.

- **Splitting `RankingRepository`** by tiers vs. players: a ranking, its
  players, and its tiers are one aggregate — tier changes relabel player
  rows and share one transaction — so a split adds seams, not clarity.
- **Trimming unread fields from `apps/web/src/types/api.ts`**: the types
  mirror the documented API contract; unread fields cost nothing at
  runtime.
- **One helper for the value/reach styling** in `DraftRecap`,
  `RecommendationsList`, and `RecentPicks`: each uses its own threshold
  and comparison on purpose, and they answer different questions.
