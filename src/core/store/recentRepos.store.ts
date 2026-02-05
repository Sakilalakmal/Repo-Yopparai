import { invoke } from "@tauri-apps/api/core";
import type { RecentRepo, RecentRepoList } from "../domain/recentRepo";
import type { RepoPath } from "../domain/repo";
import { err, ok, type Result } from "../shell/command.errors";
import { isRecord, isString, toRepoPath } from "../utils/guard";

export interface RecentReposStore {
  load(): Promise<Result<RecentRepoList>>;
  save(list: RecentRepoList): Promise<Result<void>>;
  add(repo: RecentRepo): Promise<Result<RecentRepoList>>;
  remove(path: RepoPath): Promise<Result<RecentRepoList>>;
  clear(): Promise<Result<RecentRepoList>>;
}

type InvokeError = { message?: string };

function stringifyInvokeError(e: unknown): string {
  if (typeof e === "string") return e;
  if (typeof e === "object" && e !== null) {
    const maybe = e as InvokeError;
    if (typeof maybe.message === "string") return maybe.message;
  }
  return "Unknown Tauri error";
}

function repoNameFromPath(path: RepoPath): string {
  const trimmed = String(path).replace(/[\\/]+$/, "");
  const parts = trimmed.split(/[/\\]/);
  const last = parts.at(-1)?.trim();
  if (last && last.length > 0) return last;
  return trimmed;
}

type RecentRepoJson = {
  path: string;
  lastOpenedAt: string;
  name?: string;
};

function isRecentRepoJson(value: unknown): value is RecentRepoJson {
  if (!isRecord(value)) return false;
  if (!("path" in value) || !isString(value.path)) return false;
  if (!("lastOpenedAt" in value) || !isString(value.lastOpenedAt)) return false;
  if ("name" in value && value.name !== undefined && !isString(value.name)) return false;
  return true;
}

export function upsertRecentRepo(
  list: RecentRepoList,
  repo: RecentRepo,
  limit = 10
): RecentRepoList {
  const next = [repo, ...list.filter((r) => r.path !== repo.path)];
  return next.slice(0, Math.max(0, limit));
}

class RecentReposFileStore implements RecentReposStore {
  async load(): Promise<Result<RecentRepoList>> {
    try {
      const raw = await invoke<unknown>("load_recent_repos_json");
      if (raw === null || raw === undefined) return ok([]);
      if (!isString(raw)) return err("TAURI_ERROR", "Invalid recent repos response from backend.");

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return err("PARSE_ERROR", "Failed to parse recent repos JSON.");
      }

      if (!Array.isArray(parsed)) return err("PARSE_ERROR", "Recent repos JSON must be an array.");

      const out: RecentRepo[] = [];
      const seen = new Set<string>();
      for (const item of parsed) {
        if (!isRecentRepoJson(item)) continue;
        const rp = toRepoPath(item.path);
        if (!rp.ok) continue;
        if (item.lastOpenedAt.trim().length === 0) continue;

        const key = String(rp.data);
        if (seen.has(key)) continue;
        seen.add(key);

        out.push({
          path: rp.data,
          name: repoNameFromPath(rp.data),
          lastOpenedAt: item.lastOpenedAt
        });
      }
      return ok(out.slice(0, 10));
    } catch (e: unknown) {
      const msg = stringifyInvokeError(e);
      return err("TAURI_ERROR", "Failed to load recent repositories.", { stderr: msg });
    }
  }

  async save(list: RecentRepoList): Promise<Result<void>> {
    try {
      const normalized = list.slice(0, 10).map((r) => ({
        path: String(r.path),
        name: r.name,
        lastOpenedAt: r.lastOpenedAt
      }));
      const contents = JSON.stringify(normalized, null, 2);
      await invoke<unknown>("save_recent_repos_json", { contents });
      return ok(undefined);
    } catch (e: unknown) {
      const msg = stringifyInvokeError(e);
      return err("TAURI_ERROR", "Failed to save recent repositories.", { stderr: msg });
    }
  }

  async add(repo: RecentRepo): Promise<Result<RecentRepoList>> {
    const loaded = await this.load();
    if (!loaded.ok) return loaded;

    const next = upsertRecentRepo(loaded.data, repo, 10);
    const saved = await this.save(next);
    if (!saved.ok) return saved;
    return ok(next);
  }

  async remove(path: RepoPath): Promise<Result<RecentRepoList>> {
    const loaded = await this.load();
    if (!loaded.ok) return loaded;

    const next = loaded.data.filter((r) => r.path !== path);
    const saved = await this.save(next);
    if (!saved.ok) return saved;
    return ok(next);
  }

  async clear(): Promise<Result<RecentRepoList>> {
    const saved = await this.save([]);
    if (!saved.ok) return saved;
    return ok([]);
  }
}

export const recentReposStore: RecentReposStore = new RecentReposFileStore();

