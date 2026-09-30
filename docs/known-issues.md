# Known Issues and Evaluation Items

Open external limitations and unverified behavior, with the evidence still
needed. Remove an item once it is resolved — git history and
`CHANGELOG.md` keep the record.

## Sleeper Draft Pick Propagation Delay

### Observation

Sleeper may take several seconds to expose a pick through its API after the pick appears in the Sleeper draft interface. Testing with mock drafts suggested delays of approximately 20 seconds in some cases, especially when automated drafters make rapid picks. This observation is not yet a representative measurement for live drafts.

### Impact

Recommendations are based on the latest picks returned by Sleeper. During a propagation delay, a recently drafted player may temporarily appear as available, and multiple picks may appear between refreshes.

### Current Decision

The application uses the state returned by Sleeper and does not infer picks or attempt to predict unavailable players. The frontend should display the last successful refresh time and an understandable freshness or delayed-data state. Polling more frequently than the active-draft interval is unlikely to solve an upstream propagation delay.

### Evaluation Needed

- Measure typical and worst-case delay during live and mock drafts.
- Compare update timing from `/draft/{draft_id}` and `/draft/{draft_id}/picks`.
- Check whether `last_picked` or other draft metadata provides earlier change detection.
- Determine whether propagation differs between human and automated picks.
- Validate whether the current polling intervals are appropriate.

WebSockets, pick prediction, and server-side workarounds for this issue are out of scope.

Status: open, as a documented upstream limitation. The live draft test (1-minute pick clock) did not show it as a practical problem.

## Draft State Consistency

This is the application-level consequence of Sleeper propagation delay. The recommendation calculation must remain deterministic for the pick set returned by Sleeper, while the UI should make freshness visible. A player that has not yet appeared in Sleeper's picks endpoint may remain in recommendations temporarily.

Future evaluation may consider:

- A visible "data may be delayed" indicator.
- Detection of multiple newly returned picks.
- Alternative Sleeper endpoints, if they are documented and demonstrably fresher.

## Injury Status Freshness

Injury badges come from Sleeper's player dataset (`/players/nfl`), which the
API loads once and refreshes at most every 24 hours — as Sleeper's docs ask.
A status change during that window (e.g. a player ruled out the morning of
the draft) is not reflected until the next refresh or an API restart.

Status: accepted limitation. Stored rankings don't freeze the status at
import time; it is always read from the current player cache.

## Ranking Editor Flicker on Quick Keyboard Moves

Each Alt+arrow move in the ranking editor saves immediately, and each save
refetches the ranking. When presses come faster than the server responds, a
refetch can return an order from a few presses earlier, and the render-time
server sync in `RankingEditorPage` briefly shows it before the next refetch
catches up. Focus stays on the moved player (see the Keyboard section of
[`ranking-editor-history.md`](ranking-editor-history.md)).

Possible fix: skip the server sync while any move mutation is still pending,
as it is already skipped mid-drag.

Status: accepted for now; rare in practice.
