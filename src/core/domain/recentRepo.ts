import type { RepoPath } from "./repo";

export type RecentRepo = {
  path: RepoPath;
  name: string;
  lastOpenedAt: string; // ISO string
};

export type RecentRepoList = RecentRepo[];

