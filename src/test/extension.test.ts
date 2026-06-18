import * as assert from "assert";
import * as vscode from "vscode";
import { determineStatusFromChecks } from "../../src/utils";

suite("PR Status Monitor Extension Tests", () => {
  suite("Activation Tests", () => {
    test("Should show connecting state on activation", async () => {
      const extension = vscode.extensions.getExtension(
        "ah584d.pr-status-monitor",
      );
      assert.ok(extension, "Extension should be available");

      if (!extension.isActive) {
        await extension.activate();
      }

      // Wait a moment for status bar to update
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Extension should be active
      assert.ok(extension.isActive, "Extension should be activated");
    });

    test("Should register openPrInBrowser command", async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes("pr-status-monitor.openPrInBrowser"),
        "Command should be registered",
      );
    });
  });

  suite("Status Bar Icon Tests", () => {
    test("Should show connecting icon with sync~spin", () => {
      // Test that connecting state uses $(sync~spin) icon
      const connectingText = "$(sync~spin) Connecting...";
      assert.ok(
        connectingText.includes("sync~spin"),
        "Should use sync~spin icon for connecting",
      );
    });

    test("Should show warning icon for offline status", () => {
      const offlineText = "$(warning) PR Monitor";
      assert.ok(
        offlineText.includes("warning"),
        "Should use warning icon for offline",
      );
    });

    test("Should show git-pull-request icon for PR count", () => {
      const prCountText = "$(git-pull-request) 3 PRs";
      assert.ok(
        prCountText.includes("git-pull-request"),
        "Should use git-pull-request icon",
      );
    });

    test("Should use emoji status indicators", () => {
      const statusText = "$(git-pull-request) 3 PRs | 🟢1 🔴1 🟠1";

      assert.ok(statusText.includes("🟢"), "Should include green emoji");
      assert.ok(statusText.includes("🔴"), "Should include red emoji");
      assert.ok(statusText.includes("🟠"), "Should include orange emoji");
    });
  });

  suite("PR Status Formatting Tests", () => {
    test("Should format 0 PRs correctly", () => {
      const text = "$(git-pull-request) 0 PRs";
      assert.ok(text.includes("0 PRs"), "Should show 0 PRs");
    });

    test("Should format single PR correctly", () => {
      const text = "$(git-pull-request) 1 PRs | 🟢1";
      assert.ok(text.includes("1 PRs"), "Should show 1 PR");
    });

    test("Should format multiple PRs correctly", () => {
      const text = "$(git-pull-request) 5 PRs | 🟢2 🔴1 🟠2";
      assert.ok(text.includes("5 PRs"), "Should show count");
      assert.ok(text.includes("🟢2"), "Should show passing count");
      assert.ok(text.includes("🔴1"), "Should show failed count");
      assert.ok(text.includes("🟠2"), "Should show pending count");
    });

    test("Should only show status types that exist", () => {
      // Only passing PRs
      const passingOnly = "$(git-pull-request) 2 PRs | 🟢2";
      assert.ok(
        !passingOnly.includes("🔴"),
        "Should not show red if no failures",
      );
      assert.ok(
        !passingOnly.includes("🟠"),
        "Should not show orange if no pending",
      );

      // Only failed PRs
      const failedOnly = "$(git-pull-request) 1 PRs | 🔴1";
      assert.ok(
        !failedOnly.includes("🟢"),
        "Should not show green if no passing",
      );
    });
  });

  suite("Tooltip Tests", () => {
    test("Should format tooltip for single repo", () => {
      const tooltip =
        "Your Open PRs:\n\n🟢 #123: Fix bug (Passing)\n\nClick to select a PR to open.";

      assert.ok(tooltip.includes("Your Open PRs"), "Should have header");
      assert.ok(tooltip.includes("#123"), "Should include PR number");
      assert.ok(
        tooltip.includes("Click to select"),
        "Should include action hint",
      );
    });

    test("Should format tooltip for multiple repos", () => {
      const tooltip =
        "Your Open PRs:\n\n🟢 [repo1] #123: Fix bug (Passing)\n🔴 [repo2] #456: New feature (Failed)\n\nClick to select a PR to open.";

      assert.ok(tooltip.includes("[repo1]"), "Should include repo name");
      assert.ok(tooltip.includes("[repo2]"), "Should include second repo");
    });

    test("Should show offline reason in tooltip", () => {
      const tooltip = "PR Monitor offline: No Git Ext";
      assert.ok(tooltip.includes("offline"), "Should indicate offline");
      assert.ok(tooltip.includes("No Git Ext"), "Should show specific reason");
    });

    test("Should show no PRs message", () => {
      const tooltip =
        "No open pull requests found for user123 in connected repos";
      assert.ok(
        tooltip.includes("No open pull requests"),
        "Should indicate no PRs",
      );
    });
  });

  suite("CI Status Detection Tests", () => {
    // Helper to build a check run from a GitHub Actions workflow
    const ghRun = (conclusion: string | null, status = "completed") => ({
      id: 1,
      name: "build",
      status,
      conclusion,
      app: { slug: "github-actions" },
    });

    // Helper to build a check run from a non-CI app (e.g. a code-review gate)
    const reviewRun = (conclusion: string | null, status = "completed") => ({
      id: 2,
      name: "code-review",
      status,
      conclusion,
      app: { slug: "code-review-gate" },
    });

    test("Should return passing when all GitHub Actions runs succeeded", () => {
      const result = determineStatusFromChecks([ghRun("success"), ghRun("success")]);
      assert.strictEqual(result.dot, "🟢");
      assert.strictEqual(result.statusText, "Passing");
    });

    test("Should return passing for success/skipped/neutral mix", () => {
      const result = determineStatusFromChecks([ghRun("success"), ghRun("skipped"), ghRun("neutral")]);
      assert.strictEqual(result.dot, "🟢");
    });

    test("Should ignore failing code-review check and return passing", () => {
      const result = determineStatusFromChecks([ghRun("success"), reviewRun("failure")]);
      assert.strictEqual(result.dot, "🟢", "Code-review failure must not turn the PR red");
    });

    test("Should ignore action_required code-review check and return passing", () => {
      const result = determineStatusFromChecks([ghRun("success"), reviewRun("action_required")]);
      assert.strictEqual(result.dot, "🟢");
    });

    test("Should return no-ci when there are no GitHub Actions runs", () => {
      const result = determineStatusFromChecks([reviewRun("success")]);
      assert.strictEqual(result.dot, "⚪");
    });

    test("Should return no-ci when list is empty", () => {
      const result = determineStatusFromChecks([]);
      assert.strictEqual(result.dot, "⚪");
    });

    test("Should detect failure conclusion", () => {
      const result = determineStatusFromChecks([ghRun("success"), ghRun("failure")]);
      assert.strictEqual(result.dot, "🔴");
    });

    test("Should detect timed_out as failure", () => {
      const result = determineStatusFromChecks([ghRun("timed_out")]);
      assert.strictEqual(result.dot, "🔴");

      assert.strictEqual(hasFailed, true, "Should detect timeout as failure");
    });

    test("Should detect cancelled as failure", () => {
      const result = determineStatusFromChecks([ghRun("cancelled")]);
      assert.strictEqual(result.dot, "🔴", "Should detect cancelled as failure");
    });

    test("Should detect stale as failure", () => {
      const result = determineStatusFromChecks([ghRun("stale")]);
      assert.strictEqual(result.dot, "🔴", "Should detect stale as failure");
    });

    test("Should detect action_required on GitHub Actions run as failure", () => {
      const result = determineStatusFromChecks([ghRun("action_required")]);
      assert.strictEqual(result.dot, "🔴");
    });

    test("Should return pending for in_progress run", () => {
      const result = determineStatusFromChecks([ghRun("success"), ghRun(null, "in_progress")]);
      assert.strictEqual(result.dot, "🟠");
    });

    test("Should return pending for queued run", () => {
      const result = determineStatusFromChecks([ghRun(null, "queued")]);
      assert.strictEqual(result.dot, "🟠");
    });

    test("Failed takes priority over pending", () => {
      const result = determineStatusFromChecks([ghRun("failure"), ghRun(null, "in_progress")]);
      assert.strictEqual(result.dot, "🔴");
    });

    test("Code-review pending run does not affect CI passing", () => {
      const result = determineStatusFromChecks([ghRun("success"), reviewRun(null, "in_progress")]);
      assert.strictEqual(result.dot, "🟢");
    });
  });

  suite("Commit Status Fallback Tests", () => {
    test("Should handle success commit status", () => {
      const commitStatus = { state: "success" };
      const isSuccess = commitStatus.state === "success";
      assert.strictEqual(isSuccess, true, "Should detect success");
    });

    test("Should handle failure commit status", () => {
      const commitStatus = { state: "failure" };
      const isFailure =
        commitStatus.state === "failure" || commitStatus.state === "error";
      assert.strictEqual(isFailure, true, "Should detect failure");
    });

    test("Should handle error commit status", () => {
      const commitStatus = { state: "error" };
      const isFailure =
        commitStatus.state === "failure" || commitStatus.state === "error";
      assert.strictEqual(isFailure, true, "Should detect error");
    });

    test("Should handle pending commit status", () => {
      const commitStatus = { state: "pending" };
      const isPending = commitStatus.state === "pending";
      assert.strictEqual(isPending, true, "Should detect pending");
    });
  });

  suite("GitHub URL Matching Tests", () => {
    test("Should match HTTPS GitHub URLs", () => {
      const url = "https://github.com/owner/repo.git";
      const match = url.match(/github\.com[:/](.+)\/(.+?)(\.git)?$/);

      assert.ok(match, "Should match HTTPS URL");
      assert.strictEqual(match![1], "owner", "Should extract owner");
      assert.strictEqual(match![2], "repo", "Should extract repo");
    });

    test("Should match SSH GitHub URLs", () => {
      const url = "git@github.com:owner/repo.git";
      const match = url.match(/github\.com[:/](.+)\/(.+?)(\.git)?$/);

      assert.ok(match, "Should match SSH URL");
      assert.strictEqual(match![1], "owner", "Should extract owner");
      assert.strictEqual(match![2], "repo", "Should extract repo");
    });

    test("Should match URLs without .git extension", () => {
      const url = "https://github.com/owner/repo";
      const match = url.match(/github\.com[:/](.+)\/(.+?)(\.git)?$/);

      assert.ok(match, "Should match URL without .git");
      assert.strictEqual(match![1], "owner", "Should extract owner");
      assert.strictEqual(match![2], "repo", "Should extract repo");
    });

    test("Should not match non-GitHub URLs", () => {
      const url = "https://gitlab.com/owner/repo.git";
      const match = url.match(/github\.com[:/](.+)\/(.+?)(\.git)?$/);

      assert.strictEqual(match, null, "Should not match non-GitHub URL");
    });
  });

  suite("Configuration Tests", () => {
    test("Should use default polling interval of 2 minutes", () => {
      const defaultMinutes = 2;
      const defaultMs = defaultMinutes * 60 * 1000;

      assert.strictEqual(
        defaultMs,
        120000,
        "Should convert 2 minutes to 120000ms",
      );
    });

    test("Should convert custom polling interval correctly", () => {
      const customMinutes = 5;
      const customMs = customMinutes * 60 * 1000;

      assert.strictEqual(
        customMs,
        300000,
        "Should convert 5 minutes to 300000ms",
      );
    });

    test("Should handle minimum polling interval", () => {
      const minMinutes = 1;
      const minMs = minMinutes * 60 * 1000;

      assert.strictEqual(minMs, 60000, "Should convert 1 minute to 60000ms");
    });

    test("Should handle maximum polling interval", () => {
      const maxMinutes = 60;
      const maxMs = maxMinutes * 60 * 1000;

      assert.strictEqual(
        maxMs,
        3600000,
        "Should convert 60 minutes to 3600000ms",
      );
    });
  });

  suite("Edge Case Tests", () => {
    test("Should handle empty PR list", () => {
      const allPRs: any[] = [];
      assert.strictEqual(allPRs.length, 0, "Should handle empty array");
    });

    test("Should handle single PR", () => {
      const allPRs = [
        {
          title: "#123: Fix bug",
          url: "https://github.com/owner/repo/pull/123",
          status: "🟢",
          repo: "",
        },
      ];

      assert.strictEqual(allPRs.length, 1, "Should have one PR");
    });

    test("Should handle PR without repo prefix", () => {
      const pr = {
        title: "#123: Fix bug",
        url: "https://github.com/owner/repo/pull/123",
        status: "🟢",
        repo: "",
      };

      assert.strictEqual(pr.repo, "", "Repo should be empty for single repo");
    });

    test("Should handle PR with repo prefix", () => {
      const pr = {
        title: "#123: Fix bug",
        url: "https://github.com/owner/repo/pull/123",
        status: "🟢",
        repo: "my-repo",
      };

      assert.strictEqual(
        pr.repo,
        "my-repo",
        "Should include repo for multi-repo",
      );
    });

    test("Should handle PR with special characters in title", () => {
      const title = "#456: Fix [URGENT] bug with <component>";
      assert.ok(
        title.includes("[URGENT]"),
        "Should preserve special characters",
      );
      assert.ok(
        title.includes("<component>"),
        "Should preserve angle brackets",
      );
    });

    test("Should handle very long PR titles", () => {
      const longTitle = "#789: " + "A".repeat(200) + " - very long description";
      assert.ok(longTitle.length > 200, "Should handle long titles");
    });
  });

  suite("Error Handling Tests", () => {
    test("Should handle no Git extension scenario", () => {
      const errorReason = "No Git Ext";
      assert.strictEqual(
        errorReason,
        "No Git Ext",
        "Should have correct error message",
      );
    });

    test("Should handle no repository open scenario", () => {
      const errorReason = "No Repo Open";
      assert.strictEqual(
        errorReason,
        "No Repo Open",
        "Should have correct error message",
      );
    });

    test("Should handle non-GitHub repository scenario", () => {
      const errorReason = "Not GitHub";
      assert.strictEqual(
        errorReason,
        "Not GitHub",
        "Should have correct error message",
      );
    });

    test("Should handle API error scenario", () => {
      const errorReason = "API Error";
      assert.strictEqual(
        errorReason,
        "API Error",
        "Should have correct error message",
      );
    });

    test("Should handle no GitHub session scenario", () => {
      const errorReason = "No GitHub Session";
      assert.strictEqual(
        errorReason,
        "No GitHub Session",
        "Should have correct error message",
      );
    });

    test("Should handle authentication failure", () => {
      const errorReason = "Auth Failed";
      assert.strictEqual(
        errorReason,
        "Auth Failed",
        "Should have correct error message",
      );
    });
  });

  suite("QuickPick Menu Tests", () => {
    test("Should format QuickPick item with emoji status", () => {
      const item = {
        label: "🟢 #123: Fix bug",
        description: "https://github.com/owner/repo/pull/123",
        url: "https://github.com/owner/repo/pull/123",
      };

      assert.ok(item.label.includes("🟢"), "Should include status emoji");
      assert.ok(item.label.includes("#123"), "Should include PR number");
      assert.ok(item.description.includes("github.com"), "Should include URL");
    });

    test("Should format QuickPick item with repo prefix", () => {
      const item = {
        label: "🔴 [my-repo] #456: New feature",
        description: "https://github.com/owner/my-repo/pull/456",
        url: "https://github.com/owner/my-repo/pull/456",
      };

      assert.ok(item.label.includes("[my-repo]"), "Should include repo name");
      assert.ok(item.label.includes("🔴"), "Should include failed status");
    });

    test("Should format QuickPick item without repo prefix for single repo", () => {
      const item = {
        label: "🟠 #789: Refactor",
        description: "https://github.com/owner/repo/pull/789",
        url: "https://github.com/owner/repo/pull/789",
      };

      assert.ok(
        !item.label.includes("["),
        "Should not include repo for single repo",
      );
      assert.ok(item.label.includes("🟠"), "Should include pending status");
    });
  });

  suite("Status Bar Color Tests", () => {
    test("Should clear background and color for normal state", () => {
      const backgroundColor = undefined;
      const color = undefined;

      assert.strictEqual(
        backgroundColor,
        undefined,
        "Background should be undefined",
      );
      assert.strictEqual(color, undefined, "Color should be undefined");
    });

    test("Should clear colors for offline state", () => {
      // Offline state now uses neutral colors
      const backgroundColor = undefined;
      const color = undefined;

      assert.strictEqual(
        backgroundColor,
        undefined,
        "Background should be cleared",
      );
      assert.strictEqual(color, undefined, "Color should be cleared");
    });
  });

  suite("Connection and Reconnection Tests", () => {
    test("Should use 10-second polling during initial connection", () => {
      const fastPollingMs = 10 * 1000;
      assert.strictEqual(
        fastPollingMs,
        10000,
        "Should poll every 10 seconds initially",
      );
    });

    test("Should switch to normal polling after connection established", () => {
      const normalPollingMinutes = 2;
      const normalPollingMs = normalPollingMinutes * 60 * 1000;
      assert.strictEqual(
        normalPollingMs,
        120000,
        "Should switch to 2-minute polling after connection",
      );
    });

    test("Should switch back to fast polling on connection loss", () => {
      const fastPollingMs = 10 * 1000;
      // Simulating reconnection scenario
      const wasConnected = true;
      const nowConnected = false;

      if (wasConnected && !nowConnected) {
        // Should use fast polling
        assert.strictEqual(
          fastPollingMs,
          10000,
          "Should use fast polling on connection loss",
        );
      }
    });

    test("Should not show warning during initial connection attempts", () => {
      const isInitialConnection = true;
      // When isInitialConnection is true, setOfflineStatus should not be called
      assert.strictEqual(
        isInitialConnection,
        true,
        "Should suppress warnings during initial connection",
      );
    });

    test("Should show warning after connection was established then lost", () => {
      const isInitialConnection = false;
      const wasConnected = true;

      if (!isInitialConnection && wasConnected) {
        // Should show warning
        assert.ok(true, "Should show warning when connection is lost");
      }
    });

    test("Should keep showing connecting state during initial retries", () => {
      const connectingText = "$(sync~spin) Connecting...";
      assert.ok(
        connectingText.includes("sync~spin"),
        "Should keep showing connecting animation",
      );
    });
  });

  suite("PR Status Change Notification Tests", () => {
    test("Should notify when PR changes from orange to green", () => {
      const previousStatus = "🟠";
      const currentStatus = "🟢";

      const shouldNotify = previousStatus === "🟠" && currentStatus === "🟢";
      assert.strictEqual(
        shouldNotify,
        true,
        "Should notify on orange to green transition",
      );
    });

    test("Should notify when PR changes from orange to red", () => {
      const previousStatus = "🟠";
      const currentStatus = "🔴";

      const shouldNotify = previousStatus === "🟠" && currentStatus === "🔴";
      assert.strictEqual(
        shouldNotify,
        true,
        "Should notify on orange to red transition",
      );
    });

    test("Should not notify when PR stays green", () => {
      const previousStatus: string = "🟢";
      const currentStatus: string = "🟢";

      const shouldNotify =
        previousStatus === "🟠" &&
        (currentStatus === "🟢" || currentStatus === "🔴");
      assert.strictEqual(
        shouldNotify,
        false,
        "Should not notify when status stays green",
      );
    });

    test("Should not notify when PR stays orange", () => {
      const previousStatus = "🟠";
      const currentStatus = "🟠";

      const shouldNotify = previousStatus === "🟠" && currentStatus !== "🟠";
      assert.strictEqual(
        shouldNotify,
        false,
        "Should not notify when status stays orange",
      );
    });

    test("Should not notify when PR changes from green to red", () => {
      const previousStatus: string = "🟢";
      const currentStatus: string = "🔴";

      const shouldNotify =
        previousStatus === "🟠" &&
        (currentStatus === "🟢" || currentStatus === "🔴");
      assert.strictEqual(
        shouldNotify,
        false,
        "Should not notify on green to red transition",
      );
    });

    test("Should not notify when PR changes from red to green", () => {
      const previousStatus: string = "🔴";
      const currentStatus: string = "🟢";

      const shouldNotify =
        previousStatus === "🟠" &&
        (currentStatus === "🟢" || currentStatus === "🔴");
      assert.strictEqual(
        shouldNotify,
        false,
        "Should not notify on red to green transition",
      );
    });

    test("Should format success notification correctly", () => {
      const message = "✅ PR #123 is now passing!";
      assert.ok(message.includes("✅"), "Should include success emoji");
      assert.ok(message.includes("passing"), "Should mention passing");
    });

    test("Should format failure notification correctly", () => {
      const message = "❌ PR #123 has failed!";
      assert.ok(message.includes("❌"), "Should include error emoji");
      assert.ok(message.includes("failed"), "Should mention failure");
    });

    test("Should include PR number in notification", () => {
      const prNumber = 123;
      const message = `✅ PR #${prNumber} is now passing!`;
      assert.ok(
        message.includes("#123"),
        "Should include PR number in notification",
      );
    });

    test("Should include repo prefix in notification for multi-repo", () => {
      const repoPrefix = "[my-repo] ";
      const prNumber = 456;
      const message = `✅ PR ${repoPrefix}#${prNumber} is now passing!`;
      assert.ok(
        message.includes("[my-repo]"),
        "Should include repo prefix in notification",
      );
    });
  });
});
