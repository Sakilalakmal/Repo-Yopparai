import type { RepoPath } from "../domain/repo";
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

export function isRunCommandResponse(value: unknown): value is RunCommandResponse {
  if (!isRecord(value)) return false;
  return (
    isNumber(value.exitCode) &&
    isString(value.stdout) &&
    isString(value.stderr) &&
    Object.keys(value).every((k) => k === "exitCode" || k === "stdout" || k === "stderr")
  );
}

