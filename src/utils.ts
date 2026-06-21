import { CheckResult, GitRepository, GitHubCheckRun } from "./types";

/**
 * Extract GitHub repository IDs from git remotes
 */
export function extractGitHubRepoIds(
  repositories: GitRepository[],
): Set<string> {
  const uniqueRepoIds = new Set<string>();

  for (const activeRepo of repositories) {
    const remotes = activeRepo.state.remotes || [];
    for (const remote of remotes) {
      if (!remote.fetchUrl) {
        continue;
      }
      const match = remote.fetchUrl.match(
        /github\.com[:/](.+)\/(.+?)(\.git)?$/,
      );
      if (match) {
        uniqueRepoIds.add(`${match[1]}/${match[2]}`);
      }
    }
  }

  return uniqueRepoIds;
}

// Conclusions that are NOT failures (everything else counts as red)
const NON_FAILING_CONCLUSIONS = ["success", "skipped", "neutral"];

/**
 * Determine PR status from GitHub check runs.
 *
 * Only GitHub Actions runs are considered — code-review gate checks and any
 * other non-CI app checks are excluded.
 *
 * A run is a failure when it completes with any conclusion outside of
 * success/skipped/neutral (e.g. failure, timed_out, cancelled, stale,
 * action_required, or any future conclusion GitHub may add).
 */
export function determineStatusFromChecks(
  allRuns: GitHubCheckRun[],
): CheckResult {
  // Exclude code-review gate checks; keep only GitHub Actions CI runs.
  const runs = allRuns.filter((run) => run.app?.slug === "github-actions");

  if (runs.length === 0) {
    return { dot: "🟢", statusText: "Passing" };
  }

  // Any completed run whose conclusion is not in the non-failing set is red.
  const hasFailed = runs.some(
    (run) =>
      run.status === "completed" &&
      !NON_FAILING_CONCLUSIONS.includes(run.conclusion ?? ""),
  );

  // Failed takes priority over pending.
  if (hasFailed) {
    return { dot: "🔴", statusText: "Failed" };
  }

  const isPending = runs.some((run) => run.status !== "completed");
  if (isPending) {
    return { dot: "🟠", statusText: "Pending" };
  }

  return { dot: "🟢", statusText: "Passing" };
}

/**
 * Determine PR status from individual commit statuses, filtering out code review checks
 */
export function determineStatusFromCommitStatuses(
  statuses: Array<{ state: string; context: string }>,
): CheckResult {
  // Filter out code review and other non-CI contexts
  const ciStatuses = statuses.filter((s) => {
    const ctx = s.context.toLowerCase();
    // Exclude common review/approval contexts
    return (
      !ctx.includes("review") &&
      !ctx.includes("approval") &&
      !ctx.includes("pr-status")
    );
  });

  if (ciStatuses.length === 0) {
    return { dot: "🟢", statusText: "Passing" };
  }

  // Check for any failures
  const hasFailed = ciStatuses.some(
    (s) => s.state === "failure" || s.state === "error",
  );
  if (hasFailed) {
    return { dot: "🔴", statusText: "Failed" };
  }

  // Check for pending
  const isPending = ciStatuses.some((s) => s.state === "pending");
  if (isPending) {
    return { dot: "🟠", statusText: "Pending" };
  }

  // All CI statuses are successful
  return { dot: "🟢", statusText: "Passing" };
}

/**
 * Build status bar text from PR counts
 */
export function buildStatusBarText(
  totalPRs: number,
  successCount: number,
  failureCount: number,
  pendingCount: number,
): string {
  let statusString = `\$(git-pull-request) ${totalPRs} PRs |`;
  if (successCount > 0) {
    statusString += ` 🟢${successCount}`;
  }
  if (failureCount > 0) {
    statusString += ` 🔴${failureCount}`;
  }
  if (pendingCount > 0) {
    statusString += ` 🟠${pendingCount}`;
  }
  return statusString;
}

/**
 * Build tooltip line for a PR
 */
export function buildTooltipLine(
  prDot: string,
  repoPrefix: string,
  prNumber: number,
  prTitle: string,
  prStatusText: string,
): string {
  return `${prDot} ${repoPrefix}#${prNumber}: ${prTitle} (${prStatusText})`;
}

/**
 * Build tooltip text from lines
 */
export function buildTooltipText(lines: string[]): string {
  return `Your Open PRs:\n\n${lines.join("\n")}\n\nClick to select a PR to open.`;
}

/**
 * Extract repository owner and name from repository URL
 */
export function extractRepoInfo(repositoryUrl: string): {
  owner: string;
  repo: string;
} {
  const repoUrlMatch = repositoryUrl.match(/repos\/(.+)\/(.+)$/);
  return {
    owner: repoUrlMatch ? repoUrlMatch[1] : "",
    repo: repoUrlMatch ? repoUrlMatch[2] : "",
  };
}

/**
 * Create PR key for tracking status changes
 */
export function createPRKey(
  owner: string,
  repo: string,
  prNumber: number,
): string {
  return `${owner}/${repo}#${prNumber}`;
}

/**
 * Get repository prefix for multi-repo scenarios
 */
export function getRepoPrefix(
  repoName: string,
  hasMultipleRepos: boolean,
): string {
  return hasMultipleRepos ? `[${repoName}] ` : "";
}

/**
 * Build GitHub search query for finding user's PRs
 */
export function buildGitHubSearchQuery(
  uniqueRepoIds: Set<string>,
  username: string,
): string {
  const repoQueries = Array.from(uniqueRepoIds)
    .map((id) => `repo:${id}`)
    .join(" ");
  return `is:pr is:open author:${username} ${repoQueries}`;
}

/**
 * Build QuickPick items from PR list
 */
export function buildQuickPickItems(
  prs: Array<{ status: string; repo: string; title: string; url: string }>,
) {
  return prs.map((pr) => ({
    label: `${pr.status} ${pr.repo ? `[${pr.repo}] ` : ""}${pr.title}`,
    description: pr.url,
    url: pr.url,
  }));
}

/**
 * Build notification message for PR status change
 */
export function buildNotificationMessage(
  statusChange: "success" | "failure",
  repoPrefix: string,
  prNumber: number,
): string {
  if (statusChange === "success") {
    return `✅ PR ${repoPrefix}#${prNumber} is now passing!`;
  } else {
    return `❌ PR ${repoPrefix}#${prNumber} has failed!`;
  }
}

/**
 * Format PR status data as a table
 */
export function formatPRTable(
  prData: Array<{
    status: string;
    repo: string;
    prNumber: number;
    title: string;
    sha: string;
    checksInfo: string;
  }>,
): string {
  if (prData.length === 0) {
    return "No PRs to display";
  }

  // Calculate column widths
  const maxRepoLen = Math.max(4, ...prData.map((pr) => pr.repo.length));
  const maxPRLen = Math.max(
    3,
    ...prData.map((pr) => pr.prNumber.toString().length),
  );
  const maxChecksLen = Math.max(6, ...prData.map((pr) => pr.checksInfo.length));

  // Build header (no borders, just spacing)
  const header = `Status  ${"Repo".padEnd(maxRepoLen)}  ${"PR#".padEnd(maxPRLen)}  Title                                                       ${"SHA".padEnd(7)}  ${"Checks".padEnd(maxChecksLen)}`;
  const separator = "─".repeat(header.length);

  // Build rows
  const rows = prData.map((pr) => {
    const truncatedTitle =
      pr.title.length > 60 ? pr.title.substring(0, 57) + "..." : pr.title;
    return `${pr.status}  ${pr.repo.padEnd(maxRepoLen)}  ${pr.prNumber.toString().padEnd(maxPRLen)}  ${truncatedTitle.padEnd(60)}  ${pr.sha.padEnd(7)}  ${pr.checksInfo.padEnd(maxChecksLen)}`;
  });

  // Combine all parts
  return [header, separator, ...rows].join("\n");
}
