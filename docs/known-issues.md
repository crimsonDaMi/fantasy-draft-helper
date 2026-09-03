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
