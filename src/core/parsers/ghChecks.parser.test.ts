import { describe, expect, it } from "vitest";
import { parseStatusCheckRollup } from "./ghChecks.parser";

describe("parseStatusCheckRollup", () => {
  it("derives PASS from a successful check", () => {
    const json = JSON.stringify({
      statusCheckRollup: [
        {
          name: "build",
          status: "COMPLETED",
          conclusion: "SUCCESS",
          detailsUrl: "https://github.com/example/repo/actions/runs/1"
        }
      ]
    });

    const res = parseStatusCheckRollup(json);
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error("expected ok");
    expect(res.data.overall).toBe("PASS");
    expect(Number.isNaN(Date.parse(res.data.updatedAt))).toBe(false);
    expect(res.data.checks).toHaveLength(1);
  });

  it("derives FAIL from a failing check", () => {
    const json = JSON.stringify({
      statusCheckRollup: [
        {
          name: "test",
          status: "COMPLETED",
          conclusion: "FAILURE"
        }
      ]
    });

    const res = parseStatusCheckRollup(json);
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error("expected ok");
    expect(res.data.overall).toBe("FAIL");
  });

  it("derives RUNNING from an in-progress check", () => {
    const json = JSON.stringify({
      statusCheckRollup: [
        {
          name: "deploy",
          status: "IN_PROGRESS",
          conclusion: null
        }
      ]
    });

    const res = parseStatusCheckRollup(json);
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error("expected ok");
    expect(res.data.overall).toBe("RUNNING");
  });
});

