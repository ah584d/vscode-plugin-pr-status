# AGENTS.md

## Project

PR Status Monitor — a VS Code extension that shows real-time GitHub PR CI status in the status bar.

## Language & Runtime

TypeScript, targeting the VS Code Extension Host (Node.js). Built with esbuild. Managed with pnpm.

## Repository Layout

```
src/extension.ts   — Main entry point (activation, polling, status bar, notifications)
src/utils.ts       — Pure utility functions (status logic, formatting, repo extraction)
src/types.ts       — All TypeScript interfaces
src/test/          — Unit tests (Mocha + @vscode/test-cli)
package.json       — VS Code extension manifest
esbuild.js        — Build script
eslint.config.mjs  — ESLint flat config
```

## Commands

```bash
pnpm install          # Install dependencies
pnpm compile          # Type-check + lint + build
pnpm watch            # Watch mode (esbuild + tsc)
pnpm test             # Run tests
pnpm lint             # Lint with ESLint
pnpm build            # Package as .vsix
pnpm publish          # Publish to VS Code Marketplace
```

## Conventions

- No `any` types — all interfaces are explicit in `src/types.ts`.
- Pure functions go in `src/utils.ts`; only `extension.ts` imports `vscode`.
- Logging via `outputChannel.appendLine()`, never `console.log`.
- Errors are caught at the polling boundary and result in degraded UI, not crashes.
- Authentication uses VS Code's built-in GitHub provider — no PATs or secrets in code.

## Testing

- Unit tests in `src/test/utils.test.ts` cover pure utility functions.
- Integration tests in `src/test/extension.test.ts` use `@vscode/test-electron`.
- Run `pnpm test` before submitting changes.

## Status Logic

PR CI status is determined by combining GitHub check runs and commit statuses:
- Any failure/error → 🔴 (red)
- Any pending (no conclusion yet) → 🟠 (yellow)
- All passed → 🟢 (green)

See `STATUS_LOGIC.md` for detailed rules.
