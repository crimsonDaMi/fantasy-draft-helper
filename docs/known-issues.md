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
