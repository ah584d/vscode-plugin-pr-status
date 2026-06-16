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

/**
 * Determine PR status from GitHub check runs
 */
export function determineStatusFromChecks(runs: GitHubCheckRun[]): CheckResult {
  if (runs.length === 0) {
    return { dot: "⚪", statusText: "No CI" };
  }

  const hasFailed = runs.some((run) =>
    ["failure", "timed_out", "cancelled", "action_required"].includes(
      run.conclusion ?? "",
    ),
  );
  const isPending = runs.some(
    (run) => run.status !== "completed" || run.conclusion === null,
  );

  if (hasFailed) {
    return { dot: "🔴", statusText: "Failed" };
  } else if (isPending) {
    return { dot: "🟠", statusText: "Pending" };
  } else {
    return { dot: "🟢", statusText: "Passing" };
  }
}

/**
 * Determine PR status from commit status
 */
export function determineStatusFromCommitStatus(state: string): CheckResult {
  if (state === "success") {
    return { dot: "🟢", statusText: "Passing" };
  } else if (state === "failure" || state === "error") {
    return { dot: "🔴", statusText: "Failed" };
  } else if (state === "pending") {
    return { dot: "🟠", statusText: "Pending" };
  }
  return { dot: "⚪", statusText: "No CI" };
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
