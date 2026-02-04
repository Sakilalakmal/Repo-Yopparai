import type { BaseBranchName, BranchName } from "../domain/repo";
import type { PullRequest } from "../domain/pr";
import { parseGhPrJson } from "../parsers/ghPr.parser";
import { commandRunner } from "../shell/commandRunner";
import { commandToString, err, isTimeoutResponse, ok, type Result } from "../shell/command.errors";
import type { RepoPath } from "../domain/repo";

function cwdOf(path: RepoPath): string {
  return path as string;
}

function isGhJsonFlagUnsupported(stdout: string, stderr: string): boolean {
  const text = `${stdout}\n${stderr}`.toLowerCase();
  if (!text.includes("--json")) return false;
  return (
    text.includes("unknown flag") ||
    text.includes("unknown shorthand flag") ||
    text.includes("unknown option") ||
    text.includes("flag provided but not defined")
  );
}

function isPrNotFound(stdout: string, stderr: string): boolean {
  const text = `${stdout}\n${stderr}`.toLowerCase();
  return (
    text.includes("no pull requests found") ||
    text.includes("no pull request found") ||
    text.includes("no open pull requests") ||
    text.includes("could not find any pull requests")
  );
}

export class GitHubService {
  async ensureGhInstalled(repoPath: RepoPath): Promise<Result<void>> {
    const args = ["--version"];
    const res = await commandRunner.run({
      name: "ghVersion",
      cwd: cwdOf(repoPath),
      program: "gh",
      args,
      timeoutMs: 10_000
    });
    if (!res.ok) return res;
    if (isTimeoutResponse(res.data)) return err("TIMEOUT", "Command timed out.");
    if (res.data.exitCode !== 0) {
      return err("GH_NOT_INSTALLED", "GitHub CLI (gh) is not available.", {
        exitCode: res.data.exitCode,
        stdout: res.data.stdout,
        stderr: res.data.stderr,
        command: commandToString("ghVersion", "gh", args)
      });
    }
    return ok(undefined);
  }

  async ensureGhAuthed(repoPath: RepoPath): Promise<Result<void>> {
    const args = ["auth", "status"];
    const res = await commandRunner.run({
      name: "ghAuthStatus",
      cwd: cwdOf(repoPath),
      program: "gh",
      args,
      timeoutMs: 15_000
    });
    if (!res.ok) return res;
    if (isTimeoutResponse(res.data)) return err("TIMEOUT", "Command timed out.");
    if (res.data.exitCode !== 0) {
      return err("GH_NOT_AUTHED", "GitHub CLI not authenticated. Run: gh auth login", {
        exitCode: res.data.exitCode,
        stdout: res.data.stdout,
        stderr: res.data.stderr,
        command: commandToString("ghAuthStatus", "gh", args)
      });
    }
    return ok(undefined);
  }

  async createPr(params: {
    repoPath: RepoPath;
    base: BaseBranchName;
    head: BranchName;
    title: string;
    body?: string;
    draft?: boolean;
  }): Promise<Result<PullRequest>> {
    if ((params.head as string).trim() === "main") {
      return err("INVALID_INPUT", "Create a feature branch to open a PR.");
    }

    const installed = await this.ensureGhInstalled(params.repoPath);
    if (!installed.ok) return installed;
    const authed = await this.ensureGhAuthed(params.repoPath);
    if (!authed.ok) return authed;

    const body = params.body ?? "";
    const jsonFields = "number,title,url,state,baseRefName,headRefName,isDraft";
    const argsWithJson = [
      "pr",
      "create",
      "--base",
      params.base as string,
      "--head",
      params.head as string,
      "--title",
      params.title,
      "--body",
      body
    ];
    if (params.draft) argsWithJson.push("--draft");
    argsWithJson.push("--json", jsonFields);

    const res = await commandRunner.run({
      name: "ghPrCreate",
      cwd: cwdOf(params.repoPath),
      program: "gh",
      args: argsWithJson,
      timeoutMs: 60_000
    });
    if (!res.ok) return res;
    if (isTimeoutResponse(res.data)) return err("TIMEOUT", "Command timed out.");

    if (res.data.exitCode === 0) {
      const parsed = parseGhPrJson(res.data.stdout);
      if (!parsed.ok) {
        return err(parsed.error.code, parsed.error.message, {
          stdout: res.data.stdout,
          stderr: res.data.stderr,
          command: commandToString("ghPrCreate", "gh", argsWithJson)
        });
      }
      return parsed;
    }

    if (!isGhJsonFlagUnsupported(res.data.stdout, res.data.stderr)) {
      return err("CMD_FAILED", "Failed to create pull request.", {
        exitCode: res.data.exitCode,
        stdout: res.data.stdout,
        stderr: res.data.stderr,
        command: commandToString("ghPrCreate", "gh", argsWithJson)
      });
    }

    const argsFallback = [
      "pr",
      "create",
      "--base",
      params.base as string,
      "--head",
      params.head as string,
      "--title",
      params.title,
      "--body",
      body
    ];
    if (params.draft) argsFallback.push("--draft");

    const created = await commandRunner.run({
      name: "ghPrCreateFallback",
      cwd: cwdOf(params.repoPath),
      program: "gh",
      args: argsFallback,
      timeoutMs: 60_000
    });
    if (!created.ok) return created;
    if (isTimeoutResponse(created.data)) return err("TIMEOUT", "Command timed out.");
    if (created.data.exitCode !== 0) {
      return err("CMD_FAILED", "Failed to create pull request.", {
        exitCode: created.data.exitCode,
        stdout: created.data.stdout,
        stderr: created.data.stderr,
        command: commandToString("ghPrCreateFallback", "gh", argsFallback)
      });
    }

    const viewed = await this.viewPrForCurrentBranch(params.repoPath);
    if (!viewed.ok) return viewed;
    return viewed;
  }

  async viewPrForCurrentBranch(repoPath: RepoPath): Promise<Result<PullRequest>> {
    const installed = await this.ensureGhInstalled(repoPath);
    if (!installed.ok) return installed;
    const authed = await this.ensureGhAuthed(repoPath);
    if (!authed.ok) return authed;

    const jsonFields = "number,title,url,state,baseRefName,headRefName,isDraft";
    const args = ["pr", "view", "--json", jsonFields];
    const res = await commandRunner.run({
      name: "ghPrView",
      cwd: cwdOf(repoPath),
      program: "gh",
      args,
      timeoutMs: 30_000
    });
    if (!res.ok) return res;
    if (isTimeoutResponse(res.data)) return err("TIMEOUT", "Command timed out.");
    if (res.data.exitCode !== 0) {
      if (isPrNotFound(res.data.stdout, res.data.stderr)) {
        return err("PR_NOT_FOUND", "No pull request found for the current branch.", {
          exitCode: res.data.exitCode,
          stdout: res.data.stdout,
          stderr: res.data.stderr,
          command: commandToString("ghPrView", "gh", args)
        });
      }
      return err("CMD_FAILED", "Failed to view pull request.", {
        exitCode: res.data.exitCode,
        stdout: res.data.stdout,
        stderr: res.data.stderr,
        command: commandToString("ghPrView", "gh", args)
      });
    }

    const parsed = parseGhPrJson(res.data.stdout);
    if (!parsed.ok) {
      return err(parsed.error.code, parsed.error.message, {
        stdout: res.data.stdout,
        stderr: res.data.stderr,
        command: commandToString("ghPrView", "gh", args)
      });
    }
    return parsed;
  }
}

export const githubService = new GitHubService();

