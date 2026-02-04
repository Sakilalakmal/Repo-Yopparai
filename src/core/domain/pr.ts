export type PullRequestState = "OPEN" | "CLOSED" | "MERGED";

export type PullRequest = {
  number: number;
  title: string;
  url: string;
  state: PullRequestState;
  baseRefName: string;
  headRefName: string;
  isDraft: boolean;
};

