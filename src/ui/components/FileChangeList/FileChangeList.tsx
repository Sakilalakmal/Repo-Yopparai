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
    return <div className="text-sm text-muted-foreground">No changes detected.</div>;
  }

  return (
    <div className="space-y-2">
      {props.changes.map((c) => (
        <div
          key={`${c.kind}:${c.path}`}
          className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-md border p-3"
        >
          <input
            type="checkbox"
            checked={props.selectedPaths.has(c.path)}
            disabled={!c.stageable}
            onChange={() => props.onToggleSelected(c.path)}
            aria-label={`Select ${c.path}`}
          />
          <div className="min-w-0">
            <div className="truncate font-medium">{c.path}</div>
            {c.kind === "tracked" ? (
              <div className="mt-1 text-xs text-muted-foreground">
                index: <code className="rounded bg-muted px-1 py-0.5">{c.indexStatus}</code> • worktree:{" "}
                <code className="rounded bg-muted px-1 py-0.5">{c.worktreeStatus}</code>
              </div>
            ) : (
              <div className="mt-1 text-xs text-muted-foreground">untracked</div>
            )}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            {c.kind === "untracked" ? <StatusBadge label="Untracked" variant="untracked" /> : null}
            {c.isStaged ? <StatusBadge label="Staged" variant="staged" /> : null}
            {isModified(c) ? <StatusBadge label="Modified" variant="modified" /> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

