import type { BranchName, CommitMessage, RepoInfo, RepoPath } from "../domain/repo";
import type { PullRequest } from "../domain/pr";
import type { RecentRepo } from "../domain/recentRepo";
import { err, ok, type Result } from "../shell/command.errors";
import { commandLogger } from "../utils/logger";
import { recentReposStore, type RecentReposStore } from "../store/recentRepos.store";
import { gitService, type GitService } from "./git.service";
import { githubService, type GitHubService } from "./github.service";
import { parseBaseBranchName, parseBranchName } from "../utils/guard";

function repoNameFromPath(path: RepoPath): string {
  const trimmed = String(path).replace(/[\\/]+$/, "");
  const parts = trimmed.split(/[/\\]/);
  const last = parts.at(-1)?.trim();
  if (last && last.length > 0) return last;
  return trimmed;
}

export class RepoService {
  constructor(
    private readonly git: GitService,
    private readonly github: GitHubService,
    private readonly recentRepos: RecentReposStore
  ) {}

  async loadRepo(path: RepoPath): Promise<Result<RepoInfo>> {
    const verified = await this.git.verifyRepo(path);
    if (!verified.ok) return verified;

    const branchRes = await this.git.getBranch(path);
    if (!branchRes.ok) return branchRes;

    const statusRes = await this.git.getStatus(path);
    if (!statusRes.ok) return statusRes;

    const stagedCount = statusRes.data.filter((c) => c.isStaged).length;
    const stageableCount = statusRes.data.filter((c) => c.stageable).length;
    const hasUntracked = statusRes.data.some((c) => c.kind === "untracked");

    const info: RepoInfo = {
      path,
      branch: branchRes.data,
      isClean: statusRes.data.length === 0,
      stagedCount,
      stageableCount,
      hasUntracked,
      changes: statusRes.data
    };

    const recent: RecentRepo = {
      path,
      name: repoNameFromPath(path),
      lastOpenedAt: new Date().toISOString()
    };
    const saved = await this.recentRepos.add(recent);
    if (!saved.ok) {
      console.warn("Failed to save recent repo:", saved.error);
      commandLogger.add({
        name: "recent-repos.save",
        args: [String(path)],
        cwd: String(path),
        startedAt: new Date().toISOString(),
        durationMs: 0,
        exitCode: -1,
        ok: false,
        stdout: "",
        stderr: `${saved.error.code}: ${saved.error.message}`
      });
    }
    return ok(info);
  }

  async stageAll(path: RepoPath): Promise<Result<RepoInfo>> {
    const staged = await this.git.stageAll(path);
    if (!staged.ok) return staged;
    return this.loadRepo(path);
  }

  async stageFiles(path: RepoPath, files: string[]): Promise<Result<RepoInfo>> {
    const staged = await this.git.stageFiles(path, files);
    if (!staged.ok) return staged;
    return this.loadRepo(path);
  }

  async unstageAll(path: RepoPath): Promise<Result<RepoInfo>> {
    const unstaged = await this.git.unstageAll(path);
    if (!unstaged.ok) return unstaged;
    return this.loadRepo(path);
  }

  async unstageFiles(path: RepoPath, files: string[]): Promise<Result<RepoInfo>> {
    const unstaged = await this.git.unstageFiles(path, files);
    if (!unstaged.ok) return unstaged;
    return this.loadRepo(path);
  }

  async commit(path: RepoPath, message: CommitMessage): Promise<Result<RepoInfo>> {
    const statusRes = await this.git.getStatus(path);
    if (!statusRes.ok) return statusRes;
    const hasStaged = statusRes.data.some((c) => c.isStaged);
    if (!hasStaged) return err("INVALID_INPUT", "Nothing staged to commit.");

    const committed = await this.git.commit(path, message);
    if (!committed.ok) return committed;
    return this.loadRepo(path);
  }

  async pushCurrentBranch(path: RepoPath): Promise<Result<void>> {
    const branchRes = await this.git.getBranch(path);
    if (!branchRes.ok) return branchRes;

    const branch = parseBranchName(branchRes.data);
    if (!branch.ok) return branch;

    const origin = await this.git.ensureOriginRemote(path);
    if (!origin.ok) return origin;

    return this.git.pushSetUpstream(path, branch.data);
  }

  async createAndSwitchBranch(path: RepoPath, branch: BranchName): Promise<Result<RepoInfo>> {
    return this.createOrSwitchBranch(path, branch);
  }

  async createOrSwitchBranch(path: RepoPath, branch: BranchName): Promise<Result<RepoInfo>> {
    const exists = await this.git.branchExists(path, branch);
    if (!exists.ok) return exists;

    const updated = exists.data
      ? await this.git.checkoutBranch(path, branch)
      : await this.git.createAndCheckoutBranch(path, branch);
    if (!updated.ok) return updated;

    return this.loadRepo(path);
  }

  async switchToBranch(path: RepoPath, branchName: string): Promise<Result<RepoInfo>> {
    const trimmed = branchName.trim();
    if (trimmed.length === 0) return err("INVALID_INPUT", "Branch name is required.");
    let target: BranchName | "main";
    if (trimmed === "main") target = "main";
    else {
      const parsed = parseBranchName(trimmed);
      if (!parsed.ok) return parsed;
      target = parsed.data;
    }

    const switched = await this.git.checkoutBranch(path, target);
    if (!switched.ok) return switched;
    return this.loadRepo(path);
  }

  async listBranches(path: RepoPath): Promise<Result<string[]>> {
    return this.git.listBranches(path);
  }

  async createBranchFlow(path: RepoPath, branch: BranchName): Promise<Result<RepoInfo>> {
    const current = await this.loadRepo(path);
    if (!current.ok) return current;
    if (current.data.stagedCount > 0) {
      return err("DIRTY_SWITCH_BLOCKED", "You have staged changes. Commit or unstage before switching branches.");
    }
    return this.createOrSwitchBranch(path, branch);
  }

  async stageAllUntrackedFlow(path: RepoPath): Promise<Result<RepoInfo>> {
    const statusRes = await this.git.getStatus(path);
    if (!statusRes.ok) return statusRes;
    const untracked = statusRes.data.filter((c) => c.kind === "untracked").map((c) => c.path);
    if (untracked.length === 0) return this.loadRepo(path);
    const staged = await this.git.stageFiles(path, untracked);
    if (!staged.ok) return staged;
    return this.loadRepo(path);
  }

  async commitFlow(path: RepoPath, message: CommitMessage): Promise<Result<RepoInfo>> {
    const committed = await this.git.commit(path, message);
    if (!committed.ok) return committed;
    return this.loadRepo(path);
  }

  async publishFlow(path: RepoPath): Promise<Result<void>> {
    const branchRes = await this.git.getBranch(path);
    if (!branchRes.ok) return branchRes;
    if (branchRes.data.trim() === "main") {
      return err("INVALID_INPUT", "Create a feature branch first.");
    }

    const branch = parseBranchName(branchRes.data);
    if (!branch.ok) return branch;

    const origin = await this.git.ensureOriginRemote(path);
    if (!origin.ok) return origin;

    return this.git.pushSetUpstream(path, branch.data);
  }

  async ensurePrFlow(repoPath: RepoPath, titleInput: string, body?: string): Promise<Result<PullRequest>> {
    const repo = await this.loadRepo(repoPath);
    if (!repo.ok) return repo;
    if (repo.data.branch.trim() === "main") {
      return err("INVALID_INPUT", "Create a feature branch first.");
    }
    const branch = parseBranchName(repo.data.branch);
    if (!branch.ok) return branch;

    const viewed = await this.github.viewPrForCurrentBranch(repoPath);
    if (viewed.ok) return viewed;
    if (viewed.error.code !== "PR_NOT_FOUND") return viewed;

    const title = titleInput.trim();
    if (title.length === 0) return err("INVALID_INPUT", "PR title is required to create a PR.");

    const baseRes = parseBaseBranchName("main");
    if (!baseRes.ok) return baseRes;
    const base = baseRes.data;
    const head = branch.data;
    if (body) return this.github.createPr({ repoPath, base, head, title, body });
    return this.github.createPr({ repoPath, base, head, title });
  }

  async mergeAndSyncMainFlow(path: RepoPath, prNumber: number): Promise<Result<RepoInfo>> {
    const installed = await this.github.ensureGhInstalled(path);
    if (!installed.ok) return installed;
    const authed = await this.github.ensureGhAuthed(path);
    if (!authed.ok) return authed;

    const merged = await this.github.mergePrSquashDeleteBranch(path, prNumber);
    if (!merged.ok) return merged;

    const checkedOut = await this.git.checkoutMain(path);
    if (!checkedOut.ok) return checkedOut;

    const pulled = await this.git.pullMain(path);
    if (!pulled.ok) return pulled;

    return this.loadRepo(path);
  }
}

export const repoService = new RepoService(gitService, githubService, recentReposStore);
