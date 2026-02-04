export type WorkflowStep =
  | "NEED_BRANCH"
  | "NEED_TRACK"
  | "NEED_COMMIT"
  | "NEED_PUBLISH"
  | "NEED_PR"
  | "READY_TO_MERGE"
  | "DONE";

