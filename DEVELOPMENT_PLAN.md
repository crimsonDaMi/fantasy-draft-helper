# Development Plan

Current scope and shipped features. Planned features and bugs are tracked
as [GitHub issues](https://github.com/crimsonDaMi/fantasy-draft-helper/issues),
not in this file. Per-release details are in `CHANGELOG.md`; versioning
and distribution (a single Docker image on GHCR,
`ghcr.io/crimsondami/fantasy-draft-helper`) are in `RELEASING.md`.

## Status

Released; the current version is the latest entry in `CHANGELOG.md`. The
MVP, the features below, and the v1.0.0 readiness work are complete. Next
work is chosen from the
[open issues](https://github.com/crimsonDaMi/fantasy-draft-helper/issues),
prioritized by their `priority: high|medium|low` labels.

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
| Wide-screen draft layout                                    | v1.3.0  |
| Phone draft layout                                          | v1.3.0  |
| Keyboard-operable ranking editor                            | v1.4.0  |
| Ranking editor touch support and phone layout               | v1.4.0  |
| Traded picks in "you pick in N", auction budget             | v1.4.0  |
| Unmatched import rows: listed, resolvable in the editor     | v1.4.0  |

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

An issue that conflicts with this list is labelled `needs-scope-decision`;
a decision to take it on changes this section in the same commit as the
feature.

Accepted external limitations (Sleeper's pick propagation delay,
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
