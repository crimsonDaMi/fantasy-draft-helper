# Web app

React + TypeScript + Vite front end. See the root [`README.md`](../../README.md)
for running and building it.

Linting uses [oxlint](https://oxc.rs), configured in `.oxlintrc.json` in
this directory (`pnpm --filter @fantasy-draft-helper/web lint`). Formatting
is Prettier, run from the repo root (`pnpm format` / `pnpm format:check`);
oxfmt is intentionally not used yet, since it is still alpha and not fully
Prettier-compatible.
