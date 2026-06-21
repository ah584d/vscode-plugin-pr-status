# PR Status Determination Matrix

This document explains when the PR Status Monitor displays 🟢 Green, 🟠 Orange, or 🔴 Red status.

## Status Logic

### 🟢 Green (Passing)

The extension shows **Green** when:

1. **All GitHub Actions check runs passed**
   - All checks have status `completed`
   - All checks have conclusion: `success`, `skipped`, or `neutral`

2. **No CI checks configured**
   - No GitHub Actions workflows found
   - No commit statuses found
   - Code review pending is ignored

3. **All commit statuses passed (legacy CI)**
   - All non-review commit statuses have state: `success`
   - Review/approval statuses are filtered out

### 🟠 Orange (Pending)

The extension shows **Orange** when:

1. **GitHub Actions checks are running**
   - At least one check run has status ≠ `completed`
   - No checks have failed yet

2. **Legacy CI statuses are pending**
   - At least one non-review commit status has state: `pending`
   - No statuses have failed

### 🔴 Red (Failed)

The extension shows **Red** when:

1. **Any GitHub Actions check failed**
   - At least one check run is `completed` with conclusion NOT in [`success`, `skipped`, `neutral`]
   - Includes: `failure`, `timed_out`, `cancelled`, `stale`, `action_required`

2. **Any legacy CI status failed**
   - At least one non-review commit status has state: `failure` or `error`

## Evaluation Order

The extension evaluates PR status in this order:

1. **GitHub Actions Check Runs** (primary)
   - Filters to only `github-actions` app (excludes code review apps)
   - If any check runs exist, use this method
   - Priority: Failed > Pending > Passing

2. **Commit Statuses** (fallback)
   - Used only when no GitHub Actions check runs exist
   - Filters out contexts containing: `review`, `approval`, `pr-status`
   - Priority: Failed > Pending > Passing

## Filtered Out (Ignored)

The following are **NOT** considered when determining CI status:

- Code review status/approvals
- PR status checks (self-referential)
- Any check run where `app.slug` ≠ `github-actions`
- Commit statuses with context containing: `review`, `approval`, `pr-status`

## Examples

### Example 1: All CI Passed, Review Pending

- GitHub Actions: 30 runs, all ✅ success
- Code Review: Pending
- **Result: 🟢 Green** (code review is ignored)

### Example 2: CI Running

- GitHub Actions: 22 runs, 18 completed, 4 in_progress
- **Result: 🟠 Orange** (some checks still running)

### Example 3: One Check Failed

- GitHub Actions: 30 runs, 29 success, 1 failure
- **Result: 🔴 Red** (any failure = red)

### Example 4: No CI Configured

- GitHub Actions: None
- Commit Statuses: Only code review
- **Result: 🟢 Green** (no CI = nothing to fail)

### Example 5: Legacy CI Pending

- GitHub Actions: None
- Commit Statuses: 2 pending (non-review), 1 success
- **Result: 🟠 Orange** (CI still pending)
