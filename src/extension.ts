import * as vscode from "vscode";
import {
  PR,
  OctokitInstance,
  GitHubPullRequest,
  PRCounts,
  ProcessedPRResult,
  PRTableRow,
} from "./types";
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
  formatPRTable,
} from "./utils";
import { openInvestigateChat } from "./notifications";
import {
  initTelemetry,
  sendTelemetryEvent,
  disposeTelemetry,
  trackPROpened,
  trackQuickPickUsage,
  trackInvestigateUsage,
} from "./telemetry";

const FAST_POLLING_MS = 10 * 1000; // 10 seconds for initial connection or reconnection

let myStatusBarItem: vscode.StatusBarItem;
let intervalId: NodeJS.Timeout;
let allPRs: PR[] = [];
let outputChannel: vscode.OutputChannel;

// Track previous PR statuses to detect changes
let previousPRStatuses: Map<string, string> = new Map();
let isConnected = false;
let octokitInstance: OctokitInstance | null = null;
let normalPollingMs = 120000; // Default 2 minutes
let showInvestigateOnFailure = false;

export async function activate(context: vscode.ExtensionContext) {
  // 0. Initialize telemetry (respects user privacy settings)
  // This also sends the extensionActivated event with system info
  initTelemetry(context);

  // 1. Create the output channel for logging
  outputChannel = vscode.window.createOutputChannel("PR Status Monitor");
  context.subscriptions.push(outputChannel);

  outputChannel.appendLine("PR Status Monitor activated");

  // 2. Create the status bar item
  myStatusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100,
  );
  context.subscriptions.push(myStatusBarItem);

  // Show connecting state immediately
  myStatusBarItem.text = `$(sync~spin) Connecting...`;
  myStatusBarItem.tooltip = "Connecting to GitHub...";
  myStatusBarItem.show();

  // 3. Register click command to open the primary or latest PR
  const openCommand = vscode.commands.registerCommand(
    "pr-status-monitor.openPrInBrowser",
    async () => {
      sendTelemetryEvent("commandExecuted", { commandName: "openPrInBrowser" });

      if (allPRs.length === 0) {
        vscode.window.showInformationMessage("No active PRs found.");
        return;
      }

      if (allPRs.length === 1) {
        // If only one PR, open it directly
        trackPROpened();
        vscode.env.openExternal(vscode.Uri.parse(allPRs[0].url));
        return;
      }

      // Show QuickPick menu for multiple PRs
      const items = buildQuickPickItems(allPRs);
      trackQuickPickUsage();

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: "Select a PR to open in browser",
        matchOnDescription: true,
      });

      if (selected) {
        trackPROpened();
        sendTelemetryEvent("prOpened", { prUrl: selected.url });
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
      octokitInstance = new Octokit({
        auth: session.accessToken,
      }) as OctokitInstance;

      // Get polling interval from settings (in minutes, default 2)
      const config = vscode.workspace.getConfiguration("prStatusMonitor");
      const pollingMinutes = config.get<number>("pollingInterval", 2);
      normalPollingMs = pollingMinutes * 60 * 1000;
      showInvestigateOnFailure = config.get<boolean>(
        "showInvestigateOnFailure",
        false,
      );

      outputChannel.appendLine(
        `Polling interval set to ${pollingMinutes} minute(s) (${normalPollingMs}ms)`,
      );

      sendTelemetryEvent("githubAuthSuccess", {
        pollingIntervalMinutes: String(pollingMinutes),
      });

      // Start connection attempts
      await attemptConnection();

      // If not connected yet, keep trying every 10 seconds
      if (!isConnected) {
        intervalId = setInterval(attemptConnection, FAST_POLLING_MS);
      }
    } else {
      setOfflineStatus("No GitHub Session");
      sendTelemetryEvent("githubAuthFailed", { reason: "noSession" });
    }
  } catch (error) {
    vscode.window.showErrorMessage(
      "PR Monitor: Failed to authenticate with GitHub.",
    );
    setOfflineStatus("Auth Failed");
    sendTelemetryEvent("githubAuthFailed", {
      reason: "authException",
      errorMessage: String(error),
    });
  }
}

async function attemptConnection() {
  if (!octokitInstance) {
    return;
  }

  const wasConnected = isConnected;
  const connected = await updatePRStatus(octokitInstance, !isConnected);

  if (connected && !wasConnected) {
    // Just connected! Switch to normal polling interval
    isConnected = true;
    sendTelemetryEvent("connectionEstablished");
    outputChannel.appendLine(
      `✅ Connected to GitHub! Switching to normal polling (${normalPollingMs / 1000}s)`,
    );
    if (intervalId) {
      clearInterval(intervalId);
    }
    intervalId = setInterval(attemptConnection, normalPollingMs);
  } else if (!connected && wasConnected) {
    // Lost connection! Switch back to fast polling to reconnect quickly
    isConnected = false;
    sendTelemetryEvent("connectionLost");
    outputChannel.appendLine(
      `⚠️ Connection lost! Switching to fast polling (${FAST_POLLING_MS / 1000}s) to reconnect`,
    );
    if (intervalId) {
      clearInterval(intervalId);
    }
    intervalId = setInterval(attemptConnection, FAST_POLLING_MS);
  }
}

/**
 * Check for PR status changes and show notifications
 */
function notifyStatusChange(
  previousStatus: string | undefined,
  currentStatus: string,
  prNumber: number,
  repoPrefix: string,
  prUrl: string,
) {
  if (previousStatus === "🟠") {
    if (currentStatus === "🟢") {
      sendTelemetryEvent("prStatusChanged", {
        previousStatus: "pending",
        newStatus: "success",
        prNumber: String(prNumber),
      });
      const message = buildNotificationMessage("success", repoPrefix, prNumber);
      vscode.window
        .showInformationMessage(message, "View PR")
        .then((selection) => {
          if (selection === "View PR") {
            vscode.env.openExternal(vscode.Uri.parse(prUrl));
          }
        });
    } else if (currentStatus === "🔴") {
      sendTelemetryEvent("prStatusChanged", {
        previousStatus: "pending",
        newStatus: "failure",
        prNumber: String(prNumber),
      });
      const message = buildNotificationMessage("failure", repoPrefix, prNumber);
      const buttons = showInvestigateOnFailure
        ? ["View PR", "Investigate"]
        : ["View PR"];
      vscode.window
        .showWarningMessage(message, ...buttons)
        .then((selection) => {
          if (selection === "View PR") {
            vscode.env.openExternal(vscode.Uri.parse(prUrl));
          } else if (selection === "Investigate") {
            trackInvestigateUsage();
            sendTelemetryEvent("investigateButtonClicked", {
              prNumber: String(prNumber),
            });
            openInvestigateChat(prNumber, prUrl)-;
          }
        });
      if (showInvestigateOnFailure) {
        trackInvestigateUsage();
        openInvestigateChat(prNumber, prUrl);
      }
    }
  }
}

/**
 * Fetch PR status from GitHub checks and commit statuses
 */
async function fetchPRStatus(
  octokit: OctokitInstance,
  owner: string,
  repo: string,
  headSha: string,
): Promise<{ dot: string; statusText: string; checksInfo: string }> {
  // Check GitHub actions / checks
  const { data: statusData } = await octokit.rest.checks.listForRef({
    owner,
    repo,
    ref: headSha,
  });

  const runs = statusData.check_runs;

  if (runs.length > 0) {
    const result = determineStatusFromChecks(runs);
    return { ...result, checksInfo: `${runs.length} check runs` };
  }

  // Fallback to commit statuses
  const { data: commitStatus } =
    await octokit.rest.repos.getCombinedStatusForRef({
      owner,
      repo,
      ref: headSha,
    });

  // Use individual statuses to filter out code review checks
  const result = determineStatusFromCommitStatuses(commitStatus.statuses);
  return { ...result, checksInfo: `${commitStatus.statuses.length} statuses` };
}

/**
 * Process a single PR and update counts
 */
async function processPR(
  octokit: OctokitInstance,
  pr: GitHubPullRequest,
  hasMultipleRepos: boolean,
  counts: PRCounts,
): Promise<ProcessedPRResult> {
  const { owner, repo } = extractRepoInfo(pr.repository_url);

  // Fetch the PR to get the head sha
  const { data: prData } = await octokit.rest.pulls.get({
    owner,
    repo,
    pull_number: pr.number,
  });

  // Get PR status
  const { dot, statusText, checksInfo } = await fetchPRStatus(
    octokit,
    owner,
    repo,
    prData.head.sha,
  );

  // Update counts
  if (dot === "🟢") {
    counts.success++;
  } else if (dot === "🔴") {
    counts.failure++;
  } else if (dot === "🟠") {
    counts.pending++;
  }

  const repoPrefix = getRepoPrefix(repo, hasMultipleRepos);

  return { prData, owner, repo, dot, statusText, repoPrefix, checksInfo };
}

/**
 * Fetch and display all PR statuses
 */
async function fetchAndDisplayPRs(
  octokit: OctokitInstance,
  uniqueRepoIds: Set<string>,
  username: string,
): Promise<boolean> {
  const searchQuery = buildGitHubSearchQuery(uniqueRepoIds, username);

  outputChannel.appendLine(`Searching for PRs with query: ${searchQuery}`);

  const { data: searchData } = await octokit.rest.search.issuesAndPullRequests({
    q: searchQuery,
    per_page: 50,
  });

  const allMyPrs = searchData.items;
  const totalPRs = allMyPrs.length;

  outputChannel.appendLine(`Found ${totalPRs} PRs for user ${username}`);

  if (totalPRs === 0) {
    displayNoPRs(username);
    return true;
  }

  const counts = { success: 0, failure: 0, pending: 0 };
  const tooltipLines: string[] = [];
  const prTableData: PRTableRow[] = [];
  allPRs = [];

  const hasMultipleRepos = uniqueRepoIds.size > 1;

  for (const pr of allMyPrs) {
    const { prData, owner, repo, dot, statusText, repoPrefix, checksInfo } =
      await processPR(octokit, pr, hasMultipleRepos, counts);

    // Build tooltip line
    tooltipLines.push(
      buildTooltipLine(dot, repoPrefix, pr.number, pr.title, statusText),
    );

    // Store PR info for table display
    prTableData.push({
      status: dot,
      repo: hasMultipleRepos ? `${owner}/${repo}` : repo,
      prNumber: pr.number,
      title: pr.title,
      sha: prData.head.sha.substring(0, 7),
      checksInfo,
    });

    // Store PR info for QuickPick menu
    allPRs.push({
      title: `#${pr.number}: ${pr.title}`,
      url: pr.html_url,
      status: dot,
      repo: hasMultipleRepos ? repo : "",
    });

    // Check for status changes and notify
    const prKey = createPRKey(owner, repo, pr.number);
    const previousStatus = previousPRStatuses.get(prKey);

    notifyStatusChange(previousStatus, dot, pr.number, repoPrefix, pr.html_url);

    // Update the status tracker
    previousPRStatuses.set(prKey, dot);
  }

  // Display PR table in output channel
  outputChannel.appendLine("\n" + formatPRTable(prTableData) + "\n");
  // Update status bar
  updateStatusBar(totalPRs, counts, tooltipLines);
  return true;
}

/**
 * Display status bar when no PRs are found
 */
function displayNoPRs(username: string) {
  allPRs = [];
  myStatusBarItem.text = `\$(git-pull-request) 0 PRs`;
  myStatusBarItem.tooltip = `No open pull requests found for ${username} in connected repos`;
  myStatusBarItem.backgroundColor = undefined;
  myStatusBarItem.color = undefined;
  myStatusBarItem.show();
}

/**
 * Update the status bar with PR information
 */
function updateStatusBar(
  totalPRs: number,
  counts: PRCounts,
  tooltipLines: string[],
) {
  const statusString = buildStatusBarText(
    totalPRs,
    counts.success,
    counts.failure,
    counts.pending,
  );

  myStatusBarItem.text = statusString;
  myStatusBarItem.tooltip = buildTooltipText(tooltipLines);
  myStatusBarItem.backgroundColor = undefined;
  myStatusBarItem.color = undefined;
  myStatusBarItem.show();
}

/**
 * Main function to update PR status
 */
async function updatePRStatus(
  octokit: OctokitInstance,
  isInitialConnection = false,
): Promise<boolean> {
  const gitExtension = vscode.extensions.getExtension("vscode.git")?.exports;
  if (!gitExtension) {
    if (!isInitialConnection) {
      setOfflineStatus("No Git Ext");
    }
    return false;
  }

  const api = gitExtension.getAPI(1);
  const repos = api.repositories;
  if (!repos || repos.length === 0) {
    if (!isInitialConnection) {
      setOfflineStatus("No Repo Open");
    }
    return false;
  }

  // Extract GitHub repository IDs from remotes
  const uniqueRepoIds = extractGitHubRepoIds(repos);

  if (uniqueRepoIds.size === 0) {
    if (!isInitialConnection) {
      setOfflineStatus("Not GitHub");
    }
    return false;
  }

  try {
    const { data: user } = await octokit.rest.users.getAuthenticated();
    return await fetchAndDisplayPRs(octokit, uniqueRepoIds, user.login);
  } catch (error) {
    outputChannel.appendLine(`❌ Error: ${error}`);
    sendTelemetryEvent("apiError", {
      errorType: error instanceof Error ? error.name : "unknown",
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    if (!isInitialConnection) {
      setOfflineStatus("API Error");
      outputChannel.show(true); // Show output channel on error
    }
    return false;
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
  if (outputChannel) {
    outputChannel.appendLine("PR Status Monitor deactivated");
    outputChannel.dispose();
  }
  disposeTelemetry();
}
