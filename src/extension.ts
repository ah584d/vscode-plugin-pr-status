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
let verboseLogging = false;

function logVerbose(message: string) {
  if (verboseLogging) {
    outputChannel.appendLine(message);
  }
}

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

  const switchAccountCommand = vscode.commands.registerCommand(
    "pr-status-monitor.switchAccount",
    async () => {
      try {
        // clearSessionPreference forces VS Code to re-prompt the account picker
        // when more than one GitHub session is signed in.
        const newSession = await vscode.authentication.getSession(
          "github",
          ["repo"],
          { clearSessionPreference: true, createIfNone: true },
        );
        if (!newSession) {
          vscode.window.showWarningMessage(
            "PR Monitor: No GitHub session was selected.",
          );
          return;
        }
        const { Octokit } = await import("@octokit/rest");
        octokitInstance = new Octokit({
          auth: newSession.accessToken,
        }) as OctokitInstance;
        previousPRStatuses.clear();
        outputChannel.appendLine(
          `Switched GitHub account to: ${newSession.account.label}`,
        );
        vscode.window.showInformationMessage(
          `PR Monitor: now using GitHub account "${newSession.account.label}".`,
        );
        await attemptConnection();
      } catch (error) {
        outputChannel.appendLine(`❌ Switch account failed: ${error}`);
        vscode.window.showErrorMessage(
          "PR Monitor: Failed to switch GitHub account.",
        );
      }
    },
  );
  context.subscriptions.push(switchAccountCommand);

  try {
    const { Octokit } = await import("@octokit/rest");
    const session = await vscode.authentication.getSession("github", ["repo"], {
      createIfNone: true,
    });

    if (session) {
      outputChannel.appendLine(
        `Using GitHub account: ${session.account.label} ` +
          `(run "PR Monitor: Switch GitHub Account" to change)`,
      );
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
      verboseLogging = config.get<boolean>("verboseLogging", false);

      logVerbose(
        `Polling interval set to ${pollingMinutes} minute(s) (${normalPollingMs}ms)`,
      );

      // Keep verboseLogging in sync when the user toggles it at runtime.
      context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((e) => {
          if (e.affectsConfiguration("prStatusMonitor.verboseLogging")) {
            verboseLogging = vscode.workspace
              .getConfiguration("prStatusMonitor")
              .get<boolean>("verboseLogging", false);
            outputChannel.appendLine(
              `Verbose logging ${verboseLogging ? "enabled" : "disabled"}`,
            );
          }
        }),
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
            openInvestigateChat(prNumber, prUrl);
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
  // Query each repo separately so one inaccessible repo (SSO not authorized,
  // private/no permission, wrong host) doesn't abort the whole search.
  const allMyPrs: GitHubPullRequest[] = [];
  const skippedRepos: string[] = [];

  for (const repoId of uniqueRepoIds) {
    const searchQuery = `is:pr is:open author:${username} repo:${repoId}`;
    logVerbose(`Searching for PRs with query: ${searchQuery}`);

    try {
      const { data: searchData } =
        await octokit.rest.search.issuesAndPullRequests({
          q: searchQuery,
          per_page: 50,
        });
      allMyPrs.push(...(searchData.items as GitHubPullRequest[]));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      skippedRepos.push(repoId);
      // GitHub returns an `x-github-sso` header when a token lacks SSO
      // authorization; it includes the exact URL to authorize.
      const headers = (
        error as { response?: { headers?: Record<string, string> } }
      )?.response?.headers;
      const ssoHeader = headers?.["x-github-sso"];
      const status = (error as { status?: number })?.status;
      // 422 with this exact message means the token's account can't see this
      // repo (SSO not authorized, OAuth app not approved, or wrong account).
      const isNotVisible =
        status === 422 && /cannot be searched/i.test(message);
      if (isNotVisible && !ssoHeader) {
        outputChannel.appendLine(
          `⚠️  No access to ${repoId} with GitHub account "${username}". ` +
            `If this repo belongs to a different account, ` +
            `run "PR Monitor: Switch GitHub Account".`,
        );
      } else {
        outputChannel.appendLine(
          `⚠️  Skipping repo ${repoId}: [${status}] ${message}`,
        );
      }
      if (ssoHeader) {
        outputChannel.appendLine(`   → SSO required: ${ssoHeader}`);
      }
      if (headers?.["x-oauth-scopes"] !== undefined) {
        logVerbose(
          `   → Token scopes: "${headers["x-oauth-scopes"]}" ` +
            `(accepted: "${headers["x-accepted-oauth-scopes"] ?? ""}")`,
        );
      }
      logVerbose(`   → Raw error for ${repoId}: ${message}`);
    }
  }

  if (skippedRepos.length > 0) {
    outputChannel.appendLine(
      `Skipped ${skippedRepos.length} repo(s): ${skippedRepos.join(", ")}. ` +
        `If this is an OAuth/SSO issue, visit https://github.com/settings/applications, ` +
        `open the "GitHub for VSCode" entry, and authorize SSO for each org.`,
    );
  }

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
    logVerbose(`Authenticated as GitHub user: ${user.login}`);
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
