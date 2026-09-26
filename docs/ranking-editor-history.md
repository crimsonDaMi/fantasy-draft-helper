# Ranking editor — history and current backlog

Condensed history of Phase 4 (the ranking editor: a drag-and-drop UI at
`/rankings/edit` for reordering ranked players across tiers, adding/
removing tier boundaries, and moving players in/out of an "unranked"
pool) and everything since. Read this before re-investigating anything
here that might already be a solved problem.

## Build (Phase 4, complete, released v0.8.0)

Routing (`/rankings/edit` via react-router-dom) → read-only editor
(tiers + unranked panel via TanStack Query) → drag-and-drop mutations
(`@dnd-kit`, PATCH/DELETE player endpoints, `computeGlobalRank` for
cross-tier drops; pure helpers live in `ranking-editor-logic.ts`,
drag-library-agnostic and unit tested there) → tier add/remove controls,
Letters/Numbers tier display toggle, re-import invalidation. Full
requirements in `docs/ranking-editor-requirements.md`.

## Drag-and-drop performance (resolved)

At real scale (~360 players, 12 tiers), drag was unusably slow. Root
cause, confirmed via profiling and an isolation test: `@dnd-kit`'s
`useSortable` overhead scales with the **total** number of
simultaneously-mounted sortable DOM nodes on the page, not the active
tier's size. Several app-level micro-optimizations were correctly
targeted but didn't touch this. Real fix: virtualized every tier +
unranked container with `@tanstack/react-virtual` — only visible rows +
overscan are mounted as real sortable nodes; the actively-dragged row is
force-kept-mounted (`withForcedActiveRow`) if it scrolls out of the
virtualized window. This constraint is load-bearing — any change to how
containers render must preserve it.

## Container-boundary bugs (resolved)

Four bugs surfaced post-virtualization, all at tier↔tier / tier↔unranked
crossings:

- Source container auto-scrolling wrong during a cross-container drag —
  `@dnd-kit`'s built-in `autoScroll` doesn't retarget across
  independently-virtualized containers. Fixed with `autoScroll={false}`
  plus a custom pointer-driven autoscroll targeting whichever container
  is under the pointer.
- A player becoming permanently ungrabbable after an unranked→tier
  move — caused by a race between two independently-refetching queries
  letting the same player appear in both containers momentarily,
  corrupting `@dnd-kit`'s per-id registry. Fixed in `buildContainers`,
  which now filters players already in a tier out of the unranked list
  unconditionally.
- A reported "player vanishes after move to unranked" was not a real
  bug — confirmed present in the API response, just a findability
  problem in a ~9k-entry unsorted list (resolved by the search/filter
  work below).
- One "page goes blank" report was never reproducible; closed without a
  fix.

## Polish backlog (six items, all resolved)

1. Unranked panel scrolling out of view — `position: sticky` wrapper.
2. Editor usable without an imported ranking (see next section).
3. `#N` numbering was tier-local (wrong under a position filter) —
   switched to the backend's already-persisted true global rank,
   threaded through as a static field, only recomputed on a fresh server
   sync (never mid-drag or from filtered array position).
4. Direct reload of `/rankings/edit` 404'd — a real route collision
   (`GET /rankings/:rankingId` matching "edit" as a literal id) plus the
   auth guard catching it even earlier when logged out. Fixed with an
   explicit SPA-route allowlist (`apps/api/src/utils/spa-client-routes.ts`)
   checked at the very top of the `onRequest` hook, before auth/routing.
5. Dragging near the bottom of the page didn't autoscroll the whole
   page (only the inner virtualized scrollboxes did) — restricted
   `autoScroll.canScroll` to `document.scrollingElement`/
   `documentElement` only (inner-box autoscroll during drag was a known,
   accepted trade-off loss).
6. Login/register username field only autofocused on initial mount
   (shared input, no remount on tab switch) — `useRef` +
   `useEffect(focus, [mode])`.

Also shipped along the way: case-insensitive name/team search for the
unranked panel, plus a _global_ position filter (all tiers + unranked,
not just unranked). Both filter helpers return the original array
reference unchanged when no filter is active — a deliberate no-op
optimization to avoid reintroducing per-dragover-frame cost.

## Building a ranking from scratch (resolved)

Users can now open `/rankings/edit` with no imported ranking and build
one by dragging players out of the unranked pool, via an explicit
"Start a new ranking" button (not auto-created on page load).

- `RankingRepository.create()` now deletes all of a user's existing
  rankings before inserting a new one (cascades via existing FK
  `ON DELETE CASCADE`) — one active ranking per user, no disk clutter,
  for both CSV import and the new empty-ranking path.
- `POST /rankings/new` creates an empty ranking; the existing
  `seedTiersFromMatches` logic already seeds one tier ("S") when there
  are zero tiered matches, so no repository-invariant work was needed.
- Hints ("drag players in" / "add more tiers") are pure derived state,
  not a dismiss flag — they can legitimately reappear if the ranking
  returns to that state later (e.g. last player dragged back out); this
  is intentional, not a bug.
- `DraftDashboard` previously held its `rankingId` as pure session-local
  state with no reload path at all. Now falls back to
  `GET /rankings/status` when nothing was imported this session, so a
  ranking created in the editor (or from an earlier session) reaches the
  Draft tab too.
- One drop-target case was never previously exercised: dropping into an
  _empty_ tier. The virtualized container's height is driven by
  `virtualizer.getTotalSize()`, which is 0px for zero players, so the
  droppable area had no hit-testable area at all. Fixed with a
  `min-height` on the scroll wrapper plus a "Drop players here"
  placeholder shown when a container is empty.
- `RankingEditorPage.test.tsx` hand-lists every mocked export of
  `../api/fantasy-api` — any new export the component uses must be added
  to that mock or the component import throws inside the test.

## Tooling: oxlint adoption (resolved)

- `apps/web`: ESLint replaced with oxlint for **linting only** — Prettier
  stays for formatting (oxfmt intentionally not adopted; still alpha,
  not fully Prettier-compatible). Config generated via `@oxlint/migrate`
  from the old `eslint.config.js`, then trimmed of stylistic-rule
  entries and an unused 7-package `jsPlugins` array that existed only to
  satisfy `eslint-config-prettier`'s defensive coverage of plugins never
  actually used here.
- `apps/api`: had no lint tooling at all before this (just `tsc` for
  type-checking) — added oxlint with type-aware rules from day one
  (`oxlint --type-aware`, via `oxlint-tsgolint`; this is genuinely alpha
  tooling upstream, worth remembering if something looks off). One
  override needed: `typescript/unbound-method` is silenced for
  `**/*.test.ts` — a known false-positive class when passing a mock
  method reference to `expect(...).toHaveBeenCalledTimes(...)`, not an
  actual unbound-`this` bug.
- Root `pnpm lint` now runs both workspaces.

## Tooling: format-on-save fix (resolved)

- Saving `RankingEditorPage.tsx` in VS Code kept stripping two spaces of
  indentation from the wrapped `=== targetContainer || ...` line in the
  `collisionDetectionStrategy` filter block, failing `pnpm format:check`.
  Originally assumed to be local editor config; the actual cause was the
  committed `.vscode/settings.json`, which set the TS/TSX
  `editor.defaultFormatter` to VS Code's built-in TypeScript formatter
  instead of Prettier — the two disagree on continuation-line indentation.
- Fixed by making `esbenp.prettier-vscode` the default formatter (global
  and for TS/TSX), recommending it in `.vscode/extensions.json`, and
  dropping the stale `source.fixAll.eslint` save action left over from
  the ESLint → oxlint switch.

## Dev-mode CORS fix (resolved)

- Under `pnpm dev` (web on 5173, API on 3000) the ranking editor's
  PATCH/DELETE calls failed CORS preflight. Cause: `@fastify/cors`
  defaults `methods` to `GET,HEAD,POST`. Fixed by listing
  `GET, HEAD, POST, PATCH, DELETE` explicitly in `apps/api/src/app.ts`,
  covered by a preflight test in `app.e2e.test.ts`. A Vite dev proxy
  (same-origin dev, like prod) was considered and rejected as a larger
  change than needed.

## Current backlog (not started)

1. **Unranked list long-name line wrap**: a long player name wraps to a
   second line in the unranked panel, pushing the row separator down
   into the next item, which visually reads as a strikethrough on the
   _next_ row's name.

Do not start any of these without confirming scope with the user first —
several past items in this history looked simple at first glance and
turned out to need real design discussion before the first diff.
