import type { CheckConclusion, CheckStatus, PrChecks, StatusCheck } from "../domain/ci";
import { err, ok, type Result } from "../shell/command.errors";
import { isRecord, isString } from "../utils/guard";

function toCheckStatus(value: unknown): CheckStatus {
  if (value === "COMPLETED" || value === "IN_PROGRESS" || value === "QUEUED") return value;
  return "UNKNOWN";
}

function toCheckConclusion(value: unknown): CheckConclusion {
  if (
    value === "SUCCESS" ||
    value === "FAILURE" ||
    value === "NEUTRAL" ||
    value === "CANCELLED" ||
    value === "SKIPPED" ||
    value === "TIMED_OUT" ||
    value === "ACTION_REQUIRED" ||
    value === "STALE" ||
    value === "STARTUP_FAILURE"
  ) {
    return value;
  }
  return "UNKNOWN";
}

function isHttpsUrl(value: unknown): value is string {
  return isString(value) && value.trim().startsWith("https://");
}

function parseChecksFromRollup(value: unknown): StatusCheck[] {
  if (!Array.isArray(value)) return [];

  const checks: StatusCheck[] = [];
  for (const item of value) {
    if (!isRecord(item)) continue;
    const name = item.name;
    if (!isString(name) || name.trim().length === 0) continue;

    const status = toCheckStatus(item.status);
    const conclusion = toCheckConclusion(item.conclusion);
    const detailsUrl = isHttpsUrl(item.detailsUrl) ? item.detailsUrl.trim() : undefined;

    checks.push({
      name: name.trim(),
      status,
      conclusion,
      ...(detailsUrl ? { detailsUrl } : {})
    });
  }
  return checks;
}

function deriveOverall(checks: readonly StatusCheck[]): PrChecks["overall"] {
  const hasRunning = checks.some((c) => c.status === "IN_PROGRESS" || c.status === "QUEUED");
  if (hasRunning) return "RUNNING";

  const hasFail = checks.some(
    (c) => c.conclusion === "FAILURE" || c.conclusion === "CANCELLED" || c.conclusion === "TIMED_OUT"
  );
  if (hasFail) return "FAIL";

  const allPass =
    checks.length > 0 &&
    checks.every((c) => c.conclusion === "SUCCESS" || c.conclusion === "SKIPPED" || c.conclusion === "NEUTRAL");
  if (allPass) return "PASS";

  return "UNKNOWN";
}

function tryExtractUpdatedAtIso(root: Record<string, unknown>): string | null {
  const rollup = root.statusCheckRollup;
  if (!Array.isArray(rollup)) return null;

  let bestIso: string | null = null;
  let bestTs = -1;

  for (const item of rollup) {
    if (!isRecord(item)) continue;
    const candidates: unknown[] = [item.completedAt, item.startedAt, item.updatedAt];
    for (const c of candidates) {
      if (!isString(c)) continue;
      const ts = Date.parse(c);
      if (!Number.isFinite(ts)) continue;
      if (ts > bestTs) {
        bestTs = ts;
        bestIso = c;
      }
    }
  }

  return bestIso;
}

export function parseStatusCheckRollup(jsonText: string): Result<PrChecks> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (_e: unknown) {
    return err("PARSE_ERROR", "Failed to parse GitHub CLI JSON.");
  }

  if (!isRecord(parsed)) return err("PARSE_ERROR", "GitHub CLI JSON was not an object.");

  const checks = parseChecksFromRollup(parsed.statusCheckRollup);
  const overall = deriveOverall(checks);
  const updatedAt = tryExtractUpdatedAtIso(parsed) ?? new Date().toISOString();

  return ok({
    overall,
    checks,
    updatedAt
  });
}

