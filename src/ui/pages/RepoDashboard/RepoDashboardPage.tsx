import React from "react";
import { open } from "@tauri-apps/plugin-dialog";
import type { RepoInfo, RepoPath } from "../../../core/domain/repo";
import type { AppError } from "../../../core/shell/command.errors";
import { repoService } from "../../../core/services/repo.service";
import { parseCommitMessage, toRepoPath } from "../../../core/utils/guard";
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

export function RepoDashboardPage(): React.JSX.Element {
  const [repoPath, setRepoPath] = React.useState<RepoPath | null>(null);
  const [repoInfo, setRepoInfo] = React.useState<RepoInfo | null>(null);
  const [error, setError] = React.useState<AppError | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [selectedPaths, setSelectedPaths] = React.useState<ReadonlySet<string>>(() => new Set());
  const [commitMessage, setCommitMessage] = React.useState("");

  const stageableCount = repoInfo ? repoInfo.changes.filter((c) => c.canStage).length : 0;
  const stagedCount = repoInfo ? repoInfo.changes.filter((c) => c.isStaged).length : 0;

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

  async function onPickFolder(): Promise<void> {
    setError(null);
    setLoading(true);
    setRepoInfo(null);
    setSelectedPaths(new Set());
    setCommitMessage("");

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
      setLoading(false);
    } catch (_e: unknown) {
      setLoading(false);
      setError({ code: "TAURI_ERROR", message: "Failed to open folder picker." });
    }
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

  async function onCommit(): Promise<void> {
    if (!repoInfo) return;
    const msg = parseCommitMessage(commitMessage);
    if (!msg.ok) {
      setError(msg.error);
      return;
    }
    setError(null);
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

            {error ? (
              <div style={{ marginTop: 10 }}>
                <StatusBadge label={error.code} variant="error" />
                <div style={{ marginTop: 8, fontWeight: 650 }}>{error.message}</div>
              </div>
            ) : null}

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
