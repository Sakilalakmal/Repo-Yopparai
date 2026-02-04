import { describe, expect, it } from "vitest";
import { parseGitStatusPorcelainV1 } from "./gitStatus.parser";

describe("parseGitStatusPorcelainV1", () => {
  it("parses untracked as stageable", () => {
    const changes = parseGitStatusPorcelainV1("?? foo.txt\n");
    expect(changes).toHaveLength(1);
    expect(changes[0]).toEqual({
      path: "foo.txt",
      kind: "untracked",
      indexStatus: "?",
      worktreeStatus: "?",
      isStaged: false,
      stageable: true
    });
  });

  it("marks staged when indexStatus is not space", () => {
    const changes = parseGitStatusPorcelainV1("M  staged.txt\n");
    expect(changes[0]?.isStaged).toBe(true);
    expect(changes[0]?.stageable).toBe(false);
  });

  it("marks modified unstaged as stageable", () => {
    const changes = parseGitStatusPorcelainV1(" M modified.txt\n");
    expect(changes[0]?.isStaged).toBe(false);
    expect(changes[0]?.stageable).toBe(true);
  });

  it("supports stagedCount via isStaged", () => {
    const changes = parseGitStatusPorcelainV1(["M  a.txt", " M b.txt", "A  c.txt", "?? d.txt", ""].join("\n"));
    const stagedCount = changes.filter((c) => c.isStaged).length;
    expect(stagedCount).toBe(2);
  });
});

