import type { FileChange, GitStatusChar } from "../domain/repo";

function toStatusChar(ch: string): GitStatusChar {
  switch (ch) {
    case "M":
    case "A":
    case "D":
    case "R":
    case "C":
    case "U":
    case "?":
    case " ":
      return ch;
    default:
      return " ";
  }
}

function extractPath(raw: string): string {
  const trimmed = raw.trim();
  const arrowIdx = trimmed.lastIndexOf(" -> ");
  if (arrowIdx >= 0) return trimmed.slice(arrowIdx + " -> ".length);
  return trimmed;
}

export function parseGitStatusPorcelainV1(stdout: string): FileChange[] {
  const lines = stdout.split(/\r?\n/).filter((l) => l.length > 0);
  const changes: FileChange[] = [];

  for (const line of lines) {
    if (line.startsWith("?? ")) {
      const path = extractPath(line.slice(3));
      changes.push({
        path,
        kind: "untracked",
        indexStatus: "?",
        worktreeStatus: "?",
        isStaged: false,
        stageable: true
      });
      continue;
    }

    if (line.length < 3) continue;
    const indexStatus = toStatusChar(line[0] ?? " ");
    const worktreeStatus = toStatusChar(line[1] ?? " ");
    const path = extractPath(line.slice(3));
    const isStaged = indexStatus !== " ";
    const stageable = worktreeStatus !== " ";
    changes.push({
      path,
      kind: "tracked",
      indexStatus,
      worktreeStatus,
      isStaged,
      stageable
    });
  }

  return changes;
}

