import React from "react";
import type { FileChange } from "../../../core/domain/repo";
import { StatusBadge } from "../StatusBadge/StatusBadge";

function isModified(change: FileChange): boolean {
  return change.kind === "tracked" && change.worktreeStatus !== " ";
}

export function FileChangeList(props: {
  changes: readonly FileChange[];
  selectedPaths: ReadonlySet<string>;
  onToggleSelected: (path: string) => void;
}): React.JSX.Element {
  if (props.changes.length === 0) {
    return <div style={{ opacity: 0.8 }}>No changes detected.</div>;
  }

  return (
    <div style={{ display: "grid", gap: 8 }}>
      {props.changes.map((c) => (
        <div
          key={`${c.kind}:${c.path}`}
          style={{
            display: "grid",
            gridTemplateColumns: "auto 1fr auto",
            gap: 12,
            alignItems: "center",
            padding: "8px 10px",
            border: "1px solid rgba(127,127,127,0.3)",
            borderRadius: 8
          }}
        >
          <input
            type="checkbox"
            checked={props.selectedPaths.has(c.path)}
            disabled={!c.canStage}
            onChange={() => props.onToggleSelected(c.path)}
            aria-label={`Select ${c.path}`}
          />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis" }}>
              {c.path}
            </div>
            {c.kind === "tracked" ? (
              <div style={{ opacity: 0.75, fontSize: 12 }}>
                index: <code>{c.indexStatus}</code> • worktree: <code>{c.worktreeStatus}</code>
              </div>
            ) : (
              <div style={{ opacity: 0.75, fontSize: 12 }}>untracked</div>
            )}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {c.kind === "untracked" ? <StatusBadge label="Untracked" variant="untracked" /> : null}
            {c.isStaged ? <StatusBadge label="Staged" variant="staged" /> : null}
            {isModified(c) ? <StatusBadge label="Modified" variant="modified" /> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

