import type { WorkflowStep } from "../domain/flow";
import type { PullRequest } from "../domain/pr";
import type { RepoInfo } from "../domain/repo";

export function computeWorkflowStep(
  repo: RepoInfo,
  pr: PullRequest | null,
  isPublished: boolean
): WorkflowStep {
  const branch = repo.branch.trim();

  if (pr && (pr.state === "MERGED" || pr.state === "CLOSED") && branch === "main") return "DONE";
  if (branch === "" || branch === "main") return "NEED_BRANCH";

  if (repo.hasUntracked) return "NEED_TRACK";
  if (repo.stageableCount > 0 && repo.stagedCount === 0) return "NEED_TRACK";
  if (repo.stagedCount > 0) return "NEED_COMMIT";
  if (!isPublished) return "NEED_PUBLISH";
  if (!pr) return "NEED_PR";
  if (pr.state === "OPEN") return "READY_TO_MERGE";
  return "DONE";
}

