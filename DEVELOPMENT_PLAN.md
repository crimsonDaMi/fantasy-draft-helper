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

- **Sleeper evaluations** tracked in [`docs/known-issues.md`](docs/known-issues.md):
  pick propagation delay and team defense (`DEF`) matching.

### Code-quality candidates

Left out of the clean-code pass because the benefit didn't justify the
risk or cost at the time; worth re-evaluating when the area is touched.

- **Split `RankingRepository`** — tier management (`insertTier`,
  `removeTier`, tier relabeling/seeding) into its own repository sharing
  the `DatabaseSync`. The file is long but no single method is.
- **Ranking editor hooks** — moving the page's drag handlers or render-time
  server sync out of `RankingEditorPage` conflicts with the constraints in
  [`ranking-editor-history.md`](docs/ranking-editor-history.md).
- **Upstream status mapping** — `SleeperClient`/`AdpClient` pass Sleeper's
  HTTP status straight through (`HttpError`), so an upstream 500 becomes
  our 500; mapping to 502 is arguably more accurate.
- **Auth error classes** — `AuthService` has its own error classes mapped
  per route instead of the shared domain errors and error handler.
- **Argument order** — `RankingStoreService.getMatches(userId, rankingId?)`
  is the reverse of every other `(rankingId, userId)` method; swapping two
  string parameters risks silent breakage.
- **Write-only columns** — `ranking_players.name/position/team/match_status`
  are written but never read; dropping them is a schema change (major).
- **Unread response fields** — several fields in `apps/web/src/types/api.ts`
  are never read by the web app.
- **Split `draft-order.ts`** — roster fill (`fillRoster`, slot constants)
  could move to its own module.
- **Shared error display** — errors are rendered ad hoc; a small
  `ErrorMessage` component would unify `role="alert"` and styling.
- **`getFlags` scoping** — `RankingRepository.getFlags(rankingId)` isn't
  user-scoped; callers check ownership first.
