import { describe, expect, it } from "vitest";
import { toRepoPath } from "../utils/guard";
import type { RecentRepo } from "../domain/recentRepo";
import { upsertRecentRepo } from "./recentRepos.store";

function mk(path: string, lastOpenedAt: string): RecentRepo {
  const rp = toRepoPath(path);
  if (!rp.ok) throw new Error("invalid test path");
  return { path: rp.data, name: "repo", lastOpenedAt };
}

describe("upsertRecentRepo", () => {
  it("adds new repo to top", () => {
    const repo = mk("C:\\a\\repo1", "2026-02-05T00:00:00.000Z");
    const next = upsertRecentRepo([], repo);
    expect(next).toHaveLength(1);
    expect(next[0]?.path).toBe(repo.path);
  });

  it("de-dupes by path and moves to top", () => {
    const older = mk("C:\\a\\repo1", "2026-02-04T00:00:00.000Z");
    const other = mk("C:\\a\\repo2", "2026-02-04T01:00:00.000Z");
    const newer = mk("C:\\a\\repo1", "2026-02-05T00:00:00.000Z");
    const next = upsertRecentRepo([older, other], newer);
    expect(next).toHaveLength(2);
    expect(next[0]?.lastOpenedAt).toBe("2026-02-05T00:00:00.000Z");
    expect(next[0]?.path).toBe(older.path);
    expect(next[1]?.path).toBe(other.path);
  });

  it("trims to 10 items", () => {
    const base: RecentRepo[] = [];
    for (let i = 0; i < 10; i += 1) {
      base.push(mk(`C:\\a\\repo${i}`, `2026-02-04T00:00:0${i}.000Z`));
    }
    const repoNew = mk("C:\\a\\repo-new", "2026-02-05T00:00:00.000Z");
    const next = upsertRecentRepo(base, repoNew, 10);
    expect(next).toHaveLength(10);
    expect(next[0]?.path).toBe(repoNew.path);
  });
});
