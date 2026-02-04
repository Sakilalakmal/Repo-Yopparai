import type { CommandLogEntry } from "../shell/command.types";

type Listener = (entries: readonly CommandLogEntry[]) => void;

function preview(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen)}…`;
}

function maskSensitive(text: string): string {
  const maskedGhp = text.replace(/ghp_[A-Za-z0-9]{20,}/g, "ghp_[REDACTED]");
  const maskedTokenQuery = maskedGhp.replace(/(\btoken=)[^&\s]+/gi, "$1[REDACTED]");
  return maskedTokenQuery;
}

class CommandLogger {
  private entries: CommandLogEntry[] = [];
  private listeners: Set<Listener> = new Set();
  private seq = 0;

  nextId(): string {
    this.seq += 1;
    return String(this.seq);
  }

  add(
    entry: Omit<
      CommandLogEntry,
      "id" | "stdoutPreview" | "stderrPreview" | "stdout" | "stderr"
    > & { stdout: string; stderr: string }
  ): void {
    const stdoutMasked = maskSensitive(entry.stdout);
    const stderrMasked = maskSensitive(entry.stderr);
    const full: CommandLogEntry = {
      ...entry,
      id: this.nextId(),
      stdout: stdoutMasked,
      stderr: stderrMasked,
      stdoutPreview: preview(stdoutMasked, 200),
      stderrPreview: preview(stderrMasked, 200)
    };
    this.entries = [full, ...this.entries].slice(0, 100);
    for (const listener of this.listeners) listener(this.entries);
  }

  getLatest(limit: number): readonly CommandLogEntry[] {
    return this.entries.slice(0, limit);
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.entries);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const commandLogger = new CommandLogger();

