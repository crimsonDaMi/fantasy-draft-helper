# Development Plan

Current scope and roadmap. Per-release details are in `CHANGELOG.md`;
versioning and distribution (a single Docker image on GHCR,
`ghcr.io/crimsondami/fantasy-draft-helper`) are in `RELEASING.md`.

## Status

v1.0.0 is released. The MVP, every planned feature below, and the v1.0.0
readiness work are complete. There is no agreed next feature — any new
item needs its scope confirmed with the user before work starts.

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

## Out of scope

Payments, WebSockets, machine learning, automated drafting, positional
scarcity, value-over-replacement, roster optimization, advanced draft
strategy, and acting on Sleeper on the user's behalf. Do not add these
without an explicit request.

Two of these are in scope only in a light, informational form, agreed
with the user: **positional scarcity** as counts of players left per tier
of the user's own ranking plus a recent-picks positional run, and
**roster needs** as filled vs. required lineup slots. Neither may reorder,
weight, or filter recommendations or suggest a pick — scarcity-weighted
rankings and roster optimization stay out of scope.

## Deferred ideas

- **Keyboard-operable drag-and-drop** in the ranking editor (accessibility).
- **Touch support** in the ranking editor — worth taking only if it comes
  cheaply from the drag-and-drop library.
- **Mobile draft layout**: evaluate the draft page on phone-sized
  screens. The single 640px column shrinks to fit, but nothing has been
  checked on a real phone — e.g. whether My team pushes the
  recommendations below the fold, and whether the recommendation and
  recent-pick rows, filter pills, and header controls fit or wrap
  cleanly.
- **Traded picks and auctions** for "you pick in N": the pick order is
  computed from the draft type and slot, so traded picks aren't reflected
  and auctions show no next pick. Sleeper exposes traded picks at
  `/draft/{draft_id}/traded_picks` if this is ever needed.
- **Sleeper evaluations** tracked in [`docs/known-issues.md`](docs/known-issues.md):
  pick propagation delay and team defense (`DEF`) matching.
