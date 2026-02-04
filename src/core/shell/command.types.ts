export type RunCommandRequest = {
  cwd: string;
  program: string;
  args: string[];
  timeoutMs: number;
};

export type RunCommandResponse = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

export type CommandSpec = {
  name: string;
  cwd: string;
  program: string;
  args: string[];
  timeoutMs: number;
};

export type CommandLogEntry = {
  id: string;
  name: string;
  args: string[];
  cwd: string;
  startedAt: string;
  durationMs: number;
  exitCode: number;
  ok: boolean;
  stdoutPreview: string;
  stderrPreview: string;
  stdout: string;
  stderr: string;
};

