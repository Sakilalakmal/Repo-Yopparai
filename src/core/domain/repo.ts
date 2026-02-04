export type RepoPath = string & { readonly __brand: "RepoPath" };

export type GitStatusChar = "M" | "A" | "D" | "R" | "C" | "U" | "?" | " ";

export type FileChangeKind = "tracked" | "untracked";

export type FileChange = {
  path: string;
  kind: FileChangeKind;
  indexStatus: GitStatusChar;
  worktreeStatus: GitStatusChar;
};

export type RepoInfo = {
  path: RepoPath;
  branch: string;
  isClean: boolean;
  changes: FileChange[];
};

