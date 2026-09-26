# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Linting

Linting is done with [oxlint](https://oxc.rs), configured in `.oxlintrc.json`
in this directory. Run it with `pnpm lint` (or `pnpm --filter
@fantasy-draft-helper/web lint`). Formatting is handled separately by
Prettier (`pnpm format` / `pnpm format:check` at the repo root) — oxlint
is linting-only here; oxfmt (Oxc's own formatter) is intentionally not
used yet, as it's still alpha and not fully Prettier-compatible.
