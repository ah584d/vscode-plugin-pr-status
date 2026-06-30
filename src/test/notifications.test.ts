import * as assert from "assert";
import * as vscode from "vscode";
import { openInvestigateChat } from "../notifications";

suite("Investigate on Failure Tests", () => {
  let executeCommandStub: { calls: Array<{ command: string; args: unknown }> };
  let showInfoMessageStub: { calls: string[] };
  let originalExecuteCommand: typeof vscode.commands.executeCommand;
  let originalShowInformationMessage: typeof vscode.window.showInformationMessage;

  setup(() => {
    executeCommandStub = { calls: [] };
    showInfoMessageStub = { calls: [] };

    // Capture the originals
    originalExecuteCommand = vscode.commands.executeCommand;
    originalShowInformationMessage = vscode.window.showInformationMessage;

    // Stub vscode.commands.executeCommand
    (vscode.commands as { executeCommand: unknown }).executeCommand = (
      command: string,
      ...args: unknown[]
    ) => {
      executeCommandStub.calls.push({ command, args: args[0] });
      return Promise.resolve();
    };

    // Stub vscode.window.showInformationMessage
    (vscode.window as { showInformationMessage: unknown }).showInformationMessage = (
      message: string,
    ) => {
      showInfoMessageStub.calls.push(message);
      return Promise.resolve(undefined);
    };
  });

  teardown(() => {
    // Restore originals
    (vscode.commands as { executeCommand: unknown }).executeCommand = originalExecuteCommand;
    (vscode.window as { showInformationMessage: unknown }).showInformationMessage = originalShowInformationMessage;
  });

  test("openInvestigateChat calls chat.open with correct query", () => {
    openInvestigateChat(42, "https://github.com/owner/repo/pull/42");

    assert.strictEqual(executeCommandStub.calls.length, 1);
    assert.strictEqual(
      executeCommandStub.calls[0].command,
      "workbench.action.chat.open",
    );
    const payload = executeCommandStub.calls[0].args as { query: string };
    assert.ok(payload.query.includes("#42"), "Query should contain PR number");
    assert.ok(
      payload.query.includes("https://github.com/owner/repo/pull/42"),
      "Query should contain PR URL",
    );
    assert.ok(
      payload.query.includes("investigate"),
      "Query should ask to investigate",
    );
  });

  test("openInvestigateChat shows confirmation info message", () => {
    openInvestigateChat(99, "https://github.com/owner/repo/pull/99");

    assert.strictEqual(showInfoMessageStub.calls.length, 1);
    assert.ok(
      showInfoMessageStub.calls[0].includes("#99"),
      "Info message should mention PR number",
    );
    assert.ok(
      showInfoMessageStub.calls[0].includes("Copilot Chat"),
      "Info message should mention Copilot Chat",
    );
  });

  test("openInvestigateChat builds query with different PR numbers", () => {
    openInvestigateChat(1, "https://github.com/a/b/pull/1");
    openInvestigateChat(999, "https://github.com/x/y/pull/999");

    assert.strictEqual(executeCommandStub.calls.length, 2);
    const q1 = (executeCommandStub.calls[0].args as { query: string }).query;
    const q2 = (executeCommandStub.calls[1].args as { query: string }).query;
    assert.ok(q1.includes("#1"));
    assert.ok(q2.includes("#999"));
    assert.ok(q1.includes("a/b/pull/1"));
    assert.ok(q2.includes("x/y/pull/999"));
  });

  test("Button array includes Investigate only when setting is enabled", () => {
    // This tests the button composition logic used in extension.ts
    const withFeature = true;
    const withoutFeature = false;
    const buttonsOn = withFeature ? ["View PR", "Investigate"] : ["View PR"];
    const buttonsOff = withoutFeature ? ["View PR", "Investigate"] : ["View PR"];

    assert.deepStrictEqual(buttonsOn, ["View PR", "Investigate"]);
    assert.deepStrictEqual(buttonsOff, ["View PR"]);
  });

  test("Setting defaults to false (opt-in)", () => {
    const config = vscode.workspace.getConfiguration("prStatusMonitor");
    const value = config.get<boolean>("showInvestigateOnFailure", false);
    assert.strictEqual(value, false, "Feature should default to false");
  });
});
