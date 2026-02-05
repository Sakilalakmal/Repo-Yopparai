import React from "react";
import { open } from "@tauri-apps/plugin-dialog";
import type { RepoInfo, RepoPath } from "../../../core/domain/repo";
import type { PullRequest } from "../../../core/domain/pr";
import type { RecentRepoList } from "../../../core/domain/recentRepo";
import type { AppError } from "../../../core/shell/command.errors";
import { repoService } from "../../../core/services/repo.service";
import { recentReposStore } from "../../../core/store/recentRepos.store";
import { formatRelativeTime } from "../../../core/utils/format";
import { parseBranchName, parseCommitMessage, toRepoPath } from "../../../core/utils/guard";
import { computeWorkflowStep } from "../../../core/utils/workflow";
import { CommandLogPanel } from "../../components/CommandLogPanel/CommandLogPanel";
import { ConfirmDialog } from "../../components/ConfirmDialog/ConfirmDialog";
import { FileChangeList } from "../../components/FileChangeList/FileChangeList";
import { StatusBadge } from "../../components/StatusBadge/StatusBadge";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../../components/ui/collapsible";
import { Input } from "../../components/ui/input";
import { ScrollArea } from "../../components/ui/scroll-area";
import { Separator } from "../../components/ui/separator";
import { Textarea } from "../../components/ui/textarea";

function ErrorBlock(props: { error: AppError }): React.JSX.Element {
  const detailsText = props.error.details ? JSON.stringify(props.error.details, null, 2) : null;
  return (
    <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 p-3">
      <div className="flex items-center gap-2">
        <StatusBadge label={props.error.code} variant="error" />
        <div className="font-semibold">{props.error.message}</div>
      </div>

      {props.error.code === "GH_NOT_AUTHED" ? (
        <div className="mt-2 text-sm text-muted-foreground">
          Run: <code className="rounded bg-muted px-1 py-0.5">gh auth login</code>
        </div>
      ) : null}

      {detailsText ? (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm text-muted-foreground">Details</summary>
          <pre className="mt-2 max-h-64 overflow-auto rounded-md border bg-muted/40 p-3 text-xs">
            {detailsText}
          </pre>
        </details>
      ) : null}
    </div>
  );
}

export function RepoDashboardPage(): React.JSX.Element {
  const [repoPath, setRepoPath] = React.useState<RepoPath | null>(null);
  const [repoInfo, setRepoInfo] = React.useState<RepoInfo | null>(null);
  const [error, setError] = React.useState<AppError | null>(null);
  const [loading, setLoading] = React.useState(false);

  const [newBranchName, setNewBranchName] = React.useState("");
  const [localBranches, setLocalBranches] = React.useState<readonly string[]>([]);
  const [switchBranchName, setSwitchBranchName] = React.useState("");
  const [autoSelectUntracked, setAutoSelectUntracked] = React.useState(true);
  const [selectedPaths, setSelectedPaths] = React.useState<ReadonlySet<string>>(() => new Set());
  const [commitMessage, setCommitMessage] = React.useState("");

  const [isPublished, setIsPublished] = React.useState(false);
  const [prTitle, setPrTitle] = React.useState("");
  const [prBody, setPrBody] = React.useState("");
  const [pullRequest, setPullRequest] = React.useState<PullRequest | null>(null);

  const [logOpen, setLogOpen] = React.useState(false);

  const [recentRepos, setRecentRepos] = React.useState<RecentRepoList>([]);
  const [confirmClearRecentsOpen, setConfirmClearRecentsOpen] = React.useState(false);

  const currentBranch = repoInfo?.branch ?? "";
  const isOnMain = currentBranch.trim() === "main";
  const workflowStep = repoInfo ? computeWorkflowStep(repoInfo, pullRequest, isPublished) : null;

  async function refreshRecentRepos(): Promise<void> {
    const res = await recentReposStore.load();
    if (!res.ok) {
      console.warn("Failed to load recent repos:", res.error);
      return;
    }
    setRecentRepos(res.data);
  }

  React.useEffect(() => {
    void refreshRecentRepos();
  }, []);

  React.useEffect(() => {
    const b = repoInfo?.branch;
    if (!b) {
      setSwitchBranchName("");
      return;
    }
    setSwitchBranchName(b.trim());
  }, [repoInfo?.branch]);

  const selectedStageableFiles = React.useMemo(() => {
    if (!repoInfo) return [];
    return repoInfo.changes.filter((c) => selectedPaths.has(c.path) && c.stageable).map((c) => c.path);
  }, [repoInfo, selectedPaths]);

  function toggleSelected(path: string): void {
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  async function refreshLocalBranches(path: RepoPath): Promise<void> {
    const res = await repoService.listBranches(path);
    if (!res.ok) {
      setError(res.error);
      setLocalBranches([]);
      return;
    }
    setLocalBranches(res.data);
  }

  const lastBranchRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!repoInfo) return;
    const current = repoInfo.branch.trim();
    const prev = lastBranchRef.current;
    if (prev !== null && prev !== current) setIsPublished(false);
    lastBranchRef.current = current;

    if (!pullRequest) return;
    if ((pullRequest.state === "MERGED" || pullRequest.state === "CLOSED") && current === "main") return;
    if (pullRequest.headRefName.trim() !== current) setPullRequest(null);
  }, [repoInfo, pullRequest]);

  async function openRepoAtPath(rp: RepoPath): Promise<void> {
    setError(null);
    setLoading(true);
    setRepoInfo(null);
    setRepoPath(rp);
    setSelectedPaths(new Set());
    setCommitMessage("");
    setNewBranchName("");
    setLocalBranches([]);
    setSwitchBranchName("");
    setIsPublished(false);
    setPullRequest(null);
    setPrTitle("");
    setPrBody("");

    const res = await repoService.loadRepo(rp);
    if (!res.ok) {
      setError(res.error);
      setRepoInfo(null);
      setLoading(false);
      return;
    }

    setRepoInfo(res.data);
    await refreshLocalBranches(rp);
    setSelectedPaths(new Set());
    setLoading(false);

    void refreshRecentRepos();
  }

  React.useEffect(() => {
    if (!repoInfo || !autoSelectUntracked) return;
    const untracked = repoInfo.changes.filter((c) => c.kind === "untracked" && c.stageable).map((c) => c.path);
    if (untracked.length === 0) return;
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      for (const p of untracked) next.add(p);
      return next;
    });
  }, [repoInfo, autoSelectUntracked]);

  async function onPickFolder(): Promise<void> {
    setError(null);
    setLoading(true);
    setRepoInfo(null);
    setRepoPath(null);
    setSelectedPaths(new Set());
    setCommitMessage("");
    setNewBranchName("");
    setLocalBranches([]);
    setSwitchBranchName("");
    setIsPublished(false);
    setPullRequest(null);
    setPrTitle("");
    setPrBody("");

    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Open Repository"
      });
      const path = typeof selected === "string" ? selected : null;
      if (path === null) {
        setLoading(false);
        return;
      }

      const rp = toRepoPath(path);
      if (!rp.ok) {
        setError(rp.error);
        setLoading(false);
        return;
      }

      await openRepoAtPath(rp.data);
    } catch (_e: unknown) {
      setLoading(false);
      setError({ code: "TAURI_ERROR", message: "Failed to open folder picker." });
    }
  }

  async function onRemoveRecent(rp: RepoPath): Promise<void> {
    const res = await recentReposStore.remove(rp);
    if (!res.ok) {
      console.warn("Failed to remove recent repo:", res.error);
      return;
    }
    setRecentRepos(res.data);
  }

  function onConfirmClearRecents(): void {
    setConfirmClearRecentsOpen(false);
    void (async () => {
      const res = await recentReposStore.clear();
      if (!res.ok) {
        console.warn("Failed to clear recent repos:", res.error);
        return;
      }
      setRecentRepos(res.data);
    })();
  }

  async function onCreateAndSwitchBranch(): Promise<void> {
    if (!repoInfo) return;
    const parsed = parseBranchName(newBranchName);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setError(null);
    setLoading(true);
    const res = await repoService.createBranchFlow(repoInfo.path, parsed.data);
    if (!res.ok) {
      setError(res.error);
      setLoading(false);
      return;
    }
    setRepoInfo(res.data);
    setNewBranchName("");
    setSelectedPaths(new Set());
    setIsPublished(false);
    setPullRequest(null);
    await refreshLocalBranches(res.data.path);
    setLoading(false);
  }

  async function onSwitchBranch(): Promise<void> {
    if (!repoInfo) return;
    const target = switchBranchName.trim();
    if (target.length === 0) return;
    if (target === repoInfo.branch.trim()) return;

    setError(null);
    setLoading(true);
    const res = await repoService.switchToBranch(repoInfo.path, target);
    if (!res.ok) {
      setError(res.error);
      setLoading(false);
      return;
    }
    setRepoInfo(res.data);
    setSelectedPaths(new Set());
    setIsPublished(false);
    setPullRequest(null);
    await refreshLocalBranches(res.data.path);
    setLoading(false);
  }

  async function onTrackUntracked(): Promise<void> {
    if (!repoInfo) return;
    setError(null);
    setLoading(true);
    const res = await repoService.stageAllUntrackedFlow(repoInfo.path);
    if (!res.ok) {
      setError(res.error);
      setLoading(false);
      return;
    }
    setRepoInfo(res.data);
    setLoading(false);
  }

  async function onStageSelected(): Promise<void> {
    if (!repoInfo) return;
    setError(null);
    setLoading(true);
    const res = await repoService.stageFiles(repoInfo.path, selectedStageableFiles);
    if (!res.ok) {
      setError(res.error);
      setLoading(false);
      return;
    }
    setRepoInfo(res.data);
    setSelectedPaths(new Set());
    setLoading(false);
  }

  async function onStageAll(): Promise<void> {
    if (!repoInfo) return;
    setError(null);
    setLoading(true);
    const res = await repoService.stageAll(repoInfo.path);
    if (!res.ok) {
      setError(res.error);
      setLoading(false);
      return;
    }
    setRepoInfo(res.data);
    setSelectedPaths(new Set());
    setLoading(false);
  }

  async function onCommit(): Promise<void> {
    if (!repoInfo) return;
    const msg = parseCommitMessage(commitMessage);
    if (!msg.ok) {
      setError(msg.error);
      return;
    }
    setError(null);
    setLoading(true);
    const res = await repoService.commitFlow(repoInfo.path, msg.data);
    if (!res.ok) {
      setError(res.error);
      setLoading(false);
      return;
    }
    setRepoInfo(res.data);
    setCommitMessage("");
    setSelectedPaths(new Set());
    setLoading(false);
  }

  async function onPublishBranch(): Promise<void> {
    if (!repoInfo) return;
    setError(null);
    setLoading(true);
    const res = await repoService.publishFlow(repoInfo.path);
    if (!res.ok) {
      setError(res.error);
      setLoading(false);
      return;
    }
    setIsPublished(true);
    setLoading(false);
  }

  async function onEnsurePr(): Promise<void> {
    if (!repoInfo) return;
    setError(null);
    setLoading(true);
    const body = prBody.trim().length > 0 ? prBody : undefined;
    const res = await repoService.ensurePrFlow(repoInfo.path, prTitle, body);
    if (!res.ok) {
      setError(res.error);
      setLoading(false);
      return;
    }
    setPullRequest(res.data);
    setLoading(false);
  }

  async function onMergeAndSync(): Promise<void> {
    if (!repoInfo || !pullRequest) return;
    setError(null);
    setLoading(true);
    const res = await repoService.mergeAndSyncMainFlow(repoInfo.path, pullRequest.number);
    if (!res.ok) {
      setError(res.error);
      setLoading(false);
      return;
    }
    setRepoInfo(res.data);
    setPullRequest({ ...pullRequest, state: "MERGED" });
    setLoading(false);
  }

  const createBranchDisabled = !repoInfo || loading || !parseBranchName(newBranchName).ok;
  const switchBranchDisabled =
    !repoInfo || loading || switchBranchName.trim().length === 0 || switchBranchName.trim() === currentBranch.trim();
  const trackUntrackedDisabled = !repoInfo || loading || !repoInfo.hasUntracked;
  const stageSelectedDisabled = !repoInfo || loading || selectedStageableFiles.length === 0;
  const stageAllDisabled = !repoInfo || loading || repoInfo.stageableCount === 0;
  const commitDisabled = !repoInfo || loading || repoInfo.stagedCount === 0 || !parseCommitMessage(commitMessage).ok;
  const publishDisabled = !repoInfo || loading || isOnMain;
  const ensurePrDisabled = !repoInfo || loading || isOnMain || !isPublished;
  const mergeDisabled = !repoInfo || loading || isOnMain || !isPublished || !pullRequest || pullRequest.state !== "OPEN";

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="text-sm text-muted-foreground">Repo-Yopparai</div>
          <div className="text-2xl font-semibold tracking-tight">Repo Dashboard</div>
          {repoInfo ? (
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>
                Branch: <code className="rounded bg-muted px-1 py-0.5">{repoInfo.branch || "(unknown)"}</code>
              </span>
              <span>•</span>
              <span>Staged: {repoInfo.stagedCount}</span>
              <span>•</span>
              <span>Stageable: {repoInfo.stageableCount}</span>
              <span>•</span>
              <span>Untracked: {repoInfo.hasUntracked ? "yes" : "no"}</span>
              <span>•</span>
              <StatusBadge label={repoInfo.isClean ? "Clean" : "Dirty"} variant={repoInfo.isClean ? "clean" : "dirty"} />
              {workflowStep ? <Badge variant="secondary">{workflowStep}</Badge> : null}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">Open a repository to start the guided workflow.</div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {loading ? <div className="text-sm text-muted-foreground">Working…</div> : null}
          <Button onClick={() => void onPickFolder()} variant="outline">
            Open Repository
          </Button>
        </div>
      </div>

      {error ? <ErrorBlock error={error} /> : null}

      {repoPath ? (
        <div className="mt-4 text-sm text-muted-foreground">
          path: <code className="rounded bg-muted px-1 py-0.5">{repoPath}</code>
        </div>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
              <div className="space-y-1.5">
                <CardTitle>Recent Repositories</CardTitle>
                <CardDescription>Quickly reopen a recently used repo.</CardDescription>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setConfirmClearRecentsOpen(true)}
                disabled={recentRepos.length === 0 || loading}
              >
                Clear
              </Button>
            </CardHeader>
            <CardContent>
              {recentRepos.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  No recent repositories yet. Open one to get started.
                </div>
              ) : (
                <ScrollArea className="max-h-64 pr-2">
                  <div className="space-y-3">
                    {recentRepos.map((r) => (
                      <div key={r.path} className="rounded-md border p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate font-medium">{r.name}</div>
                            <div className="mt-1 truncate text-xs text-muted-foreground">
                              <code className="rounded bg-muted px-1 py-0.5">{r.path}</code>
                            </div>
                            <div className="mt-2 text-xs text-muted-foreground">
                              Last opened {formatRelativeTime(r.lastOpenedAt)}
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => void openRepoAtPath(r.path)}
                              disabled={loading}
                            >
                              Open
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => void onRemoveRecent(r.path)}
                              disabled={loading}
                            >
                              Remove
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Branch</CardTitle>
              <CardDescription>Create and switch to a feature branch before publishing or opening a PR.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Input
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  placeholder="feature/my-change"
                  disabled={!repoInfo || loading}
                />
                <Button onClick={() => void onCreateAndSwitchBranch()} disabled={createBranchDisabled}>
                  Create &amp; Switch
                </Button>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <select
                  value={switchBranchName}
                  onChange={(e) => setSwitchBranchName(e.target.value)}
                  disabled={!repoInfo || loading || localBranches.length === 0}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {localBranches.length === 0 ? (
                    <option value="">No branches</option>
                  ) : (
                    localBranches.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))
                  )}
                </select>
                <Button variant="secondary" onClick={() => void onSwitchBranch()} disabled={switchBranchDisabled}>
                  Switch
                </Button>
              </div>
              {repoInfo && isOnMain ? (
                <div className="text-sm text-muted-foreground">
                  You are on <code className="rounded bg-muted px-1 py-0.5">main</code>. Create a feature branch first.
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Track &amp; Stage</CardTitle>
              <CardDescription>Track all untracked files, then stage selected changes.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={autoSelectUntracked}
                    onChange={(e) => setAutoSelectUntracked(e.target.checked)}
                    disabled={!repoInfo || loading}
                  />
                  Auto-select all untracked
                </label>

                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="secondary" onClick={() => void onTrackUntracked()} disabled={trackUntrackedDisabled}>
                    Track untracked
                  </Button>
                  <Button variant="outline" onClick={() => void onStageSelected()} disabled={stageSelectedDisabled}>
                    Stage selected
                  </Button>
                  <Button variant="outline" onClick={() => void onStageAll()} disabled={stageAllDisabled}>
                    Stage all
                  </Button>
                </div>
              </div>

              {repoInfo ? (
                <div className="text-sm text-muted-foreground">
                  selected: <code className="rounded bg-muted px-1 py-0.5">{selectedPaths.size}</code> • selected stageable:{" "}
                  <code className="rounded bg-muted px-1 py-0.5">{selectedStageableFiles.length}</code>
                </div>
              ) : null}

              <Separator />

              {repoInfo ? (
                <FileChangeList
                  changes={repoInfo.changes}
                  selectedPaths={selectedPaths}
                  onToggleSelected={toggleSelected}
                />
              ) : (
                <div className="text-sm text-muted-foreground">No repo loaded.</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Commit</CardTitle>
              <CardDescription>Commit is enabled when staged changes exist.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Input
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                placeholder="Commit message"
                disabled={!repoInfo || loading}
              />
              <Button onClick={() => void onCommit()} disabled={commitDisabled}>
                Commit
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Publish &amp; PR</CardTitle>
              <CardDescription>Publish the branch, then create or view the PR for the current branch.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button onClick={() => void onPublishBranch()} disabled={publishDisabled}>
                  Publish branch
                </Button>
                <div className="text-sm text-muted-foreground">
                  published:{" "}
                  <code className="rounded bg-muted px-1 py-0.5">
                    {repoInfo && !isOnMain && isPublished ? "yes" : "no"}
                  </code>
                </div>
                {repoInfo && isOnMain ? (
                  <div className="text-sm text-muted-foreground">Create a feature branch first.</div>
                ) : null}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <div className="text-sm font-medium">PR title</div>
                  <Input
                    value={prTitle}
                    onChange={(e) => setPrTitle(e.target.value)}
                    placeholder="Short, descriptive title"
                    disabled={!repoInfo || loading || isOnMain}
                  />
                </div>
                <div className="space-y-2">
                  <div className="text-sm font-medium">PR body (optional)</div>
                  <Textarea
                    value={prBody}
                    onChange={(e) => setPrBody(e.target.value)}
                    placeholder="Describe what this PR does"
                    disabled={!repoInfo || loading || isOnMain}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Button variant="secondary" onClick={() => void onEnsurePr()} disabled={ensurePrDisabled}>
                  Create / View PR
                </Button>
                <div className="text-sm text-muted-foreground">
                  Enabled when branch is published and not{" "}
                  <code className="rounded bg-muted px-1 py-0.5">main</code>.
                </div>
              </div>

              {pullRequest ? (
                <div className="rounded-md border p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-semibold">
                      #{pullRequest.number} {pullRequest.title}
                    </div>
                    <StatusBadge
                      label={pullRequest.state}
                      variant={
                        pullRequest.state === "OPEN"
                          ? "clean"
                          : pullRequest.state === "MERGED"
                            ? "staged"
                            : "dirty"
                      }
                    />
                    {pullRequest.isDraft ? <StatusBadge label="DRAFT" variant="modified" /> : null}
                  </div>
                  <div className="mt-2 text-sm">
                    <a className="text-primary underline underline-offset-4" href={pullRequest.url} target="_blank" rel="noreferrer">
                      {pullRequest.url}
                    </a>
                  </div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    base: <code className="rounded bg-muted px-1 py-0.5">{pullRequest.baseRefName}</code> • head:{" "}
                    <code className="rounded bg-muted px-1 py-0.5">{pullRequest.headRefName}</code>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Merge &amp; Sync</CardTitle>
              <CardDescription>Squash merge the PR, delete the branch, switch to main, and pull latest.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button onClick={() => void onMergeAndSync()} disabled={mergeDisabled}>
                Merge PR + Sync main
              </Button>
              <div className="text-sm text-muted-foreground">
                Enabled when PR is open, branch is published, and branch is not{" "}
                <code className="rounded bg-muted px-1 py-0.5">main</code>.
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Command Log</CardTitle>
              <CardDescription>Recent command executions (read-only).</CardDescription>
            </CardHeader>
            <CardContent>
              <Collapsible open={logOpen} onOpenChange={setLogOpen}>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">Shows latest entries. Expand for stdout/stderr.</div>
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" size="sm">
                      {logOpen ? "Hide" : "Show"}
                    </Button>
                  </CollapsibleTrigger>
                </div>
                <CollapsibleContent className="mt-4">
                  <CommandLogPanel />
                </CollapsibleContent>
              </Collapsible>
            </CardContent>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={confirmClearRecentsOpen}
        title="Clear recent repositories?"
        message="This will remove all recent repositories from this device."
        confirmLabel="Clear"
        cancelLabel="Cancel"
        onConfirm={onConfirmClearRecents}
        onCancel={() => setConfirmClearRecentsOpen(false)}
      />
    </div>
  );
}
