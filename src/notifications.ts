import * as vscode from "vscode";

// ─── Investigate on Failure ──────────────────────────────────────────────────

export function openInvestigateChat(prNumber: number, prUrl: string) {
  const query = `Why did PR #${prNumber} (${prUrl}) fail? Please investigate the build failure and explain the root cause.`;
  vscode.commands.executeCommand("workbench.action.chat.open", { query });
  vscode.window.showInformationMessage(`PR #${prNumber} failed — Copilot Chat opened to investigate.`);
}
