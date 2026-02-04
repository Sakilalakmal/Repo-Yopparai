import { describe, expect, it } from "vitest";
import { parseBranchName } from "./guard";

describe("parseBranchName", () => {
  it("accepts valid branch names", () => {
    expect(parseBranchName("feature/abc").ok).toBe(true);
    expect(parseBranchName("bugfix-123").ok).toBe(true);
    expect(parseBranchName("chore.repo").ok).toBe(true);
  });

  it("rejects invalid branch names", () => {
    expect(parseBranchName("").ok).toBe(false);
    expect(parseBranchName("my branch").ok).toBe(false);
    expect(parseBranchName("../x").ok).toBe(false);
    expect(parseBranchName("a//b").ok).toBe(false);
    expect(parseBranchName("a..b").ok).toBe(false);
    expect(parseBranchName("-bad").ok).toBe(false);
  });
});

