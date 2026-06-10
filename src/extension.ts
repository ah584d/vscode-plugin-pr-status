// // The module 'vscode' contains the VS Code extensibility API
// // Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "pr-status-monitor" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	const disposable = vscode.commands.registerCommand('pr-status-monitor.helloWorld', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from PR Status Monitor!');
	});

	context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}


// import * as vscode from 'vscode';
// import { Octokit } from '@octokit/rest';

// let myStatusBarItem: vscode.StatusBarItem;
// let intervalId: NodeJS.Timeout;

// export async function activate(context: vscode.ExtensionContext) {
//     // 1. Create the status bar item on the left side of the bottom bar
//     myStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
//     context.subscriptions.push(myStatusBarItem);

//     // 2. Authenticate using VS Code's built-in GitHub authentication provider
//     try {
//         const session = await vscode.authentication.getSession('github', ['repo'], { createIfNone: true });
//         if (session) {
//             const octokit = new Octokit({ auth: session.accessToken });

//             // Initial execution
//             await updatePRStatus(octokit);

//             // Poll the GitHub API every 5 minutes (300,000 ms)
//             intervalId = setInterval(() => updatePRStatus(octokit), 300000);
//         }
//     } catch (error) {
//         vscode.window.showErrorMessage("Failed to authenticate with GitHub for PR Monitor.");
//     }
// }

// async function updatePRStatus(octokit: Octokit) {
//     // Extract owner and repo from the local workspace Git configurations
//     const gitExtension = vscode.extensions.getExtension('vscode.git')?.exports;
//     if (!gitExtension) { return; }

//     const api = gitExtension.getAPI(1);
//     const repo = api.repositories[0];
//     if (!repo) { return; }

//     const remoteUrl = repo.state.remotes[0]?.fetchUrl;
//     if (!remoteUrl) { return; }

//     // Parse owner and repo name from remote URL (assuming GitHub)
//     const match = remoteUrl.match(/github\.com[:/](.+)\/(.+)\.git/);
//     if (!match) { return; }
//     const [_, owner, repoName] = match;

//     try {
//         // Get the authenticated user's login name
//         const { data: user } = await octokit.rest.users.getAuthenticated();

//         // Fetch open PRs authored by the user in this repository
//         const { data: prs } = await octokit.rest.pulls.list({
//             owner,
//             repo: repoName,
//             state: 'open',
//             head: `${owner}:${user.login}`
//         });

//         const prCount = prs.length;
//         if (prCount === 0) {
//             myStatusBarItem.text = `$(git-pull-request) 0 PRs`;
//             myStatusBarItem.tooltip = `No open pull requests for this repository.`;
//             myStatusBarItem.show();
//             return;
//         }

//         // Check the status of the most recent open PR
//         const latestPR = prs[0];
//         const { data: statusData } = await octokit.rest.checks.listForRef({
//             owner,
//             repo: repoName,
//             ref: latestPR.head.sha
//         });

//         // Determine if checks are passing, failing, or pending
//         const conclusions = statusData.check_runs.map(run => run.conclusion);
//         let statusIcon = `$(sync~spin)`; // Pending

//         if (conclusions.includes('failure') || conclusions.includes('timed_out')) {
//             statusIcon = `$(error)`; // Failed CI
//         } else if (conclusions.length > 0 && conclusions.every(c => c === 'success')) {
//             statusIcon = `$(pass)`; // Success CI
//         }

//         // Update UI
//         myStatusBarItem.text = `$(git-pull-request) ${prCount} Open | Latest: ${statusIcon}`;
//         myStatusBarItem.tooltip = `PR #${latestPR.number}: ${latestPR.title}\nClick to view on GitHub.`;
//         myStatusBarItem.command = {
//             title: "Open PR",
//             command: "vscode.open",
//             arguments: [vscode.Uri.parse(latestPR.html_url)]
//         };
//         myStatusBarItem.show();

//     } catch (error) {
//         console.error("Error fetching PR data: ", error);
//     }
// }

// export function deactivate() {
//     if (intervalId) {
//         clearInterval(intervalId);
//     }
// }

