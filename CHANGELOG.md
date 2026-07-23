# Change Log

All notable changes to the "pr-status-monitor" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [0.0.15] - 202x-xx-xx

### Added

-

### Changed

- Update README

### Tests

## [0.0.14] - 2026-07-01

### Added

- **Automatic investigation prompt firing** — when `prStatusMonitor.showInvestigateOnFailure` is enabled, Copilot Chat now opens automatically with investigation context whenever a PR fails, in addition to showing the notification button.

### Changed

- Code formatting improvements for better readability

### Tests

- Added comprehensive unit tests for automatic prompt firing behavior
- Tests cover single and multiple PR failures with feature enabled/disabled
- Tests verify correct PR numbers and URLs are passed to investigation chat

## [0.0.13] - 2026-06-30

### Added

- **Copilot-powered failure investigation** — new `prStatusMonitor.showInvestigateOnFailure` setting (default: `false`). When enabled, PR failure notifications show an "Investigate" button that opens Copilot Chat with a pre-filled prompt explaining the failure context.

## [0.0.12] - 2026-06-25

### Added

- Enhanced AI integration for better GitHub Copilot support and assistance
- Comprehensive project documentation for AI tools
- New visual assets and screenshots

### Changed

- Updated documentation with clearer usage instructions
- Improved branding and extension description

## [0.0.11] - 2026-06-21

### Added

- Detailed documentation of PR status determination logic
- Versioning guidelines for maintainers
- Comprehensive unit test coverage for core functionality

### Changed

- Improved PR status calculation accuracy
- Better handling of complex CI workflow states

### Fixed

- Status calculation now properly handles all PR states
- Fixed edge cases in CI status detection

## [0.0.10] - 2026-06-16

### Added

- Notification feature with visual feedback

### Changed

- Major code architecture refactoring for improved maintainability
- Better separation of concerns with modular design
- Improved code testability

## [0.0.9] - 2026-06-18

### Fixed

- Fixed issue with missing code review status detection
- Improved handling of PRs without review requirements

### Changed

- Enhanced test coverage for edge cases
- Updated documentation

## [0.0.8] - 2026-06-12

### Added

- Comprehensive unit test suite for reliability
- Testing documentation and infrastructure

### Changed

- Improved development workflow
- Updated license information
- Better code quality with enhanced testing
