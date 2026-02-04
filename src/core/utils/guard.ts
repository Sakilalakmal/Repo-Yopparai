import type { BaseBranchName, BranchName, CommitMessage, RepoPath } from "../domain/repo";
import type { RunCommandResponse } from "../shell/command.types";
import { err, ok, type Result } from "../shell/command.errors";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isString(value: unknown): value is string {
  return typeof value === "string";
}

export function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function toRepoPath(input: string): Result<RepoPath> {
  const trimmed = input.trim();
  if (trimmed.length === 0) return err("INVALID_PATH", "Please select a valid folder path.");
  return ok(trimmed as RepoPath);
}

export function parseCommitMessage(input: string): Result<CommitMessage> {
  const trimmed = input.trim();
  if (trimmed.length === 0) return err("INVALID_INPUT", "Please enter a commit message.");
  return ok(trimmed as CommitMessage);
}

export function parseBranchName(input: string): Result<BranchName> {
  const trimmed = input.trim();
  if (trimmed.length === 0) return err("INVALID_INPUT", "Branch name is required.");
  if (/\s/.test(trimmed)) return err("INVALID_INPUT", "Branch name cannot contain spaces.");
  if (trimmed.startsWith("-")) return err("INVALID_INPUT", "Branch name cannot start with '-'.");
  if (trimmed.endsWith("/")) return err("INVALID_INPUT", "Branch name cannot end with '/'.");
  if (trimmed.includes("..")) return err("INVALID_INPUT", "Branch name cannot contain '..'.");
  if (trimmed.includes("//")) return err("INVALID_INPUT", "Branch name cannot contain '//'.");
  if (!/^[A-Za-z0-9._][A-Za-z0-9/_.-]*$/.test(trimmed)) {
    return err("INVALID_INPUT", "Invalid branch name.");
  }
  return ok(trimmed as BranchName);
}

export function parseBaseBranchName(input: string): Result<BaseBranchName> {
  const trimmed = input.trim();
  if (trimmed !== "main") return err("INVALID_INPUT", "Base branch must be 'main'.");
  return ok("main" as BaseBranchName);
}

export function isRunCommandResponse(value: unknown): value is RunCommandResponse {
  if (!isRecord(value)) return false;
  return (
    isNumber(value.exitCode) &&
    isString(value.stdout) &&
    isString(value.stderr) &&
    Object.keys(value).every((k) => k === "exitCode" || k === "stdout" || k === "stderr")
  );
}

