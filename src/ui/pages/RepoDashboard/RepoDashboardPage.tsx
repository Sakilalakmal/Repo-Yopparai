import React from "react";
import { open } from "@tauri-apps/plugin-dialog";
import type { RepoInfo, RepoPath } from "../../../core/domain/repo";
import type { PullRequest } from "../../../core/domain/pr";
import type { AppError } from "../../../core/shell/command.errors";
import { githubService } from "../../../core/services/github.service";
import { repoService } from "../../../core/services/repo.service";
import { parseBaseBranchName, parseBranchName, parseCommitMessage, toRepoPath } from "../../../core/utils/guard";
import { CommandLogPanel } from "../../components/CommandLogPanel/CommandLogPanel";
import { FileChangeList } from "../../components/FileChangeList/FileChangeList";
import { StatusBadge } from "../../components/StatusBadge/StatusBadge";

function buttonStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid rgba(127,127,127,0.35)",
    background: "transparent",
    fontWeight: 700,
    opacity: disabled ? 0.5 : 1
  };
}

function ErrorBlock(props: { error: AppError }): React.JSX.Element {
  const detailsText = props.error.details ? JSON.stringify(props.error.details, null, 2) : null;
  return (
    <div style={{ marginTop: 10 }}>
      <StatusBadge label={props.error.code} variant="error" />
      <div style={{ marginTop: 8, fontWeight: 650 }}>{props.error.message}</div>
      {props.error.code === "GH_NOT_AUTHED" ? (
        <div style={{ marginTop: 6, opacity: 0.85 }}>
          Run: <code>gh auth login</code>
        </div>
      ) : null}
      {detailsText ? (
        <details style={{ marginTop: 10 }}>
          <summary style={{ cursor: "pointer", opacity: 0.85 }}>Details</summary>
          <pre
            style={{
              marginTop: 8,
              padding: 10,
              borderRadius: 8,
              border: "1px solid rgba(127,127,127,0.25)",
              background: "rgba(0,0,0,0.15)",
              overflow: "auto",
              maxHeight: 240
            }}
          >
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
  const [branchError, setBranchError] = React.useState<AppError | null>(null);
  const [prError, setPrError] = React.useState<AppError | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [selectedPaths, setSelectedPaths] = React.useState<ReadonlySet<string>>(() => new Set());
  const [commitMessage, setCommitMessage] = React.useState("");
  const [newBranchName, setNewBranchName] = React.useState("");
  const [branches, setBranches] = React.useState<readonly string[]>([]);
  const [switchBranch, setSwitchBranch] = React.useState<string>("");
  const [pushedBranch, setPushedBranch] = React.useState<string | null>(null);
  const [prTitle, setPrTitle] = React.useState("");
  const [prBody, setPrBody] = React.useState("");
  const [prBase, setPrBase] = React.useState("main");
  const [pullRequest, setPullRequest] = React.useState<PullRequest | null>(null);

  const stageableCount = repoInfo ? repoInfo.changes.filter((c) => c.canStage).length : 0;
  const stagedCount = repoInfo ? repoInfo.changes.filter((c) => c.isStaged).length : 0;
  const currentBranch = repoInfo?.branch ?? "";

  const selectedStageableFiles = React.useMemo(() => {
    if (!repoInfo) return [];
    const set = selectedPaths;
    return repoInfo.changes.filter((c) => set.has(c.path) && c.canStage).map((c) => c.path);
  }, [repoInfo, selectedPaths]);

  function toggleSelected(path: string): void {
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  React.useEffect(() => {
    if (!repoInfo) return;
    if (pushedBranch === null) return;
    if (repoInfo.branch !== pushedBranch) setPushedBranch(null);
  }, [repoInfo, pushedBranch]);

  async function refreshBranches(path: RepoPath, preferred?: string): Promise<void> {
    const res = await repoService.listBranches(path);
    if (!res.ok) {
      setBranchError(res.error);
      setBranches([]);
      setSwitchBranch("");
      return;
    }
    const list = res.data;
    setBranches(list);
    setSwitchBranch((prev) => {
      if (preferred && list.includes(preferred)) return preferred;
      if (prev.trim().length > 0) return prev;
      return list[0] ?? "";
    });
  }

  async function onPickFolder(): Promise<void> {
    setError(null);
    setBranchError(null);
    setPrError(null);
    setLoading(true);
    setRepoInfo(null);
    setSelectedPaths(new Set());
    setCommitMessage("");
    setNewBranchName("");
    setBranches([]);
    setSwitchBranch("");
    setPushedBranch(null);
    setPullRequest(null);
    setPrTitle("");
    setPrBody("");
    setPrBase("main");

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

      setRepoPath(rp.data);
      const res = await repoService.loadRepo(rp.data);
      if (!res.ok) {
        setError(res.error);
        setRepoInfo(null);
        setLoading(false);
        return;
      }

      setRepoInfo(res.data);
      setSelectedPaths(new Set());
      await refreshBranches(rp.data, res.data.branch);
      setLoading(false);
    } catch (_e: unknown) {
      setLoading(false);
      setError({ code: "TAURI_ERROR", message: "Failed to open folder picker." });
    }
  }

  async function onStageAll(): Promise<void> {
    if (!repoInfo) return;
    setError(null);
    setBranchError(null);
    setPrError(null);
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

  async function onStageSelected(): Promise<void> {
    if (!repoInfo) return;
    setError(null);
    setBranchError(null);
    setPrError(null);
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

  async function onCommit(): Promise<void> {
    if (!repoInfo) return;
    const msg = parseCommitMessage(commitMessage);
    if (!msg.ok) {
      setError(msg.error);
      return;
    }
    setError(null);
    setBranchError(null);
    setPrError(null);
    setLoading(true);
    const res = await repoService.commit(repoInfo.path, msg.data);
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

  async function onCreateAndSwitchBranch(): Promise<void> {
    if (!repoInfo) return;
    const parsed = parseBranchName(newBranchName);
    if (!parsed.ok) {
      setBranchError(parsed.error);
      return;
    }
    setBranchError(null);
    setPrError(null);
    setLoading(true);
    const res = await repoService.createAndSwitchBranch(repoInfo.path, parsed.data);
    if (!res.ok) {
      setBranchError(res.error);
      setLoading(false);
      return;
    }
    setRepoInfo(res.data);
    setNewBranchName("");
    await refreshBranches(repoInfo.path, res.data.branch);
    setLoading(false);
  }

  async function onSwitchBranch(): Promise<void> {
    if (!repoInfo) return;
    const b = switchBranch.trim();
    if (b.length === 0) return;
    setBranchError(null);
    setPrError(null);
    setLoading(true);
    const res = await repoService.switchToBranch(repoInfo.path, b);
    if (!res.ok) {
      setBranchError(res.error);
      setLoading(false);
      return;
    }
    setRepoInfo(res.data);
    await refreshBranches(repoInfo.path, res.data.branch);
    setLoading(false);
  }

  async function onPushBranch(): Promise<void> {
    if (!repoInfo) return;
    setPrError(null);
    setLoading(true);
    const res = await repoService.pushCurrentBranch(repoInfo.path);
    if (!res.ok) {
      setPrError(res.error);
      setLoading(false);
      return;
    }
    setPushedBranch(currentBranch);
    setLoading(false);
  }

  async function onCreatePr(): Promise<void> {
    if (!repoInfo) return;
    const title = prTitle.trim();
    if (title.length === 0) {
      setPrError({ code: "INVALID_INPUT", message: "Please enter a PR title." });
      return;
    }

    const baseRes = parseBaseBranchName(prBase);
    if (!baseRes.ok) {
      setPrError(baseRes.error);
      return;
    }

    const headRes = parseBranchName(currentBranch);
    if (!headRes.ok) {
      setPrError(headRes.error);
      return;
    }

    setPrError(null);
    setLoading(true);
    const body = prBody.trim().length > 0 ? prBody : undefined;
    const res = await githubService.createPr({
      repoPath: repoInfo.path,
      base: baseRes.data,
      head: headRes.data,
      title,
      ...(body ? { body } : {})
    });
    if (!res.ok) {
      setPrError(res.error);
      setLoading(false);
      return;
    }
    setPullRequest(res.data);
    setLoading(false);
  }

  async function onViewPr(): Promise<void> {
    if (!repoInfo) return;
    setPrError(null);
    setLoading(true);
    const res = await githubService.viewPrForCurrentBranch(repoInfo.path);
    if (!res.ok) {
      setPrError(res.error);
      setLoading(false);
      return;
    }
    setPullRequest(res.data);
    setLoading(false);
  }

  const pushDisabled =
    !repoInfo || loading || currentBranch.trim().length === 0 || currentBranch.trim() === "main";
  const createDisabled =
    !repoInfo ||
    loading ||
    currentBranch.trim().length === 0 ||
    currentBranch.trim() === "main" ||
    pushedBranch !== currentBranch ||
    prTitle.trim().length === 0;
  const viewDisabled = !repoInfo || loading;

  const createBranchDisabled = !repoInfo || loading || !parseBranchName(newBranchName).ok;
  const switchBranchDisabled = !repoInfo || loading || switchBranch.trim().length === 0;

  return (
    <div style={{ padding: 18, maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>Repo Dashboard</div>
          <div style={{ opacity: 0.75, marginTop: 2 }}>Week 1: open • verify • status • log</div>
        </div>
        <button
          onClick={() => void onPickFolder()}
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid rgba(127,127,127,0.35)",
            background: "transparent",
            fontWeight: 700
          }}
        >
          Open Repository
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 420px", gap: 14, marginTop: 16 }}>
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ border: "1px solid rgba(127,127,127,0.3)", borderRadius: 10, padding: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontWeight: 700 }}>Repository</div>
              {loading ? <div style={{ opacity: 0.7 }}>Loading…</div> : null}
            </div>

            {error ? <ErrorBlock error={error} /> : null}

            {repoPath ? (
              <div style={{ marginTop: 10, opacity: 0.8, fontSize: 12 }}>
                path: <code>{repoPath}</code>
              </div>
            ) : (
              <div style={{ marginTop: 10, opacity: 0.75 }}>
                Select a folder to verify it is a Git repository.
              </div>
            )}

            {repoInfo ? (
              <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center" }}>
                <div style={{ fontWeight: 700 }}>
                  Branch: <code>{repoInfo.branch || "(detached/unknown)"}</code>
                </div>
                {repoInfo.isClean ? (
                  <StatusBadge label="Clean" variant="clean" />
                ) : (
                  <StatusBadge label="Dirty" variant="dirty" />
                )}
                <div style={{ opacity: 0.75, fontSize: 12 }}>
                  staged: <code>{stagedCount}</code> • stageable: <code>{stageableCount}</code>
                </div>
              </div>
            ) : null}
          </div>

          <div style={{ border: "1px solid rgba(127,127,127,0.3)", borderRadius: 10, padding: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontWeight: 700 }}>File changes</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => void onStageSelected()}
                  disabled={!repoInfo || selectedStageableFiles.length === 0 || loading}
                  style={buttonStyle(!repoInfo || selectedStageableFiles.length === 0 || loading)}
                >
                  Stage selected
                </button>
                <button
                  onClick={() => void onStageAll()}
                  disabled={!repoInfo || stageableCount === 0 || loading}
                  style={buttonStyle(!repoInfo || stageableCount === 0 || loading)}
                >
                  Stage all
                </button>
              </div>
            </div>
            {repoInfo ? (
              <div style={{ opacity: 0.75, fontSize: 12, marginTop: 6 }}>
                selected: <code>{selectedPaths.size}</code> • selected stageable:{" "}
                <code>{selectedStageableFiles.length}</code>
              </div>
            ) : null}
            {repoInfo ? (
              <div style={{ marginTop: 10 }}>
                <FileChangeList
                  changes={repoInfo.changes}
                  selectedPaths={selectedPaths}
                  onToggleSelected={toggleSelected}
                />
              </div>
            ) : (
              <div style={{ opacity: 0.75, marginTop: 10 }}>No repo loaded.</div>
            )}
          </div>

          <div style={{ border: "1px solid rgba(127,127,127,0.3)", borderRadius: 10, padding: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontWeight: 700 }}>Branch</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => void onCreateAndSwitchBranch()}
                  disabled={createBranchDisabled}
                  style={buttonStyle(createBranchDisabled)}
                >
                  Create &amp; Switch
                </button>
                <button
                  onClick={() => void onSwitchBranch()}
                  disabled={switchBranchDisabled}
                  style={buttonStyle(switchBranchDisabled)}
                >
                  Switch
                </button>
              </div>
            </div>

            {branchError ? <ErrorBlock error={branchError} /> : null}

            <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 240px", gap: 10 }}>
              <div>
                <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>New branch name</div>
                <input
                  type="text"
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  placeholder="feature/my-change"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid rgba(127,127,127,0.35)",
                    background: "transparent"
                  }}
                  disabled={!repoInfo || loading}
                />
              </div>

              <div>
                <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>Switch branch</div>
                <select
                  value={switchBranch}
                  onChange={(e) => setSwitchBranch(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid rgba(127,127,127,0.35)",
                    background: "transparent"
                  }}
                  disabled={!repoInfo || loading || branches.length === 0}
                >
                  {branches.length === 0 ? <option value="">(no branches)</option> : null}
                  {branches.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div style={{ border: "1px solid rgba(127,127,127,0.3)", borderRadius: 10, padding: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontWeight: 700 }}>Pull Request</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => void onPushBranch()}
                  disabled={pushDisabled}
                  style={buttonStyle(pushDisabled)}
                  title={currentBranch.trim() === "main" ? "Push from a feature branch (not main)." : undefined}
                >
                  Push branch
                </button>
                <button
                  onClick={() => void onCreatePr()}
                  disabled={createDisabled}
                  style={buttonStyle(createDisabled)}
                  title={pushedBranch !== currentBranch ? "Push branch before creating PR." : undefined}
                >
                  Create PR
                </button>
                <button onClick={() => void onViewPr()} disabled={viewDisabled} style={buttonStyle(viewDisabled)}>
                  View PR
                </button>
              </div>
            </div>

            {prError ? <ErrorBlock error={prError} /> : null}

            {currentBranch.trim() === "main" ? (
              <div style={{ marginTop: 8, opacity: 0.75, fontSize: 12 }}>
                Create a feature branch to open a PR.
              </div>
            ) : null}

            <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 180px", gap: 10 }}>
              <div style={{ display: "grid", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>PR Title (required)</div>
                  <input
                    type="text"
                    value={prTitle}
                    onChange={(e) => setPrTitle(e.target.value)}
                    placeholder="Add a descriptive title"
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: "1px solid rgba(127,127,127,0.35)",
                      background: "transparent"
                    }}
                    disabled={!repoInfo || loading}
                  />
                </div>

                <div>
                  <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>PR Body (optional)</div>
                  <textarea
                    value={prBody}
                    onChange={(e) => setPrBody(e.target.value)}
                    placeholder="Describe what this PR does"
                    style={{
                      width: "100%",
                      minHeight: 90,
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: "1px solid rgba(127,127,127,0.35)",
                      background: "transparent",
                      resize: "vertical"
                    }}
                    disabled={!repoInfo || loading}
                  />
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>Base branch</div>
                <select
                  value={prBase}
                  onChange={(e) => setPrBase(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid rgba(127,127,127,0.35)",
                    background: "transparent"
                  }}
                  disabled={!repoInfo || loading}
                >
                  <option value="main">main</option>
                </select>

                <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
                  head: <code>{currentBranch.trim() || "(detached/unknown)"}</code>
                </div>

                <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
                  pushed:{" "}
                  <code>{pushedBranch === currentBranch && currentBranch.trim().length > 0 ? "yes" : "no"}</code>
                </div>
              </div>
            </div>

            {pullRequest ? (
              <div
                style={{
                  marginTop: 12,
                  border: "1px solid rgba(127,127,127,0.22)",
                  borderRadius: 10,
                  padding: 12
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ fontWeight: 800 }}>
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
                <div style={{ marginTop: 8, fontSize: 12, opacity: 0.85 }}>
                  <a href={pullRequest.url} target="_blank" rel="noreferrer">
                    {pullRequest.url}
                  </a>
                </div>
                <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
                  base: <code>{pullRequest.baseRefName}</code> • head: <code>{pullRequest.headRefName}</code>
                </div>
              </div>
            ) : null}
          </div>

          <div style={{ border: "1px solid rgba(127,127,127,0.3)", borderRadius: 10, padding: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>Commit</div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <input
                type="text"
                value={commitMessage}
                placeholder="Commit message"
                onChange={(e) => setCommitMessage(e.target.value)}
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid rgba(127,127,127,0.35)",
                  background: "transparent"
                }}
                disabled={!repoInfo || loading}
              />
              <button
                onClick={() => void onCommit()}
                disabled={!repoInfo || loading || stagedCount === 0 || !parseCommitMessage(commitMessage).ok}
                style={buttonStyle(
                  !repoInfo || loading || stagedCount === 0 || !parseCommitMessage(commitMessage).ok
                )}
              >
                Commit
              </button>
            </div>
            {repoInfo ? (
              <div style={{ opacity: 0.75, fontSize: 12, marginTop: 8 }}>
                Commit enabled when message is non-empty and staged &gt; 0.
              </div>
            ) : null}
          </div>
        </div>

        <CommandLogPanel />
      </div>
    </div>
  );
}
