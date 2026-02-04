import React from "react";
import type { CommandLogEntry } from "../../../core/shell/command.types";
import { commandLogger } from "../../../core/utils/logger";

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString();
}

export function CommandLogPanel(props: { limit?: number }): React.JSX.Element {
  const limit = props.limit ?? 20;
  const [entries, setEntries] = React.useState<readonly CommandLogEntry[]>(() =>
    commandLogger.getLatest(limit)
  );

  React.useEffect(() => {
    const unsub = commandLogger.subscribe((all) => setEntries(all.slice(0, limit)));
    return () => {
      unsub();
    };
  }, [limit]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div>{entries.length} shown</div>
      </div>

      {entries.length === 0 ? (
        <div className="text-sm text-muted-foreground">No commands yet.</div>
      ) : (
        entries.map((e) => (
          <details key={e.id} className="rounded-md border p-3">
            <summary className="cursor-pointer select-none">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{e.name}</span>
                <span className="text-xs text-muted-foreground">
                  ({formatWhen(e.startedAt)} • {e.durationMs}ms • exit {e.exitCode} • {e.ok ? "ok" : "fail"})
                </span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                <code className="rounded bg-muted px-1 py-0.5">{e.cwd}</code> •{" "}
                <code className="rounded bg-muted px-1 py-0.5">{e.args.join(" ")}</code>
              </div>
            </summary>

            <div className="mt-3 grid gap-3">
              <div>
                <div className="mb-1 text-sm font-medium">stdout</div>
                <pre className="max-h-56 overflow-auto rounded-md border bg-muted/40 p-3 text-xs">
                  {e.stdout.length > 0 ? e.stdout : e.stdoutPreview}
                </pre>
              </div>
              <div>
                <div className="mb-1 text-sm font-medium">stderr</div>
                <pre className="max-h-56 overflow-auto rounded-md border bg-muted/40 p-3 text-xs">
                  {e.stderr.length > 0 ? e.stderr : e.stderrPreview}
                </pre>
              </div>
            </div>
          </details>
        ))
      )}
    </div>
  );
}
