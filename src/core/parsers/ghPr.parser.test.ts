import { describe, expect, it } from "vitest";
import { parseGhPrJson } from "./ghPr.parser";

describe("parseGhPrJson", () => {
  it("parses a PR from gh JSON", () => {
    const json = JSON.stringify({
      number: 42,
      title: "Add feature",
      url: "https://github.com/example/repo/pull/42",
      state: "OPEN",
      baseRefName: "main",
      headRefName: "feature/add",
      isDraft: false
    });

    const res = parseGhPrJson(json);
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error("expected ok");
    expect(res.data.number).toBe(42);
    expect(res.data.state).toBe("OPEN");
    expect(res.data.baseRefName).toBe("main");
    expect(res.data.headRefName).toBe("feature/add");
  });

  it("rejects invalid JSON", () => {
    const res = parseGhPrJson("{nope");
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("expected err");
    expect(res.error.code).toBe("PARSE_ERROR");
  });
});

