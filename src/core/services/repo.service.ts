import type { RepoInfo, RepoPath } from "../domain/repo";
import { ok, type Result } from "../shell/command.errors";
import { gitService, type GitService } from "./git.service";

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
}

export const repoService = new RepoService(gitService);

