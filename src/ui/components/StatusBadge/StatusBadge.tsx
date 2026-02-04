import React from "react";
import { Badge } from "../ui/badge";
import { cn } from "../ui/utils";

export type StatusBadgeVariant = "clean" | "dirty" | "untracked" | "staged" | "modified" | "error";

const classByVariant: Record<StatusBadgeVariant, string> = {
  clean: "bg-emerald-600 text-white border-transparent",
  dirty: "bg-rose-600 text-white border-transparent",
  untracked: "bg-muted text-foreground",
  staged: "bg-blue-600 text-white border-transparent",
  modified: "bg-amber-600 text-white border-transparent",
  error: "bg-destructive text-destructive-foreground border-transparent"
};

export function StatusBadge(props: { label: string; variant: StatusBadgeVariant }): React.JSX.Element {
  return (
    <Badge className={cn("select-none", classByVariant[props.variant])} variant="secondary">
      {props.label}
    </Badge>
  );
}

