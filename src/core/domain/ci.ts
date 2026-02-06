export type CheckConclusion =
  | "SUCCESS"
  | "FAILURE"
  | "NEUTRAL"
  | "CANCELLED"
  | "SKIPPED"
  | "TIMED_OUT"
  | "ACTION_REQUIRED"
  | "STALE"
  | "STARTUP_FAILURE"
  | "UNKNOWN";

export type CheckStatus = "COMPLETED" | "IN_PROGRESS" | "QUEUED" | "UNKNOWN";

export type StatusCheck = {
  name: string;
  status: CheckStatus;
  conclusion: CheckConclusion;
  detailsUrl?: string;
};

export type PrChecks = {
  overall: "PASS" | "FAIL" | "RUNNING" | "UNKNOWN";
  checks: StatusCheck[];
  updatedAt: string; // ISO
};

