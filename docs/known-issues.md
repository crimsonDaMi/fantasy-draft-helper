# Known Limitations

Accepted external limitations. Nothing here is under evaluation; an item is
removed if it is ever resolved — git history and `CHANGELOG.md` keep the
record. Bugs to fix are tracked as
[GitHub issues](https://github.com/crimsonDaMi/fantasy-draft-helper/issues).

## Sleeper Pick Propagation Delay

Sleeper can expose a pick through its API several seconds after it appears
in Sleeper's own draft screen (up to ~20 seconds in mock drafts with fast
automated picks). Until then, the drafted player can still appear in the
recommendations, and several picks can arrive in one refresh.

The app shows the state Sleeper returns: it doesn't infer or predict picks,
and polling faster wouldn't help with a delay on Sleeper's side. A live
draft with a 1-minute pick clock didn't show this as a practical problem.

## Injury Status Freshness

Injury badges come from Sleeper's player dataset (`/players/nfl`), which the
API refreshes once a day, as Sleeper's docs ask. A status change within that
day (e.g. a player ruled out the morning of the draft) shows after the next
refresh or an API restart. The draft status bar shows when the data was
last loaded ("Injuries as of …").
