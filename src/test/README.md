# Test Suite Documentation

## Overview

Comprehensive unit tests for the PR Status Monitor extension covering all scenarios, edge cases, and icon states.

## Running Tests

```bash
# Install dependencies
pnpm install

# Run tests
pnpm test

# Watch mode
pnpm run watch-tests
```

## Test Coverage

### 1. Activation Tests

- ✅ Extension activation and status bar initialization
- ✅ Command registration verification
- ✅ Initial connecting state display

### 2. Status Bar Icon Tests

- ✅ `$(sync~spin)` - Connecting animation
- ✅ `$(warning)` - Offline/error state
- ✅ `$(git-pull-request)` - Normal PR display
- ✅ Emoji status indicators: 🟢 🔴 🟠

### 3. PR Status Formatting

- ✅ Zero PRs: `$(git-pull-request) 0 PRs`
- ✅ Single PR: `$(git-pull-request) 1 PRs | 🟢1`
- ✅ Multiple PRs: `$(git-pull-request) 5 PRs | 🟢2 🔴1 🟠2`
- ✅ Conditional display (only show status types that exist)

### 4. Tooltip Tests

- ✅ Single repository format
- ✅ Multiple repository format with `[repo-name]` prefix
- ✅ Offline status messages
- ✅ No PRs found message
- ✅ Action hints

### 5. CI Status Detection

- ✅ Passing builds (`success`)
- ✅ Failed builds (`failure`)
- ✅ Pending builds (`in_progress`, `queued`)
- ✅ Timeout detection (`timed_out`)
- ✅ Cancelled builds (`cancelled`)
- ✅ Action required (`action_required`)
- ✅ Mixed status scenarios

### 6. Commit Status Fallback

- ✅ Success state
- ✅ Failure state
- ✅ Error state
- ✅ Pending state
- ✅ Fallback when no GitHub Actions available

### 7. GitHub URL Matching

- ✅ HTTPS URLs: `https://github.com/owner/repo.git`
- ✅ SSH URLs: `git@github.com:owner/repo.git`
- ✅ URLs without `.git` extension
- ✅ Non-GitHub URL rejection

### 8. Configuration Tests

- ✅ Default polling interval (2 minutes = 120000ms)
- ✅ Custom polling intervals
- ✅ Minimum interval (1 minute)
- ✅ Maximum interval (60 minutes)
- ✅ Conversion from minutes to milliseconds

### 9. Edge Cases

- ✅ Empty PR list handling
- ✅ Single PR behavior
- ✅ Multiple repos with prefixes
- ✅ Special characters in PR titles
- ✅ Very long PR titles (200+ characters)
- ✅ Missing repo information

### 10. Error Handling

- ✅ No Git extension installed
- ✅ No repository open
- ✅ Non-GitHub repository
- ✅ API errors
- ✅ No GitHub session
- ✅ Authentication failures

### 11. QuickPick Menu

- ✅ Item formatting with emoji status
- ✅ Repo prefix for multi-repo scenarios
- ✅ Single repo (no prefix)
- ✅ URL inclusion in description
- ✅ Label formatting

### 12. Status Bar Colors

- ✅ Normal state (undefined colors)
- ✅ Offline state (neutral colors)
- ✅ Color reset after errors

## Test Structure

```
src/test/
  └── extension.test.ts    # Main test suite
```

### Test Suites

1. **Activation Tests** - Extension lifecycle
2. **Status Bar Icon Tests** - Visual indicators
3. **PR Status Formatting Tests** - Text generation
4. **Tooltip Tests** - Hover information
5. **CI Status Detection Tests** - GitHub Actions parsing
6. **Commit Status Fallback Tests** - Legacy CI support
7. **GitHub URL Matching Tests** - Repository detection
8. **Configuration Tests** - Settings handling
9. **Edge Case Tests** - Boundary conditions
10. **Error Handling Tests** - Failure scenarios
11. **QuickPick Menu Tests** - Multi-PR selection
12. **Status Bar Color Tests** - Theme integration

## Icons Tested

| Icon                  | Purpose              | State       |
| --------------------- | -------------------- | ----------- |
| `$(sync~spin)`        | Connecting animation | Loading     |
| `$(warning)`          | Offline indicator    | Error       |
| `$(git-pull-request)` | PR counter           | Normal      |
| 🟢                    | Passing build        | Success     |
| 🔴                    | Failed build         | Error       |
| 🟠                    | Pending build        | In Progress |
| ⚪                    | No CI                | Neutral     |

## CI Conclusion States Tested

- ✅ `success` → 🟢
- ❌ `failure` → 🔴
- ⏱️ `timed_out` → 🔴
- 🚫 `cancelled` → 🔴
- ⚠️ `action_required` → 🔴
- 🔄 `in_progress` → 🟠
- ❓ `null` → 🟠

## Commit States Tested

- ✅ `success` → 🟢
- ❌ `failure` → 🔴
- ❌ `error` → 🔴
- 🔄 `pending` → 🟠

## Best Practices

- Tests use VS Code's built-in Mocha test framework
- Each test is isolated and independent
- Tests verify both positive and negative scenarios
- Edge cases are explicitly tested
- Icons and emojis are validated
- Configuration values are tested for correctness

## Future Enhancements

- [ ] Integration tests with real GitHub API
- [ ] Performance benchmarks
- [ ] Visual regression tests
- [ ] Accessibility tests
- [ ] Multi-language support tests
