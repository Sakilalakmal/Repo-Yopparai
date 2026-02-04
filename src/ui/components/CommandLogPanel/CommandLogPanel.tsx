import React from "react";
import type { CommandLogEntry } from "../../../core/shell/command.types";
import { commandLogger } from "../../../core/utils/logger";

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString();
}

export function CommandLogPanel(): React.JSX.Element {
  const [entries, setEntries] = React.useState<readonly CommandLogEntry[]>(() =>
    commandLogger.getLatest(20)
  );

  React.useEffect(() => {
    const unsub = commandLogger.subscribe((all) => setEntries(all.slice(0, 20)));
    return () => {
      unsub();
    };
  }, []);

  return (
    <div style={{ border: "1px solid rgba(127,127,127,0.3)", borderRadius: 10, padding: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontWeight: 700 }}>Command log</div>
        <div style={{ opacity: 0.75, fontSize: 12 }}>{entries.length} shown</div>
      </div>

      <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
        {entries.length === 0 ? (
          <div style={{ opacity: 0.75 }}>No commands yet.</div>
        ) : (
          entries.map((e) => (
            <details
              key={e.id}
              style={{
                border: "1px solid rgba(127,127,127,0.2)",
                borderRadius: 8,
                padding: 10
              }}
            >
              <summary style={{ cursor: "pointer" }}>
                <span style={{ fontWeight: 600 }}>{e.name}</span>{" "}
                <span style={{ opacity: 0.75, fontSize: 12 }}>
                  ({formatWhen(e.startedAt)} • {e.durationMs}ms • exit {e.exitCode} •{" "}
                  {e.ok ? "ok" : "fail"})
                </span>
                <div style={{ opacity: 0.8, fontSize: 12, marginTop: 4 }}>
                  <code>{e.cwd}</code> • <code>{e.args.join(" ")}</code>
                </div>
              </summary>

              <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>stdout</div>
                  <pre
                    style={{
                      margin: 0,
                      padding: 10,
                      borderRadius: 8,
                      background: "rgba(127,127,127,0.12)",
                      overflowX: "auto",
                      maxHeight: 220
                    }}
                  >
                    {e.stdout.length > 0 ? e.stdout : e.stdoutPreview}
                  </pre>
                </div>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>stderr</div>
                  <pre
                    style={{
                      margin: 0,
                      padding: 10,
                      borderRadius: 8,
                      background: "rgba(127,127,127,0.12)",
                      overflowX: "auto",
                      maxHeight: 220
                    }}
                  >
                    {e.stderr.length > 0 ? e.stderr : e.stderrPreview}
                  </pre>
                </div>
              </div>
            </details>
          ))
        )}
      </div>
    </div>
  );
}
