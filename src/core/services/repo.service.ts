import type { CommitMessage, RepoInfo, RepoPath } from "../domain/repo";
import { err, ok, type Result } from "../shell/command.errors";
import { gitService, type GitService } from "./git.service";
import { parseBranchName } from "../utils/guard";

export class RepoService {
  constructor(private readonly git: GitService) {}

  async loadRepo(path: RepoPath): Promise<Result<RepoInfo>> {
    const verified = await this.git.verifyRepo(path);
    if (!verified.ok) return verified;

    const branchRes = await this.git.getBranch(path);
    if (!branchRes.ok) return branchRes;

    const statusRes = await this.git.getStatus(path);
    if (!statusRes.ok) return statusRes;

    const info: RepoInfo = {
      path,
      branch: branchRes.data,
      isClean: statusRes.data.length === 0,
      changes: statusRes.data
    };
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
}

export const repoService = new RepoService(gitService);

