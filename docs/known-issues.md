# Known Issues and Evaluation Items

## Sleeper Draft Pick Propagation Delay

### Observation

During testing with Sleeper mock drafts, there appears to be a delay between a pick being made in the Sleeper draft interface and the pick becoming visible through the Sleeper API.

The delay may be more noticeable during mock drafts because automated bots can make multiple picks in rapid succession.

### Potential Impact

The draft helper relies on polling the Sleeper API to determine which players are no longer available.

A propagation delay could result in:

- A recently drafted player temporarily appearing as available.
- Recommendations being briefly outdated.
- Multiple picks appearing between polling cycles.

### Evaluation Required

Before finalizing the polling implementation, evaluate:

1. Typical API propagation delay.
2. Worst-case observed delay.
3. Behavior during rapid automated mock draft picks.
4. Whether `/draft/{draft_id}` and `/draft/{draft_id}/picks` update at different times.
5. Whether `last_picked` or other draft metadata can help detect changes.
6. Whether adaptive polling improves the user experience.
7. How the UI should communicate potentially stale recommendations.

### Current Decision

Do not optimize around this behavior yet.

Implement a correct polling architecture first and evaluate observed API latency using real measurements later.

## Draft State Consistency During Rapid Picks

### Observation

The available-player calculation depends on the latest draft picks returned by the Sleeper API.

If the Sleeper API temporarily lags behind the draft interface, the calculated available-player list can be stale.

### Potential Scenario

1. Player A is drafted.
2. Sleeper draft UI immediately shows Player A as drafted.
3. Sleeper API still returns the previous pick list.
4. Draft helper calculates Player A as available.
5. Player A may temporarily appear in recommendations.

### Future Evaluation

Evaluate whether the application should:

- Display the timestamp of the last successful draft state refresh.
- Detect multiple newly available picks.
- Apply a short recommendation refresh delay.
- Increase polling frequency during active drafting.
- Show a "refreshing" or "data may be delayed" indicator.
- Measure observed API propagation latency.

## Sleeper Defense Player Representation

### Background

Fantasy ranking CSV files may contain team defenses using the `DEF` position.

Team defenses may not be represented by the Sleeper NFL player dataset in exactly the same way as individual players.

### Evaluation Required

Before finalizing player matching:

1. Inspect Sleeper NFL player records for team defenses.
2. Determine the Sleeper player IDs used for defenses.
3. Verify position values.
4. Verify team abbreviations.
5. Verify whether defense names differ from CSV ranking names.

### Current Decision

The ranking CSV parser accepts `DEF`.

The player matching algorithm will be validated against actual Sleeper defense records before relying on name-based defense matching.

## Sleeper API Draft Pick Propagation Delay

### Observation

During mock drafts with automated bots making picks rapidly, there appears to be a delay between a pick occurring and the Sleeper API exposing that pick.

### Current MVP Behavior

The frontend polls the Fantasy Draft Helper API every 3 seconds.

The application reflects the state returned by Sleeper and does not attempt to predict or infer picks that have not yet appeared in the API.

### Future Evaluation

Evaluate:

- Typical propagation delay during real drafts.
- Typical propagation delay during mock drafts.
- Whether automated bot drafts behave differently.
- Optimal polling interval.
- Whether server-side polling or event-driven monitoring is preferable.

## Initial Player Matching Availability

### Observation

During end-to-end testing, an initial CSV import returned all players as unmatched. Repeating the same import immediately afterwards successfully matched all players.

### Possible Cause

The Sleeper player data or player lookup cache may not have been fully initialized when the first ranking import occurred.

### Current Status

Requires further investigation.

### Future Evaluation

Investigate:

- When Sleeper player data is loaded.
- Whether player data is cached lazily.
- Whether ranking imports can occur before player data initialization completes.
- Whether the API should explicitly ensure the player dataset is available before processing a ranking import.

### Desired Behavior

A user should be able to start the application and immediately import a rankings CSV successfully without requiring a second import.

## Sleeper API Draft Pick Propagation Delay

### Observation

During draft monitoring tests, there appears to be an approximately 20-second delay between a pick occurring in the draft and the Sleeper API exposing that pick.

This was particularly noticeable during mock drafts and may be influenced by automated picks occurring in rapid succession.

### Impact

The current draft configuration uses a 30-second timer per pick.

Because the Sleeper API may lag by approximately 20 seconds, recommendations can temporarily include players who have already been selected in the actual draft.

In some situations, multiple recommendations may be based on outdated draft state.

### Current MVP Behavior

The frontend polls the Fantasy Draft Helper API every 3 seconds.

The application reflects the latest state available from Sleeper and does not attempt to predict picks that have not yet appeared in the Sleeper API.

### Important Finding

The primary source of recommendation latency appears to be Sleeper API propagation delay rather than the application's polling interval.

Reducing the frontend polling interval below 3 seconds is therefore unlikely to significantly improve the user experience.

### Future Evaluation

Evaluate:

- Propagation delays during real drafts.
- Differences between mock and real drafts.
- Differences between automated and human picks.
- Whether other Sleeper API endpoints provide faster updates.
- Whether Sleeper offers an event-based or WebSocket-based mechanism.
- Whether draft state should be displayed with a visible freshness indicator.
- Whether recommendations should warn the user when the Sleeper data is stale.
