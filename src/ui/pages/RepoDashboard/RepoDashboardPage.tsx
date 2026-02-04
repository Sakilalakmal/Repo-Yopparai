import React from "react";
import { open } from "@tauri-apps/plugin-dialog";
import type { RepoInfo, RepoPath } from "../../../core/domain/repo";
import type { AppError } from "../../../core/shell/command.errors";
import { repoService } from "../../../core/services/repo.service";
import { toRepoPath } from "../../../core/utils/guard";
import { CommandLogPanel } from "../../components/CommandLogPanel/CommandLogPanel";
import { FileChangeList } from "../../components/FileChangeList/FileChangeList";
import { StatusBadge } from "../../components/StatusBadge/StatusBadge";

export function RepoDashboardPage(): React.JSX.Element {
  const [repoPath, setRepoPath] = React.useState<RepoPath | null>(null);
  const [repoInfo, setRepoInfo] = React.useState<RepoInfo | null>(null);
  const [error, setError] = React.useState<AppError | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function onPickFolder(): Promise<void> {
    setError(null);
    setLoading(true);
    setRepoInfo(null);

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
      setLoading(false);
    } catch (_e: unknown) {
      setLoading(false);
      setError({ code: "TAURI_ERROR", message: "Failed to open folder picker." });
    }
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
              </div>
            ) : null}
          </div>

          <div style={{ border: "1px solid rgba(127,127,127,0.3)", borderRadius: 10, padding: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>File changes</div>
            {repoInfo ? (
              <FileChangeList changes={repoInfo.changes} />
            ) : (
              <div style={{ opacity: 0.75 }}>No repo loaded.</div>
            )}
          </div>
        </div>

        <CommandLogPanel />
      </div>
    </div>
  );
}
