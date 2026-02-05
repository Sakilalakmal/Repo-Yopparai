import type { BranchName, CommitMessage, FileChange, RepoPath } from "../domain/repo";
import { parseGitStatusPorcelainV1 } from "../parsers/gitStatus.parser";
import { commandRunner } from "../shell/commandRunner";
import { commandToString, err, isTimeoutResponse, ok, type Result } from "../shell/command.errors";

function cwdOf(path: RepoPath): string {
  return path as string;
}

function isOkTrue(stdout: string): boolean {
  return stdout.trim() === "true";
}

export class GitService {
  private async ensureNoStagedChanges(path: RepoPath): Promise<Result<void>> {
    const statusRes = await this.getStatus(path);
    if (!statusRes.ok) return statusRes;
    const hasStaged = statusRes.data.some((c) => c.isStaged);
    if (hasStaged) {
      return err("DIRTY_SWITCH_BLOCKED", "You have staged changes. Commit or unstage before switching branches.");
    }
    return ok(undefined);
  }

  private async runGitVoid(
    path: RepoPath,
    name: string,
    args: string[],
    timeoutMs: number
  ): Promise<Result<void>> {
    const res = await commandRunner.run({
      name,
      cwd: cwdOf(path),
      program: "git",
      args,
      timeoutMs
    });
    if (!res.ok) return res;
    if (isTimeoutResponse(res.data)) return err("TIMEOUT", "Command timed out.");
    if (res.data.exitCode !== 0) {
      return err("CMD_FAILED", "Git command failed.", {
        exitCode: res.data.exitCode,
        stdout: res.data.stdout,
        stderr: res.data.stderr,
        command: commandToString(name, "git", args)
      });
    }
    return ok(undefined);
  }

  async verifyRepo(path: RepoPath): Promise<Result<true>> {
    const res = await commandRunner.run({
      name: "verifyRepo",
      cwd: cwdOf(path),
      program: "git",
      args: ["rev-parse", "--is-inside-work-tree"],
      timeoutMs: 10_000
    });
    if (!res.ok) return res;
    if (isTimeoutResponse(res.data)) return err("TIMEOUT", "Command timed out.");
    if (res.data.exitCode !== 0 || !isOkTrue(res.data.stdout)) {
      return err("NOT_A_REPO", "This folder is not a Git repository.", {
        exitCode: res.data.exitCode,
        stdout: res.data.stdout,
        stderr: res.data.stderr,
        command: commandToString("verifyRepo", "git", ["rev-parse", "--is-inside-work-tree"])
      });
    }
    return ok(true);
  }

  async getBranch(path: RepoPath): Promise<Result<string>> {
    const res = await commandRunner.run({
      name: "currentBranch",
      cwd: cwdOf(path),
      program: "git",
      args: ["branch", "--show-current"],
      timeoutMs: 10_000
    });
    if (!res.ok) return res;
    if (isTimeoutResponse(res.data)) return err("TIMEOUT", "Command timed out.");
    if (res.data.exitCode !== 0) {
      return err("CMD_FAILED", "Failed to read current branch.", {
        exitCode: res.data.exitCode,
        stdout: res.data.stdout,
        stderr: res.data.stderr,
        command: commandToString("currentBranch", "git", ["branch", "--show-current"])
      });
    }
    return ok(res.data.stdout.trim());
  }

  async getStatus(path: RepoPath): Promise<Result<FileChange[]>> {
    const res = await commandRunner.run({
      name: "gitStatus",
      cwd: cwdOf(path),
      program: "git",
      args: ["status", "--porcelain=v1", "-uall"],
      timeoutMs: 30_000
    });
    if (!res.ok) return res;
    if (isTimeoutResponse(res.data)) return err("TIMEOUT", "Command timed out.");
    if (res.data.exitCode !== 0) {
      return err("CMD_FAILED", "Failed to read repository status.", {
        exitCode: res.data.exitCode,
        stdout: res.data.stdout,
        stderr: res.data.stderr,
        command: commandToString("gitStatus", "git", ["status", "--porcelain=v1", "-uall"])
      });
    }
    const changes = parseGitStatusPorcelainV1(res.data.stdout);
    return ok(changes);
  }

  async stageAll(path: RepoPath): Promise<Result<void>> {
    return this.runGitVoid(path, "stageAll", ["add", "."], 30_000);
  }

  async stageFiles(path: RepoPath, files: string[]): Promise<Result<void>> {
    if (files.length === 0) return err("INVALID_INPUT", "No files selected to stage.");
    const args = ["add", "--", ...files];
    return this.runGitVoid(path, "stageFiles", args, 30_000);
  }

  async unstageAll(path: RepoPath): Promise<Result<void>> {
    return this.runGitVoid(path, "unstageAll", ["reset"], 30_000);
  }

  async unstageFiles(path: RepoPath, files: string[]): Promise<Result<void>> {
    if (files.length === 0) return err("INVALID_INPUT", "No files selected to unstage.");
    const args = ["reset", "--", ...files];
    return this.runGitVoid(path, "unstageFiles", args, 30_000);
  }

  async commit(path: RepoPath, message: CommitMessage): Promise<Result<void>> {
    const msg = (message as string).trim();
    if (msg.length === 0) return err("INVALID_INPUT", "Please enter a commit message.");

    const statusRes = await this.getStatus(path);
    if (!statusRes.ok) return statusRes;
    const hasStaged = statusRes.data.some((c) => c.isStaged);
    if (!hasStaged) return err("INVALID_INPUT", "Nothing staged to commit.");

    return this.runGitVoid(path, "commit", ["commit", "-m", msg], 60_000);
  }

  async createAndCheckoutBranch(path: RepoPath, branch: BranchName): Promise<Result<void>> {
    const b = (branch as string).trim();
    if (b.length === 0) return err("INVALID_INPUT", "Invalid branch name.");
    const clean = await this.ensureNoStagedChanges(path);
    if (!clean.ok) return clean;
    return this.runGitVoid(path, "createAndCheckoutBranch", ["checkout", "-b", b], 30_000);
  }

  async checkoutBranch(path: RepoPath, branch: BranchName | "main"): Promise<Result<void>> {
    const b = typeof branch === "string" ? branch.trim() : (branch as string).trim();
    if (b.length === 0) return err("INVALID_INPUT", "Invalid branch name.");
    const clean = await this.ensureNoStagedChanges(path);
    if (!clean.ok) return clean;
    return this.runGitVoid(path, "checkoutBranch", ["checkout", b], 30_000);
  }

  async checkoutMain(path: RepoPath): Promise<Result<void>> {
    return this.checkoutBranch(path, "main");
  }

  async pullMain(path: RepoPath): Promise<Result<void>> {
    return this.runGitVoid(path, "pullMain", ["pull"], 120_000);
  }

  async listBranches(path: RepoPath): Promise<Result<string[]>> {
    const args = ["branch", "--format=%(refname:short)"];
    const res = await commandRunner.run({
      name: "listBranches",
      cwd: cwdOf(path),
      program: "git",
      args,
      timeoutMs: 10_000
    });
    if (!res.ok) return res;
    if (isTimeoutResponse(res.data)) return err("TIMEOUT", "Command timed out.");
    if (res.data.exitCode !== 0) {
      return err("CMD_FAILED", "Failed to list branches.", {
        exitCode: res.data.exitCode,
        stdout: res.data.stdout,
        stderr: res.data.stderr,
        command: commandToString("listBranches", "git", args)
      });
    }
    const branches = res.data.stdout
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    return ok(branches);
  }

  async branchExists(path: RepoPath, branch: BranchName): Promise<Result<boolean>> {
    const b = (branch as string).trim();
    if (b.length === 0) return err("INVALID_INPUT", "Invalid branch name.");

    const args = ["branch", "--list", b];
    const res = await commandRunner.run({
      name: "branchExists",
      cwd: cwdOf(path),
      program: "git",
      args,
      timeoutMs: 10_000
    });
    if (!res.ok) return res;
    if (isTimeoutResponse(res.data)) return err("TIMEOUT", "Command timed out.");
    if (res.data.exitCode !== 0) {
      return err("CMD_FAILED", "Failed to check branch existence.", {
        exitCode: res.data.exitCode,
        stdout: res.data.stdout,
        stderr: res.data.stderr,
        command: commandToString("branchExists", "git", args)
      });
    }

    return ok(res.data.stdout.trim().length > 0);
  }

  async ensureOriginRemote(path: RepoPath): Promise<Result<string>> {
    const args = ["remote", "get-url", "origin"];
    const res = await commandRunner.run({
      name: "gitRemoteOrigin",
      cwd: cwdOf(path),
      program: "git",
      args,
      timeoutMs: 10_000
    });
    if (!res.ok) return res;
    if (isTimeoutResponse(res.data)) return err("TIMEOUT", "Command timed out.");
    if (res.data.exitCode !== 0) {
      const combined = `${res.data.stdout}\n${res.data.stderr}`.toLowerCase();
      if (combined.includes("no such remote") && combined.includes("origin")) {
        return err("NO_REMOTE", "No 'origin' remote found.", {
          exitCode: res.data.exitCode,
          stdout: res.data.stdout,
          stderr: res.data.stderr,
          command: commandToString("gitRemoteOrigin", "git", args)
        });
      }
      return err("CMD_FAILED", "Failed to read 'origin' remote.", {
        exitCode: res.data.exitCode,
        stdout: res.data.stdout,
        stderr: res.data.stderr,
        command: commandToString("gitRemoteOrigin", "git", args)
      });
    }
    return ok(res.data.stdout.trim());
  }

  async pushSetUpstream(path: RepoPath, branch: BranchName): Promise<Result<void>> {
    const b = (branch as string).trim();
    if (b.length === 0) return err("INVALID_INPUT", "Invalid branch name.");
    return this.runGitVoid(path, "pushSetUpstream", ["push", "-u", "origin", b], 120_000);
  }
}

export const gitService = new GitService();

