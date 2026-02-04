export type RepoPath = string & { readonly __brand: "RepoPath" };

export type CommitMessage = string & { readonly __brand: "CommitMessage" };

export type BranchName = string & { readonly __brand: "BranchName" };

export type BaseBranchName = "main" & { readonly __brand: "BaseBranchName" };

export type GitStatusChar = "M" | "A" | "D" | "R" | "C" | "U" | "?" | " ";

export type FileChangeKind = "tracked" | "untracked";

export type FileChange = {
  path: string;
  kind: FileChangeKind;
  indexStatus: GitStatusChar;
  worktreeStatus: GitStatusChar;
  isStaged: boolean;
  stageable: boolean;
};

export type RepoInfo = {
  path: RepoPath;
  branch: string;
  isClean: boolean;
  stagedCount: number;
  stageableCount: number;
  hasUntracked: boolean;
  changes: FileChange[];
};

