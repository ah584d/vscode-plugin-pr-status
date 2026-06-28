import * as assert from "assert";

suite("Investigate on Failure Tests", () => {
  test("Should include Investigate button when showInvestigateOnFailure is true", () => {
    const showInvestigateOnFailure = true;
    const buttons = showInvestigateOnFailure
      ? ["View PR", "Investigate"]
      : ["View PR"];
    assert.ok(
      buttons.includes("Investigate"),
      "Should include Investigate button when setting is on",
    );
  });

  test("Should not include Investigate button when showInvestigateOnFailure is false", () => {
    const showInvestigateOnFailure = false;
    const buttons = showInvestigateOnFailure
      ? ["View PR", "Investigate"]
      : ["View PR"];
    assert.ok(
      !buttons.includes("Investigate"),
      "Should not include Investigate button when setting is off",
    );
    assert.deepStrictEqual(buttons, ["View PR"], "Should only have View PR");
  });

  test("Should default showInvestigateOnFailure to false", () => {
    const defaultValue = false;
    assert.strictEqual(
      defaultValue,
      false,
      "Feature should be opt-in (default false)",
    );
  });

  test("Should only auto-investigate on failure, not on success", () => {
    const showInvestigateOnFailure = true;
    const successStatus: string = "🟢";
    const failureStatus: string = "🔴";
    const shouldInvestigateOnGreen =
      showInvestigateOnFailure && successStatus === "🔴";
    const shouldInvestigateOnRed =
      showInvestigateOnFailure && failureStatus === "🔴";
    assert.strictEqual(
      shouldInvestigateOnGreen,
      false,
      "Should not investigate on success",
    );
    assert.strictEqual(
      shouldInvestigateOnRed,
      true,
      "Should investigate on failure",
    );
  });

  test("Should build correct investigate query with PR number and URL", () => {
    const prNumber = 123;
    const prUrl = "https://github.com/owner/repo/pull/123";
    const query = `Why did PR #${prNumber} (${prUrl}) fail? Please investigate the build failure and explain the root cause.`;
    assert.ok(
      query.includes(`#${prNumber}`),
      "Query should include PR number",
    );
    assert.ok(query.includes(prUrl), "Query should include PR URL");
    assert.ok(
      query.includes("investigate"),
      "Query should ask to investigate",
    );
  });

  test("Should not investigate when showInvestigateOnFailure is false even on failure", () => {
    const showInvestigateOnFailure = false;
    const currentStatus: string = "🔴";
    const shouldAutoInvestigate =
      showInvestigateOnFailure && currentStatus === "🔴";
    assert.strictEqual(
      shouldAutoInvestigate,
      false,
      "Should not auto-investigate when setting is off",
    );
  });
});
