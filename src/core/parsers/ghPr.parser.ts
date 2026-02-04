import type { PullRequest, PullRequestState } from "../domain/pr";
import { err, ok, type Result } from "../shell/command.errors";
import { isNumber, isRecord, isString } from "../utils/guard";

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function isPullRequestState(value: unknown): value is PullRequestState {
  return value === "OPEN" || value === "CLOSED" || value === "MERGED";
}

export function parseGhPrJson(jsonText: string): Result<PullRequest> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (_e: unknown) {
    return err("PARSE_ERROR", "Failed to parse GitHub CLI JSON.");
  }

  if (!isRecord(parsed)) return err("PARSE_ERROR", "GitHub CLI JSON was not an object.");

  const {
    number,
    title,
    url,
    state,
    baseRefName,
    headRefName,
    isDraft
  }: Record<string, unknown> = parsed;

  if (!isNumber(number)) return err("PARSE_ERROR", "Missing or invalid PR number.");
  if (!isString(title)) return err("PARSE_ERROR", "Missing or invalid PR title.");
  if (!isString(url)) return err("PARSE_ERROR", "Missing or invalid PR url.");
  if (!isPullRequestState(state)) return err("PARSE_ERROR", "Missing or invalid PR state.");
  if (!isString(baseRefName)) return err("PARSE_ERROR", "Missing or invalid baseRefName.");
  if (!isString(headRefName)) return err("PARSE_ERROR", "Missing or invalid headRefName.");
  if (!isBoolean(isDraft)) return err("PARSE_ERROR", "Missing or invalid isDraft.");

  return ok({
    number,
    title,
    url,
    state,
    baseRefName,
    headRefName,
    isDraft
  });
}

