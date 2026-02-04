import type { RunCommandResponse } from "./command.types";

export type AppErrorCode =
  | "NOT_A_REPO"
  | "CMD_FAILED"
  | "TIMEOUT"
  | "INVALID_PATH"
  | "INVALID_INPUT"
  | "TAURI_ERROR";

export type AppErrorDetails = {
  exitCode?: number;
  stdout?: string;
  stderr?: string;
  command?: string;
};

export type AppError = {
  code: AppErrorCode;
  message: string;
  details?: AppErrorDetails;
};

export type Result<T> = { ok: true; data: T } | { ok: false; error: AppError };

export function ok<T>(data: T): Result<T> {
  return { ok: true, data };
}

export function err(code: AppErrorCode, message: string, details?: AppErrorDetails): Result<never> {
  if (details) return { ok: false, error: { code, message, details } };
  return { ok: false, error: { code, message } };
}

export function commandToString(name: string, program: string, args: readonly string[]): string {
  const joined = args.map((a) => JSON.stringify(a)).join(" ");
  return `${name}: ${program}${joined.length > 0 ? " " : ""}${joined}`;
}

export function isTimeoutResponse(res: RunCommandResponse): boolean {
  return res.exitCode === -1;
}
