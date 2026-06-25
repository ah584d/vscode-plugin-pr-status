# Copilot Instructions for PR Status Monitor

## Project Overview

This is a VS Code extension written in TypeScript that monitors GitHub pull request CI statuses and displays them in the status bar.

## Architecture

- **src/extension.ts** — Entry point. Handles activation, polling lifecycle, status bar updates, notifications, and command registration.
- **src/utils.ts** — Pure functions (no side effects). All formatting, status determination, and data extraction logic lives here.
- **src/types.ts** — TypeScript interfaces. All types are explicit (no `any`).

## Coding Conventions

- Use explicit TypeScript types — avoid `any`.
- Utility functions must be pure (no VS Code API calls, no I/O).
- Keep `extension.ts` as the only file that imports `vscode`.
- Use `outputChannel.appendLine()` for debug logging, never `console.log`.
- Error handling: catch at the polling boundary, log to output channel, and show degraded status bar state rather than crashing.
- Use ESLint flat config (`eslint.config.mjs`).

## Build & Test

- Package manager: `pnpm`
- Build: `pnpm compile` (type-check + lint + esbuild)
- Watch: `pnpm watch`
- Test: `pnpm test`
- Package VSIX: `pnpm build`
- Publish: `pnpm publish`

## Dependencies

- Runtime: `@octokit/rest` (GitHub API client)
- Auth: VS Code built-in GitHub authentication provider — no tokens or secrets in code.

## Key Patterns

- Polling uses `setInterval` with two modes: fast (10s) for startup/reconnection, normal (configurable, default 2 min).
- PR status transitions are tracked via a `Map<string, string>` keyed by `owner/repo#number`.
- Status determination priority: any failure → red; any pending → yellow; all success → green.
- The extension activates on `onStartupFinished` to avoid slowing VS Code startup.
