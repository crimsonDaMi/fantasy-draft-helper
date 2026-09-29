# Ranking Editor — Requirements

**Status:** Complete (v0.8.0). Implementation constraints are in
[`ranking-editor-history.md`](ranking-editor-history.md).

## Context

The ranking editor is a **separate route with its own dedicated UI**, not
folded into the existing draft-monitoring view. Drafting remains the app's
primary purpose, but there's no need to support editing rankings and
monitoring an active draft at the same time. The user can switch between
the draft view and the ranking editor view.

## Requirements

1. **Entry state.** Opening the ranking editor presents the user with
   their current rankings (the ranking currently in use for
   recommendations).

2. **Layout.** Players are ordered by rank and grouped according to their
   tier.

3. **Reordering.** The user can change a player's position (rank) and
   tier via drag and drop.

   - **Rank renumbering rule:** rank is a strict 1..N sequence. Moving a
     player shifts every player between the old and new position by one.
     Example: moving the player ranked 4th to the top shifts the
     previous 1st/2nd/3rd-ranked players to 2nd/3rd/4th, respectively.

4. **Tier boundaries.** The user can add and remove tier boundaries via
   explicit controls — a "+" control to insert a new, empty tier, and a
   "remove tier" control on each tier group.

   - **Adding a boundary** does not affect other tiers' contents — the
     new tier starts empty, and the user populates it by dragging
     players in.
   - **Removing a tier** merges its players into the tier below (the
     last tier merges into the tier above instead). Every player keeps
     their rank; tier labels are then recalculated per the labeling
     scheme (see below).

5. **Autosave.** Rankings update automatically after each drag-and-drop
   action — no separate save step.

6. **Unranked players.** Players who are fantasy-relevant (per
   `isFantasyRelevantPlayer`) but not part of the ranking are shown in a
   side area, separate from the ranked list. Fantasy-relevant means
   active in the current NFL season **and** at least one of their Sleeper
   `fantasy_positions` is QB, RB, WR, TE, K, or DEF (e.g. `["WR", "CB"]`
   counts; `["LB"]` or `["DB", "S"]` doesn't). The position list is the
   shared `FANTASY_POSITIONS` constant in `apps/api/src/domain/ranking.ts`.
   Players with no relevant position (individual defensive players etc.)
   are also dropped from the player cache at load time; inactive players
   stay in the cache so imported rankings can still match them.

7. **Adding a player from the unranked area.** Dragging a player from the
   unranked side area into the ranked list adds them to the tier they're
   dropped into, at the rank matching the drop position. Every player
   previously at or below that position shifts down by one.

8. **Removing a player.** Dragging a ranked player into the unranked area
   removes them from the ranking.

9. **Re-importing.** Uploading a new ranking CSV never merges with
   in-progress manual edits. Originally it replaced the user's ranking;
   since multiple saved rankings were added it creates an additional
   ranking (named after the file), and the existing ones are kept.

## Tier labeling scheme

The tier value has no meaning to the rest of the application outside this
feature, so a single internal representation is used regardless of
import/display format:

- **Internal (database) representation: alphabetical** — `S` (best),
  then `A`, `B`, `C`, ... (worse as the letter advances). `S` is a
  distinct top tier, not a continuation of the letter sequence.
- **Import conversion:** whatever tier scheme a CSV uses (numeric,
  alphabetical, or none) is converted to the internal alphabetical
  scheme at import time.
- **Editor display:** the user can toggle between alphabetical (default)
  and numeric display. Mapping: `S` = 1, `A` = 2, `B` = 3, `C` = 4, and so
  on — `S` is an extra tier inserted above the regular progression,
  matching common "S-tier" usage elsewhere (fan rankings, gaming tier
  lists).

## API surface

```
PATCH  /rankings/:rankingId/players/:sleeperId   { rank, tier }
DELETE /rankings/:rankingId/players/:sleeperId
POST   /rankings/:rankingId/tiers                { position }
DELETE /rankings/:rankingId/tiers/:position
GET    /rankings/:rankingId/unranked-players
```

`rank` and `position` are both 1-based. `PATCH .../players/:sleeperId`
moves the player if they're already ranked, or adds them (pulling name/
team/position from the Sleeper player cache) if they aren't — the same
endpoint serves requirements #3 and #7. `DELETE .../players/:sleeperId`
is requirement #8. Tiers are tracked as their own ordered, possibly-empty
list per ranking (not just inferred from players' tier values), so a "+"
insert can create a tier with nothing in it yet. Removing a tier merges
into the tier below, except for the bottommost tier, which merges
upward instead (no tier below it to merge into).

## Display

No debug/production split for the editor view — a single view for both
modes. The tier-mapping conversion (alphabetical ↔ numeric) is the one
piece of internal representation that could otherwise be tempting to
expose for debugging, but its correctness belongs to test coverage, not a
UI escape hatch.

- Tiers shown as groupings; each player shown by name and current rank.

## Later additions

Keyboard operation, touch support, and resolving unmatched import rows
have shipped since; see
[`ranking-editor-history.md`](ranking-editor-history.md) (Keyboard, Touch,
Phone layout, Unmatched import rows).
