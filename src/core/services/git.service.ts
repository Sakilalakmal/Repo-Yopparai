import type { FileChange, RepoPath } from "../domain/repo";
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
}

export const gitService = new GitService();

