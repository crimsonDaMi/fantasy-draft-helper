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

Do not add WebSockets, prediction, or server-side workarounds for this issue without an explicit request.

Status: open, as a documented upstream limitation. The live draft test (1-minute pick clock) did not show it as a practical problem.

## Draft State Consistency

This is the application-level consequence of Sleeper propagation delay. The recommendation calculation must remain deterministic for the pick set returned by Sleeper, while the UI should make freshness visible. A player that has not yet appeared in Sleeper's picks endpoint may remain in recommendations temporarily.

Future evaluation may consider:

- A visible "data may be delayed" indicator.
- Detection of multiple newly returned picks.
- Alternative Sleeper endpoints, if they are documented and demonstrably fresher.

## Sleeper Defense Representation

Rankings may contain team defenses using the `DEF` position. Sleeper may represent defenses differently from individual players, including different names, IDs, position values, or team abbreviations.

Before relying on name-based defense matching, verify against the live Sleeper player dataset:

- Which IDs represent team defenses.
- Which position values are used.
- Which team abbreviations are used.
- Whether common ranking names match Sleeper names.

The CSV parser accepts `DEF`, but defense matching should be covered by fixtures once the Sleeper representation is confirmed.
