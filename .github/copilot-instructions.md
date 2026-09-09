# Repository Coding Instructions

These instructions apply to all work in this repository.

## Required Context

Before changing code, read:

1. `docs/CODING_AGENT_GUIDE.md`
2. `docs/MVP_COMPLETION_PLAN.md` — historical record of the completed MVP
   baseline, not current scope
3. `DEVELOPMENT_PLAN.md` — current scope, priorities, and agreed
   implementation order
4. The nearest implementation and test files for the requested behavior

`DEVELOPMENT_PLAN.md` is the completion plan's successor for scope purposes:
the MVP defined in `MVP_COMPLETION_PLAN.md` is done, and further work follows
the phases and dependency ordering documented in `DEVELOPMENT_PLAN.md`.

## Required Workflow

- State one local hypothesis about the behavior being changed and one focused check that can disprove it before the first edit.
- Make the smallest change that tests the hypothesis.
- After the first substantive edit, run the narrowest relevant test, typecheck, build, or lint command before broadening the work.
- Add or update focused tests for behavior changes.
- Run `pnpm test` and `pnpm build` before declaring a backend or cross-workspace change complete.
- Run `pnpm --filter @fantasy-draft-helper/web lint` for frontend changes.
- Report validation results and any remaining gaps.

## Architecture Constraints

- Keep the flow `React -> Fastify API -> Sleeper API`; the web app must never call Sleeper directly.
- Keep Sleeper communication in the client boundary and validate/map external data before it reaches domain services.
- Match ranking players to Sleeper IDs during import, persist the result, and never repeat name matching during draft polling.
- Keep recommendation logic deterministic and independently testable.
- Keep SQL in repositories; services must not contain database queries.
- Do not expose internal `Set` values or raw Sleeper payloads in JSON.
- Use the canonical API and CSV contracts in `docs/MVP_COMPLETION_PLAN.md`.

## Scope Constraints

Authentication, hosting, multi-user support, and user data separation are
tracked as Phase 2/3 items in `DEVELOPMENT_PLAN.md` — planned, but each
requires an explicit go-ahead before starting (see that document's "Decision
framing for Phases 2 & 3"). Do not start any Phase 2/3 item without that
explicit request, even though it's on the roadmap.

Do not add payments, WebSockets, automated drafting, machine learning,
positional scarcity, roster optimization, or advanced strategy unless
explicitly requested — these remain out of scope entirely, not just
phase-gated.

Do not commit changes, create branches, reset the worktree, or revert user
changes unless explicitly requested.
