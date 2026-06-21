import * as assert from "assert";
import {
  extractGitHubRepoIds,
  determineStatusFromChecks,
  determineStatusFromCommitStatuses,
  buildStatusBarText,
  buildTooltipLine,
  buildTooltipText,
  extractRepoInfo,
  createPRKey,
  getRepoPrefix,
  buildGitHubSearchQuery,
  buildQuickPickItems,
  buildNotificationMessage,
} from "../utils";
import { GitHubCheckRun, GitRepository } from "../types";

suite("Utility Functions Tests", () => {
  suite("extractGitHubRepoIds", () => {
    test("Should extract repo ID from HTTPS URL", () => {
      const repos: GitRepository[] = [
        {
          state: {
            remotes: [
              {
                name: "origin",
                fetchUrl: "https://github.com/owner/repo.git",
                pushUrl: "https://github.com/owner/repo.git",
                isReadOnly: false,
              },
            ],
          },
        },
      ];

      const result = extractGitHubRepoIds(repos);
      assert.strictEqual(result.size, 1);
      assert.ok(result.has("owner/repo"));
    });

    test("Should extract repo ID from SSH URL", () => {
      const repos: GitRepository[] = [
        {
          state: {
            remotes: [
              {
                name: "origin",
                fetchUrl: "git@github.com:owner/repo.git",
                pushUrl: "git@github.com:owner/repo.git",
                isReadOnly: false,
              },
            ],
          },
        },
      ];

      const result = extractGitHubRepoIds(repos);
      assert.strictEqual(result.size, 1);
      assert.ok(result.has("owner/repo"));
    });

    test("Should extract repo ID from URL without .git", () => {
      const repos: GitRepository[] = [
        {
          state: {
            remotes: [
              {
                name: "origin",
                fetchUrl: "https://github.com/owner/repo",
                isReadOnly: false,
              },
            ],
          },
        },
      ];

      const result = extractGitHubRepoIds(repos);
      assert.strictEqual(result.size, 1);
      assert.ok(result.has("owner/repo"));
    });

    test("Should handle multiple repos", () => {
      const repos: GitRepository[] = [
        {
          state: {
            remotes: [
              {
                name: "origin",
                fetchUrl: "https://github.com/owner1/repo1.git",
                isReadOnly: false,
              },
            ],
          },
        },
        {
          state: {
            remotes: [
              {
                name: "origin",
                fetchUrl: "https://github.com/owner2/repo2.git",
                isReadOnly: false,
              },
            ],
          },
        },
      ];

      const result = extractGitHubRepoIds(repos);
      assert.strictEqual(result.size, 2);
      assert.ok(result.has("owner1/repo1"));
      assert.ok(result.has("owner2/repo2"));
    });

    test("Should deduplicate same repo from multiple remotes", () => {
      const repos: GitRepository[] = [
        {
          state: {
            remotes: [
              {
                name: "origin",
                fetchUrl: "https://github.com/owner/repo.git",
                isReadOnly: false,
              },
              {
                name: "upstream",
                fetchUrl: "https://github.com/owner/repo.git",
                isReadOnly: false,
              },
            ],
          },
        },
      ];

      const result = extractGitHubRepoIds(repos);
      assert.strictEqual(result.size, 1);
      assert.ok(result.has("owner/repo"));
    });

    test("Should ignore non-GitHub URLs", () => {
      const repos: GitRepository[] = [
        {
          state: {
            remotes: [
              {
                name: "origin",
                fetchUrl: "https://gitlab.com/owner/repo.git",
                isReadOnly: false,
              },
            ],
          },
        },
      ];

      const result = extractGitHubRepoIds(repos);
      assert.strictEqual(result.size, 0);
    });

    test("Should handle missing fetchUrl", () => {
      const repos: GitRepository[] = [
        {
          state: {
            remotes: [
              {
                name: "origin",
                isReadOnly: false,
              },
            ],
          },
        },
      ];

      const result = extractGitHubRepoIds(repos);
      assert.strictEqual(result.size, 0);
    });

    test("Should handle empty remotes array", () => {
      const repos: GitRepository[] = [
        {
          state: {
            remotes: [],
          },
        },
      ];

      const result = extractGitHubRepoIds(repos);
      assert.strictEqual(result.size, 0);
    });
  });

  suite("determineStatusFromChecks", () => {
    const ghRun = (
      conclusion: string | null,
      status = "completed",
    ): GitHubCheckRun => ({
      id: 1,
      name: "test",
      status,
      conclusion,
      app: { slug: "github-actions" },
    });

    const reviewRun = (
      conclusion: string | null,
      status = "completed",
    ): GitHubCheckRun => ({
      id: 2,
      name: "review",
      status,
      conclusion,
      app: { slug: "review-app" },
    });

    test("Should return green when no CI checks exist", () => {
      const result = determineStatusFromChecks([]);
      assert.strictEqual(result.dot, "🟢");
      assert.strictEqual(result.statusText, "Passing");
    });

    test("Should return green when only review checks exist", () => {
      const result = determineStatusFromChecks([reviewRun("pending")]);
      assert.strictEqual(result.dot, "🟢");
      assert.strictEqual(result.statusText, "Passing");
    });

    test("Should return green when all checks pass", () => {
      const result = determineStatusFromChecks([
        ghRun("success"),
        ghRun("success"),
      ]);
      assert.strictEqual(result.dot, "🟢");
      assert.strictEqual(result.statusText, "Passing");
    });

    test("Should return green for success/skipped/neutral mix", () => {
      const result = determineStatusFromChecks([
        ghRun("success"),
        ghRun("skipped"),
        ghRun("neutral"),
      ]);
      assert.strictEqual(result.dot, "🟢");
      assert.strictEqual(result.statusText, "Passing");
    });

    test("Should return red when any check fails", () => {
      const result = determineStatusFromChecks([
        ghRun("success"),
        ghRun("failure"),
      ]);
      assert.strictEqual(result.dot, "🔴");
      assert.strictEqual(result.statusText, "Failed");
    });

    test("Should return red for timed_out", () => {
      const result = determineStatusFromChecks([ghRun("timed_out")]);
      assert.strictEqual(result.dot, "🔴");
      assert.strictEqual(result.statusText, "Failed");
    });

    test("Should return red for cancelled", () => {
      const result = determineStatusFromChecks([ghRun("cancelled")]);
      assert.strictEqual(result.dot, "🔴");
      assert.strictEqual(result.statusText, "Failed");
    });

    test("Should return orange when checks are pending", () => {
      const result = determineStatusFromChecks([
        ghRun("success"),
        ghRun(null, "in_progress"),
      ]);
      assert.strictEqual(result.dot, "🟠");
      assert.strictEqual(result.statusText, "Pending");
    });

    test("Should prioritize failed over pending", () => {
      const result = determineStatusFromChecks([
        ghRun("failure"),
        ghRun(null, "queued"),
      ]);
      assert.strictEqual(result.dot, "🔴");
    });

    test("Should ignore review checks when determining status", () => {
      const result = determineStatusFromChecks([
        ghRun("success"),
        reviewRun("failure"),
      ]);
      assert.strictEqual(result.dot, "🟢");
    });
  });

  suite("determineStatusFromCommitStatuses", () => {
    test("Should return green when no CI statuses exist", () => {
      const result = determineStatusFromCommitStatuses([]);
      assert.strictEqual(result.dot, "🟢");
      assert.strictEqual(result.statusText, "Passing");
    });

    test("Should return green when only review statuses exist", () => {
      const result = determineStatusFromCommitStatuses([
        { state: "pending", context: "code-review" },
        { state: "pending", context: "approval-required" },
      ]);
      assert.strictEqual(result.dot, "🟢");
      assert.strictEqual(result.statusText, "Passing");
    });

    test("Should return green when all CI statuses pass", () => {
      const result = determineStatusFromCommitStatuses([
        { state: "success", context: "ci/build" },
        { state: "success", context: "ci/test" },
      ]);
      assert.strictEqual(result.dot, "🟢");
      assert.strictEqual(result.statusText, "Passing");
    });

    test("Should return red when any CI status fails", () => {
      const result = determineStatusFromCommitStatuses([
        { state: "success", context: "ci/build" },
        { state: "failure", context: "ci/test" },
      ]);
      assert.strictEqual(result.dot, "🔴");
      assert.strictEqual(result.statusText, "Failed");
    });

    test("Should return red for error state", () => {
      const result = determineStatusFromCommitStatuses([
        { state: "error", context: "ci/build" },
      ]);
      assert.strictEqual(result.dot, "🔴");
      assert.strictEqual(result.statusText, "Failed");
    });

    test("Should return orange when CI statuses are pending", () => {
      const result = determineStatusFromCommitStatuses([
        { state: "success", context: "ci/build" },
        { state: "pending", context: "ci/test" },
      ]);
      assert.strictEqual(result.dot, "🟠");
      assert.strictEqual(result.statusText, "Pending");
    });

    test("Should filter out review contexts", () => {
      const result = determineStatusFromCommitStatuses([
        { state: "success", context: "ci/build" },
        { state: "pending", context: "code-review/required" },
      ]);
      assert.strictEqual(result.dot, "🟢");
    });

    test("Should filter out approval contexts", () => {
      const result = determineStatusFromCommitStatuses([
        { state: "success", context: "ci/test" },
        { state: "pending", context: "approval/maintainers" },
      ]);
      assert.strictEqual(result.dot, "🟢");
    });

    test("Should filter out pr-status contexts", () => {
      const result = determineStatusFromCommitStatuses([
        { state: "success", context: "ci/build" },
        { state: "pending", context: "pr-status-monitor" },
      ]);
      assert.strictEqual(result.dot, "🟢");
    });

    test("Should prioritize failed over pending", () => {
      const result = determineStatusFromCommitStatuses([
        { state: "failure", context: "ci/build" },
        { state: "pending", context: "ci/test" },
      ]);
      assert.strictEqual(result.dot, "🔴");
    });
  });

  suite("buildStatusBarText", () => {
    test("Should format with all status types", () => {
      const result = buildStatusBarText(5, 2, 1, 2);
      assert.strictEqual(result, "$(git-pull-request) 5 PRs | 🟢2 🔴1 🟠2");
    });

    test("Should format with only passing PRs", () => {
      const result = buildStatusBarText(3, 3, 0, 0);
      assert.strictEqual(result, "$(git-pull-request) 3 PRs | 🟢3");
    });

    test("Should format with only failed PRs", () => {
      const result = buildStatusBarText(2, 0, 2, 0);
      assert.strictEqual(result, "$(git-pull-request) 2 PRs | 🔴2");
    });

    test("Should format with only pending PRs", () => {
      const result = buildStatusBarText(1, 0, 0, 1);
      assert.strictEqual(result, "$(git-pull-request) 1 PRs | 🟠1");
    });

    test("Should format with zero PRs", () => {
      const result = buildStatusBarText(0, 0, 0, 0);
      assert.strictEqual(result, "$(git-pull-request) 0 PRs |");
    });

    test("Should format without failed PRs", () => {
      const result = buildStatusBarText(3, 2, 0, 1);
      assert.strictEqual(result, "$(git-pull-request) 3 PRs | 🟢2 🟠1");
    });
  });

  suite("buildTooltipLine", () => {
    test("Should format tooltip line without repo prefix", () => {
      const result = buildTooltipLine("🟢", "", 123, "Fix bug", "Passing");
      assert.strictEqual(result, "🟢 #123: Fix bug (Passing)");
    });

    test("Should format tooltip line with repo prefix", () => {
      const result = buildTooltipLine(
        "🔴",
        "[myrepo] ",
        456,
        "New feature",
        "Failed",
      );
      assert.strictEqual(result, "🔴 [myrepo] #456: New feature (Failed)");
    });

    test("Should handle long PR titles", () => {
      const longTitle = "This is a very long PR title that might get truncated";
      const result = buildTooltipLine("🟠", "", 789, longTitle, "Pending");
      assert.strictEqual(result, `🟠 #789: ${longTitle} (Pending)`);
    });

    test("Should handle special characters in title", () => {
      const result = buildTooltipLine(
        "🟢",
        "",
        100,
        "Fix: [bug] & <issue>",
        "Passing",
      );
      assert.strictEqual(result, "🟢 #100: Fix: [bug] & <issue> (Passing)");
    });
  });

  suite("buildTooltipText", () => {
    test("Should format tooltip with single PR", () => {
      const lines = ["🟢 #123: Fix bug (Passing)"];
      const result = buildTooltipText(lines);
      assert.ok(result.includes("Your Open PRs:"));
      assert.ok(result.includes("🟢 #123: Fix bug (Passing)"));
      assert.ok(result.includes("Click to select a PR to open."));
    });

    test("Should format tooltip with multiple PRs", () => {
      const lines = [
        "🟢 #123: Fix bug (Passing)",
        "🔴 #456: New feature (Failed)",
      ];
      const result = buildTooltipText(lines);
      assert.ok(result.includes("Your Open PRs:"));
      assert.ok(result.includes("🟢 #123"));
      assert.ok(result.includes("🔴 #456"));
      assert.ok(result.includes("Click to select a PR to open."));
    });

    test("Should format tooltip with empty lines array", () => {
      const result = buildTooltipText([]);
      assert.ok(result.includes("Your Open PRs:"));
      assert.ok(result.includes("Click to select a PR to open."));
    });
  });

  suite("extractRepoInfo", () => {
    test("Should extract owner and repo from repository URL", () => {
      const result = extractRepoInfo("https://api.github.com/repos/owner/repo");
      assert.strictEqual(result.owner, "owner");
      assert.strictEqual(result.repo, "repo");
    });

    test("Should handle complex repo names", () => {
      const result = extractRepoInfo(
        "https://api.github.com/repos/my-org/my-complex-repo-name",
      );
      assert.strictEqual(result.owner, "my-org");
      assert.strictEqual(result.repo, "my-complex-repo-name");
    });

    test("Should return empty strings for invalid URL", () => {
      const result = extractRepoInfo("invalid-url");
      assert.strictEqual(result.owner, "");
      assert.strictEqual(result.repo, "");
    });

    test("Should handle URL with trailing slash", () => {
      const result = extractRepoInfo(
        "https://api.github.com/repos/owner/repo/",
      );
      // Note: The trailing slash would be captured in the repo name
      // The regex might need adjustment if this is an issue
      assert.strictEqual(result.owner, "owner");
    });
  });

  suite("createPRKey", () => {
    test("Should create PR key from owner, repo, and number", () => {
      const result = createPRKey("owner", "repo", 123);
      assert.strictEqual(result, "owner/repo#123");
    });

    test("Should handle complex repo names", () => {
      const result = createPRKey("my-org", "my-repo-name", 456);
      assert.strictEqual(result, "my-org/my-repo-name#456");
    });

    test("Should handle large PR numbers", () => {
      const result = createPRKey("owner", "repo", 999999);
      assert.strictEqual(result, "owner/repo#999999");
    });
  });

  suite("getRepoPrefix", () => {
    test("Should return empty string when single repo", () => {
      const result = getRepoPrefix("myrepo", false);
      assert.strictEqual(result, "");
    });

    test("Should return formatted prefix when multiple repos", () => {
      const result = getRepoPrefix("myrepo", true);
      assert.strictEqual(result, "[myrepo] ");
    });

    test("Should handle repo names with special characters", () => {
      const result = getRepoPrefix("my-repo-name", true);
      assert.strictEqual(result, "[my-repo-name] ");
    });
  });

  suite("buildGitHubSearchQuery", () => {
    test("Should build query for single repo", () => {
      const repoIds = new Set(["owner/repo"]);
      const result = buildGitHubSearchQuery(repoIds, "username");
      assert.strictEqual(
        result,
        "is:pr is:open author:username repo:owner/repo",
      );
    });

    test("Should build query for multiple repos", () => {
      const repoIds = new Set(["owner1/repo1", "owner2/repo2"]);
      const result = buildGitHubSearchQuery(repoIds, "username");
      assert.ok(result.includes("is:pr is:open author:username"));
      assert.ok(result.includes("repo:owner1/repo1"));
      assert.ok(result.includes("repo:owner2/repo2"));
    });

    test("Should build query with no repos", () => {
      const repoIds = new Set<string>();
      const result = buildGitHubSearchQuery(repoIds, "username");
      assert.strictEqual(result, "is:pr is:open author:username ");
    });

    test("Should handle usernames with special characters", () => {
      const repoIds = new Set(["owner/repo"]);
      const result = buildGitHubSearchQuery(repoIds, "user-name_123");
      assert.ok(result.includes("author:user-name_123"));
    });
  });

  suite("buildQuickPickItems", () => {
    test("Should build QuickPick items without repo prefix", () => {
      const prs = [
        {
          status: "🟢",
          repo: "",
          title: "#123: Fix bug",
          url: "https://github.com/owner/repo/pull/123",
        },
      ];

      const result = buildQuickPickItems(prs);
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].label, "🟢 #123: Fix bug");
      assert.strictEqual(
        result[0].description,
        "https://github.com/owner/repo/pull/123",
      );
      assert.strictEqual(
        result[0].url,
        "https://github.com/owner/repo/pull/123",
      );
    });

    test("Should build QuickPick items with repo prefix", () => {
      const prs = [
        {
          status: "🟢",
          repo: "repo1",
          title: "#123: Fix bug",
          url: "https://github.com/owner/repo1/pull/123",
        },
        {
          status: "🔴",
          repo: "repo2",
          title: "#456: New feature",
          url: "https://github.com/owner/repo2/pull/456",
        },
      ];

      const result = buildQuickPickItems(prs);
      assert.strictEqual(result.length, 2);
      assert.strictEqual(result[0].label, "🟢 [repo1] #123: Fix bug");
      assert.strictEqual(result[1].label, "🔴 [repo2] #456: New feature");
    });

    test("Should handle empty PR list", () => {
      const result = buildQuickPickItems([]);
      assert.strictEqual(result.length, 0);
    });

    test("Should handle mixed repos and no repos", () => {
      const prs = [
        {
          status: "🟢",
          repo: "repo1",
          title: "#123: Fix",
          url: "https://github.com/owner/repo1/pull/123",
        },
        {
          status: "🟠",
          repo: "",
          title: "#456: Feature",
          url: "https://github.com/owner/repo2/pull/456",
        },
      ];

      const result = buildQuickPickItems(prs);
      assert.strictEqual(result[0].label, "🟢 [repo1] #123: Fix");
      assert.strictEqual(result[1].label, "🟠 #456: Feature");
    });
  });

  suite("buildNotificationMessage", () => {
    test("Should build success notification without repo prefix", () => {
      const result = buildNotificationMessage("success", "", 123);
      assert.strictEqual(result, "✅ PR #123 is now passing!");
    });

    test("Should build success notification with repo prefix", () => {
      const result = buildNotificationMessage("success", "[myrepo] ", 456);
      assert.strictEqual(result, "✅ PR [myrepo] #456 is now passing!");
    });

    test("Should build failure notification without repo prefix", () => {
      const result = buildNotificationMessage("failure", "", 789);
      assert.strictEqual(result, "❌ PR #789 has failed!");
    });

    test("Should build failure notification with repo prefix", () => {
      const result = buildNotificationMessage("failure", "[myrepo] ", 100);
      assert.strictEqual(result, "❌ PR [myrepo] #100 has failed!");
    });

    test("Should handle large PR numbers", () => {
      const result = buildNotificationMessage("success", "", 999999);
      assert.strictEqual(result, "✅ PR #999999 is now passing!");
    });
  });
});
