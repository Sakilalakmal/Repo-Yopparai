import React from "react";

export type StatusBadgeVariant = "clean" | "dirty" | "untracked" | "staged" | "modified" | "error";

const styles: Record<StatusBadgeVariant, React.CSSProperties> = {
  clean: { background: "#1f883d", color: "white" },
  dirty: { background: "#cf222e", color: "white" },
  untracked: { background: "#6e7781", color: "white" },
  staged: { background: "#0969da", color: "white" },
  modified: { background: "#9a6700", color: "white" },
  error: { background: "#cf222e", color: "white" }
};

export function StatusBadge(props: { label: string; variant: StatusBadgeVariant }): React.JSX.Element {
  return (
    <span
      style={{
        ...styles[props.variant],
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 12,
        lineHeight: "16px",
        whiteSpace: "nowrap"
      }}
    >
      {props.label}
    </span>
  );
}

