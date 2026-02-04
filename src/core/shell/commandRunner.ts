import { invoke } from "@tauri-apps/api/core";
import { err, ok, type Result } from "./command.errors";
import { commandLogger } from "../utils/logger";
import { isRunCommandResponse } from "../utils/guard";
import type { CommandSpec, RunCommandRequest, RunCommandResponse } from "./command.types";

type InvokeError = { message?: string };

function stringifyInvokeError(e: unknown): string {
  if (typeof e === "string") return e;
  if (typeof e === "object" && e !== null) {
    const maybe = e as InvokeError;
    if (typeof maybe.message === "string") return maybe.message;
  }
  return "Unknown Tauri error";
}

export class CommandRunner {
  async run(spec: CommandSpec): Promise<Result<RunCommandResponse>> {
    const started = Date.now();
    const startedAt = new Date(started).toISOString();
    try {
      const request: RunCommandRequest = {
        cwd: spec.cwd,
        program: spec.program,
        args: spec.args,
        timeoutMs: spec.timeoutMs
      };
      const raw = await invoke<unknown>("run_command", { request });
      if (!isRunCommandResponse(raw)) {
        const durationMs = Date.now() - started;
        commandLogger.add({
          name: spec.name,
          args: [spec.program, ...spec.args],
          cwd: spec.cwd,
          startedAt,
          durationMs,
          exitCode: -1,
          ok: false,
          stdout: "",
          stderr: "Invalid response shape from backend"
        });
        return err("TAURI_ERROR", "Backend returned an unexpected response.");
      }

      const durationMs = Date.now() - started;
      commandLogger.add({
        name: spec.name,
        args: [spec.program, ...spec.args],
        cwd: spec.cwd,
        startedAt,
        durationMs,
        exitCode: raw.exitCode,
        ok: raw.exitCode === 0,
        stdout: raw.stdout,
        stderr: raw.stderr
      });
      return ok(raw);
    } catch (e: unknown) {
      const durationMs = Date.now() - started;
      const msg = stringifyInvokeError(e);
      commandLogger.add({
        name: spec.name,
        args: [spec.program, ...spec.args],
        cwd: spec.cwd,
        startedAt,
        durationMs,
        exitCode: -1,
        ok: false,
        stdout: "",
        stderr: msg
      });
      return err("TAURI_ERROR", "Failed to run command.", { stderr: msg });
    }
  }
}

export const commandRunner = new CommandRunner();
