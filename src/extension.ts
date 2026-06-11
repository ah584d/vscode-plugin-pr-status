import * as vscode from "vscode";

let myStatusBarItem: vscode.StatusBarItem;
let intervalId: NodeJS.Timeout;
let allPRs: Array<{
  title: string;
  url: string;
  status: string;
  repo: string;
}> = [];

export async function activate(context: vscode.ExtensionContext) {
  // 1. Create the status bar item
  myStatusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100,
  );
  context.subscriptions.push(myStatusBarItem);

  // Show connecting state immediately
  myStatusBarItem.text = `$(sync~spin) Connecting...`;
  myStatusBarItem.tooltip = "Connecting to GitHub...";
  myStatusBarItem.show();

  // 2. Register click command to open the primary or latest PR
  const openCommand = vscode.commands.registerCommand(
    "pr-status-monitor.openPrInBrowser",
    async () => {
      if (allPRs.length === 0) {
        vscode.window.showInformationMessage("No active PRs found.");
        return;
      }

      if (allPRs.length === 1) {
        // If only one PR, open it directly
        vscode.env.openExternal(vscode.Uri.parse(allPRs[0].url));
        return;
      }

      // Show QuickPick menu for multiple PRs
      const items = allPRs.map((pr) => ({
        label: `${pr.status} ${pr.repo ? `[${pr.repo}] ` : ""}${pr.title}`,
        description: pr.url,
        url: pr.url,
      }));

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: "Select a PR to open in browser",
        matchOnDescription: true,
      });

      if (selected) {
        vscode.env.openExternal(vscode.Uri.parse(selected.url));
      }
    },
  );
  context.subscriptions.push(openCommand);
  myStatusBarItem.command = "pr-status-monitor.openPrInBrowser";

  try {
    const { Octokit } = await import("@octokit/rest");
    const session = await vscode.authentication.getSession("github", ["repo"], {
      createIfNone: true,
    });

    if (session) {
      const octokit = new Octokit({ auth: session.accessToken });
      await updatePRStatus(octokit);

      // Get polling interval from settings (in minutes, default 2)
      const config = vscode.workspace.getConfiguration("prStatusMonitor");
      const pollingMinutes = config.get<number>("pollingInterval", 2);
      const pollingMs = pollingMinutes * 60 * 1000;
      
      intervalId = setInterval(() => updatePRStatus(octokit), pollingMs);
    } else {
      setOfflineStatus("No GitHub Session");
    }
  } catch (error) {
    vscode.window.showErrorMessage(
      "PR Monitor: Failed to authenticate with GitHub.",
    );
    setOfflineStatus("Auth Failed");
  }
}

async function updatePRStatus(octokit: any) {
  const gitExtension = vscode.extensions.getExtension("vscode.git")?.exports;
  if (!gitExtension) {
    setOfflineStatus("No Git Ext");
    return;
  }

  const api = gitExtension.getAPI(1);
  const repos = api.repositories;
  if (!repos || repos.length === 0) {
    setOfflineStatus("No Repo Open");
    return;
  }

  // Support worktrees & forks: collect all remotes across all opened git repositories
  let uniqueRepoIds = new Set<string>();
  for (const activeRepo of repos) {
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

  if (uniqueRepoIds.size === 0) {
    setOfflineStatus("Not GitHub");
    return;
  }

  try {
    const { data: user } = await octokit.rest.users.getAuthenticated();

    // Use GitHub Search API to find ALL your open PRs across ANY of these remotes
    // This handles forks -> upstream, and multiple worktrees perfectly
    const repoQueries = Array.from(uniqueRepoIds)
      .map((id) => `repo:${id}`)
      .join(" ");
    const searchQuery = `is:pr is:open author:${user.login} ${repoQueries}`;

    const { data: searchData } =
      await octokit.rest.search.issuesAndPullRequests({
        q: searchQuery,
        per_page: 50,
      });

    const allMyPrs = searchData.items;
    const totalPRs = allMyPrs.length;

    if (totalPRs === 0) {
      allPRs = [];
      myStatusBarItem.text = `\$(git-pull-request) 0 PRs`;
      myStatusBarItem.tooltip = `No open pull requests found for ${user.login} in connected repos`;
      myStatusBarItem.backgroundColor = undefined;
      myStatusBarItem.color = undefined;
      myStatusBarItem.show();
      return;
    }

    let successCount = 0;
    let failureCount = 0;
    let pendingCount = 0;
    let tooltipLines: string[] = [];
    allPRs = []; // Reset the PRs array

    // Loop through ALL your open PRs and fetch their CI status
    for (const pr of allMyPrs) {
      const repoUrlMatch = pr.repository_url.match(/repos\/(.+)\/(.+)$/);
      const prOwner = repoUrlMatch ? repoUrlMatch[1] : "";
      const prRepo = repoUrlMatch ? repoUrlMatch[2] : "";

      // We need to fetch the PR first to get the head sha
      const { data: prData } = await octokit.rest.pulls.get({
        owner: prOwner,
        repo: prRepo,
        pull_number: pr.number,
      });

      // Check GitHub actions / checks
      const { data: statusData } = await octokit.rest.checks.listForRef({
        owner: prOwner,
        repo: prRepo,
        ref: prData.head.sha,
      });

      const runs = statusData.check_runs;
      let prDot = "⚪";
      let prStatusText = "No CI";

      if (runs.length > 0) {
        const hasFailed = runs.some((run: any) =>
          ["failure", "timed_out", "cancelled", "action_required"].includes(
            run.conclusion,
          ),
        );
        const isPending = runs.some(
          (run: any) => run.status !== "completed" || run.conclusion === null,
        );

        if (hasFailed) {
          prDot = "🔴";
          prStatusText = "Failed";
          failureCount++;
        } else if (isPending) {
          prDot = "🟠";
          prStatusText = "Pending";
          pendingCount++;
        } else {
          prDot = "🟢";
          prStatusText = "Passing";
          successCount++;
        }
      } else {
        // fallback to commit statuses
        const { data: commitStatus } =
          await octokit.rest.repos.getCombinedStatusForRef({
            owner: prOwner,
            repo: prRepo,
            ref: prData.head.sha,
          });

        if (commitStatus.state === "success") {
          prDot = "🟢";
          prStatusText = "Passing";
          successCount++;
        } else if (
          commitStatus.state === "failure" ||
          commitStatus.state === "error"
        ) {
          prDot = "🔴";
          prStatusText = "Failed";
          failureCount++;
        } else if (commitStatus.state === "pending") {
          prDot = "🟠";
          prStatusText = "Pending";
          pendingCount++;
        }
      }

      const repoPrefix = uniqueRepoIds.size > 1 ? `[${prRepo}] ` : "";
      tooltipLines.push(
        `${prDot} ${repoPrefix}#${pr.number}: ${pr.title} (${prStatusText})`,
      );

      // Store PR info for QuickPick menu
      allPRs.push({
        title: `#${pr.number}: ${pr.title}`,
        url: pr.html_url,
        status: prDot,
        repo: uniqueRepoIds.size > 1 ? prRepo : "",
      });
    }

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

    myStatusBarItem.text = statusString;
    myStatusBarItem.tooltip = `Your Open PRs:\n\n${tooltipLines.join("\n")}\n\nClick to select a PR to open.`;
    myStatusBarItem.backgroundColor = undefined;
    myStatusBarItem.color = undefined;
    myStatusBarItem.show();
  } catch (error) {
    console.error("PR Monitor Error: ", error);
    setOfflineStatus("API Error");
  }
}

function setOfflineStatus(reason: string) {
  myStatusBarItem.text = `$(warning) PR Monitor`;
  myStatusBarItem.tooltip = `PR Monitor offline: ${reason}`;
  myStatusBarItem.backgroundColor = undefined;
  myStatusBarItem.color = undefined;
  myStatusBarItem.show();
}

export function deactivate() {
  if (intervalId) {
    clearInterval(intervalId);
  }
}
