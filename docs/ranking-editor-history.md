# Ranking editor — design notes

The ranking editor (released v0.8.0) is a drag-and-drop UI at
`/rankings/edit` for reordering ranked players across tiers, adding and
removing tiers, and moving players in and out of an "unranked" pool.
Requirements: [`ranking-editor-requirements.md`](ranking-editor-requirements.md).

These are the constraints earlier fixes left behind. Read them before
changing anything in the editor — most of them look like needless
complexity until you remove one.

## Code map

- `components/RankingEditorPage.tsx` — queries, render-time server sync,
  drag handlers.
- `components/ranking-editor/` — `DroppableContainer` (virtualized list,
  plus `TierRemoveControl`), `SortablePlayer`, `PlayerLabel` (rows and
  drag overlay; renders the shared `components/PositionBadge`), `TierModeToggle`.
- `components/ranking-editor-logic.ts` — pure, drag-library-agnostic,
  unit-tested helpers (`computeGlobalRank`, `movePlayerToContainer`,
  `buildContainers`, filters, `formatTierHeading`).
- `hooks/useEdgeAutoscroll.ts`, `hooks/useContainerCollisionDetection.ts`,
  `hooks/useRankingEditorMutations.ts`.

## Drag-and-drop performance

`@dnd-kit`'s `useSortable` cost scales with the **total** number of
mounted sortable nodes on the page, not the active tier's size. At real
scale (~360 players, 12 tiers) that made dragging unusable. Every tier and
the unranked panel is therefore virtualized with `@tanstack/react-virtual`,
so only visible rows plus overscan are mounted.

- The dragged row is force-kept-mounted (`withForcedActiveRow`) when it
  scrolls out of the virtualized window, because dnd-kit moves the row's
  own DOM node rather than an overlay.
- Rows have a fixed height (`PLAYER_ROW_HEIGHT`); long names are truncated
  with an ellipsis and a `title` tooltip. Dynamic row heights would break
  `withForcedActiveRow`'s assumptions.
- The filter helpers (name search, global position filter) return the
  original array reference when no filter is active, to avoid per-dragover
  work.
- There are two name searches on purpose: one for the tiers and one for
  the unranked panel. A single shared query would hide the tier rows you
  want to drop a searched-for unranked player between.

Any change to how containers render must preserve all of this.

## Cross-container drags

- dnd-kit's built-in `autoScroll` can't retarget across independently
  virtualized containers, so it is limited to the page itself
  (`canScroll` allows only `document.scrollingElement`/`documentElement`).
  `useEdgeAutoscroll` scrolls whichever inner container is under the
  pointer.
- `buildContainers` always filters players already in a tier out of the
  unranked list. The ranking and unranked queries refetch independently;
  without this a player can briefly appear in both, which corrupts
  dnd-kit's id registry and makes the player ungrabbable.
- An empty tier's virtualized height is 0px, so the scroll wrapper has a
  `min-height` and shows a "Drop players here" placeholder.
- `useContainerCollisionDetection` owns `lastOverId` and exposes
  `resetLastOverId()`, because the React Compiler lint rules forbid
  mutating a hook's return value or argument.

## Touch

- Two sensors instead of one `PointerSensor`: `MouseSensor` starts after
  4px, `TouchSensor` after a 200ms long press. With a distance-only
  pointer sensor every swipe on a row started a drag, and rows fill the
  lists, so nothing could be scrolled by touch.
- Rows use `touch-action: manipulation`, not `none`, so the browser can
  scroll on a swipe; `TouchSensor` blocks scrolling once a drag starts.
  `-webkit-touch-callout: none` stops iOS from opening its long-press
  callout.
- `FlagButtons` stops `touchstart` as well as `pointerdown` propagation —
  `TouchSensor` listens to touch events, so a long press on ★/⊘ would
  otherwise start a drag.
- `useEdgeAutoscroll` also listens to `touchmove`: not every browser keeps
  firing `pointermove` during a touch drag that has blocked scrolling.

## Phone layout

Below 600px (`PHONE_QUERY`, `hooks/useMediaQuery.ts`) the editor is one
column, and dragging between far-apart containers stops being practical.

- A Tiers | Unranked switch renders one of the two at a time, so the
  unranked panel isn't stranded below every tier. Both stay inside the
  `DndContext`, so long-press reordering works within the view shown.
- Tapping a row opens `PlayerMoveMenu` (a native modal `<dialog>` as a
  bottom sheet): move to the **end** of any tier, or remove from the
  ranking. Appending keeps the menu to one choice; exact placement is a
  long-press drag within the tier afterwards. `appendPlayerToTier` handles
  the same-tier case that `movePlayerToContainer` doesn't.
- A click right after a drag ends (a touch release can produce one) is
  ignored, and `FlagButtons` stops click propagation so ★/⊘ don't also
  open the menu.
- Rows keep their fixed `PLAYER_ROW_HEIGHT` on phones — virtualization
  depends on it — so the whole row is the tap target rather than a larger
  button.

## Ranks and tiers

- `#N` is the backend's persisted global rank, carried as a static field
  and recomputed only on a fresh server sync — never from array position
  (which is wrong under a filter) or mid-drag.
- Removing a tier merges into the tier below, except the last tier, which
  merges into the tier above (`RankingRepository.removeTier`). The
  confirmation prompt reflects that and counts all of the tier's players,
  not just the filtered ones.
- The Letters/Numbers toggle is local, unpersisted state.

## Rankings and routing

- Several saved rankings per user (up to `MAX_RANKINGS_PER_USER`): CSV
  import and `POST /rankings/new` each add one. This replaced the original
  one-ranking-per-user rule, where `create()` deleted the previous ranking.
- The ranking being edited is the one picked in the ranking selector
  (`useSelectedRanking`, remembered in `localStorage`, falling back to the
  newest). The Draft tab uses the same selection, so there is no server-side
  "active ranking".
- Watch/avoid flags live in their own table, `ranking_player_flags`, not in
  `ranking_players`, because `replaceAllPlayers` rewrites every player row
  on each move. In the editor they're baked into `EditorPlayer.flag` on
  each server sync, like `globalRank`, and the toggle buttons stop
  pointer-down propagation so clicking them doesn't start a drag.
- The "drag players in" / "add more tiers" hints are derived state, so
  they reappear if the ranking returns to that state. That is intentional.
- Direct loads of client routes such as `/rankings/edit` are served by an
  explicit SPA-route allowlist (`apps/api/src/utils/spa-client-routes.ts`),
  checked at the top of the `onRequest` hook before auth and routing.
  Otherwise `GET /rankings/:rankingId` would match "edit". Add new client
  routes there.

## Player pool

A player is fantasy-relevant only if their Sleeper `fantasy_positions`
include at least one of `FANTASY_POSITIONS` (`apps/api/src/domain/ranking.ts`,
also used by CSV validation). `PlayerService.refreshPlayers()` drops
irrelevant positions at load time (`hasRelevantFantasyPosition`, position
only — inactive players stay cached so imports can still match them);
`isFantasyRelevantPlayer` additionally requires `active` at read time.

## Testing

`RankingEditorPage.test.tsx` hand-lists every mocked export of
`../api/fantasy-api`. Any new export the component uses must be added to
that mock, or the component import throws inside the test.

## Backlog

Empty. Confirm scope with the user before starting any new item — several
past items that looked simple needed real design discussion first.
