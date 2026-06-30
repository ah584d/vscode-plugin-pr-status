# Change Log

All notable changes to the "pr-status-monitor" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [0.0.13] - 2026-06-30

### Added
- **Copilot-powered failure investigation** — new `prStatusMonitor.showInvestigateOnFailure` setting (default: `false`). When enabled, PR failure notifications show an "Investigate" button that opens Copilot Chat with a pre-filled prompt explaining the failure context.


## [0.0.12] - 2026-06-25

### Added
- AI integration files for better GitHub Copilot support
  - Added `AGENTS.md` for agent customization
  - Added `.github/copilot-instructions.md` with project conventions
  - Added `llms.txt` for AI model context
  - Added `.well-known/ai-plugin.json` for AI plugin discovery
- New status bar screenshots (`assets/status.jpg`, `assets/status2.jpg`)

### Changed
- Updated README with enhanced documentation
- Rebranding and improved descriptions

## [0.0.11] - 2026-06-21

### Added
- `STATUS_LOGIC.md` - detailed documentation of PR status determination logic
- `NEW_VERSION_INSTRUCTIONS.md` - versioning guidelines
- Unit tests for utility functions (`src/test/utils.test.ts`)
- CODEOWNERS file for repository management (later removed)

### Changed
- Improved status determination logic in `src/extension.ts`
- Enhanced type definitions in `src/types.ts`
- Updated utility functions in `src/utils.ts`
- Improved test coverage in `src/test/extension.test.ts`

### Fixed
- Status calculation now properly handles all PR states
- Fixed edge cases in CI status detection

### Removed
- `.github/CODEOWNERS` (removed before final deployment)

## [0.0.10] - 2026-06-16

### Added
- `src/types.ts` - centralized TypeScript interfaces and type definitions
- `src/utils.ts` - pure utility functions separated from extension logic
- Notification screenshot (`assets/notification.png`)

### Changed
- Refactored codebase to use pure functions for better testability
- Split monolithic `extension.ts` into modular architecture
- Updated README with new architecture details
- Improved test structure in `src/test/extension.test.ts`

## [0.0.9] - 2026-06-18

### Fixed
- Fixed issue with missing code review status
- Improved handling of PRs without review requirements

### Changed
- Updated type definitions in `src/types.ts`
- Enhanced utility functions in `src/utils.ts`
- Updated tests to cover new edge cases
- Updated README documentation

## [0.0.8] - 2026-06-12

### Added
- Comprehensive unit test suite
- Test infrastructure with `.vscode-test.mjs`
- `src/test/README.md` - testing documentation

### Changed
- Updated `.gitignore` for better exclusion patterns
- Updated license information
- Enhanced test coverage in `src/test/extension.test.ts`
- Updated README with testing instructions
- Updated dependencies in `pnpm-lock.yaml`