#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use dunce::canonicalize;
use serde::{Deserialize, Serialize};
use std::io::Read;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::time::Duration;
use tauri::Manager;
use wait_timeout::ChildExt;

#[derive(Debug, Deserialize)]
struct RunCommandRequest {
  cwd: String,
  program: String,
  args: Vec<String>,
  #[serde(rename = "timeoutMs")]
  timeout_ms: u64,
}

#[derive(Debug, Serialize)]
struct RunCommandResponse {
  #[serde(rename = "exitCode")]
  exit_code: i32,
  stdout: String,
  stderr: String,
}

fn normalize_cwd(cwd: &str) -> Result<PathBuf, String> {
  let trimmed = cwd.trim();
  if trimmed.is_empty() {
    return Err("cwd is empty".to_string());
  }
  let pb = PathBuf::from(trimmed);
  if !pb.exists() {
    return Err("cwd does not exist".to_string());
  }
  if !pb.is_dir() {
    return Err("cwd is not a directory".to_string());
  }
  canonicalize(&pb).map_err(|e| format!("failed to canonicalize cwd: {e}"))
}

#[tauri::command]
async fn run_command(request: RunCommandRequest) -> Result<RunCommandResponse, String> {
  if request.program.trim().is_empty() {
    return Err("program is empty".to_string());
  }
  let cwd = normalize_cwd(&request.cwd)?;

  let mut child = Command::new(&request.program)
    .args(&request.args)
    .current_dir(cwd)
    .stdout(Stdio::piped())
    .stderr(Stdio::piped())
    .spawn()
    .map_err(|e| format!("failed to spawn: {e}"))?;

  let mut stdout_pipe = child.stdout.take().ok_or_else(|| "stdout unavailable".to_string())?;
  let mut stderr_pipe = child.stderr.take().ok_or_else(|| "stderr unavailable".to_string())?;

  let stdout_handle = std::thread::spawn(move || {
    let mut buf: Vec<u8> = Vec::new();
    let _ = stdout_pipe.read_to_end(&mut buf);
    buf
  });
  let stderr_handle = std::thread::spawn(move || {
    let mut buf: Vec<u8> = Vec::new();
    let _ = stderr_pipe.read_to_end(&mut buf);
    buf
  });

  let timeout = Duration::from_millis(request.timeout_ms.max(1));
  let mut timed_out = false;

  let status = match child.wait_timeout(timeout).map_err(|e| format!("wait failed: {e}"))? {
    Some(s) => s,
    None => {
      timed_out = true;
      let _ = child.kill();
      child.wait().map_err(|e| format!("wait after kill failed: {e}"))?
    }
  };

  let stdout_bytes = stdout_handle.join().unwrap_or_default();
  let stderr_bytes = stderr_handle.join().unwrap_or_default();

  let stdout = String::from_utf8_lossy(&stdout_bytes).to_string();
  let stderr = if timed_out {
    let base = String::from_utf8_lossy(&stderr_bytes).to_string();
    if base.trim().is_empty() {
      "Timed out".to_string()
    } else {
      base
    }
  } else {
    String::from_utf8_lossy(&stderr_bytes).to_string()
  };

  let code = if timed_out { -1 } else { status.code().unwrap_or(-1) };

  Ok(RunCommandResponse {
    exit_code: code,
    stdout,
    stderr,
  })
}

fn recent_repos_file_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
  let dir = app
    .path()
    .app_data_dir()
    .map_err(|e| format!("failed to resolve app data dir: {e}"))?;
  Ok(dir.join("recent-repos.json"))
}

#[tauri::command]
async fn load_recent_repos_json(app: tauri::AppHandle) -> Result<Option<String>, String> {
  let path = recent_repos_file_path(&app)?;
  if !path.exists() {
    return Ok(None);
  }
  std::fs::read_to_string(&path)
    .map(Some)
    .map_err(|e| format!("failed to read recent repos: {e}"))
}

#[tauri::command]
async fn save_recent_repos_json(app: tauri::AppHandle, contents: String) -> Result<(), String> {
  let path = recent_repos_file_path(&app)?;
  if let Some(parent) = path.parent() {
    std::fs::create_dir_all(parent).map_err(|e| format!("failed to create app data dir: {e}"))?;
  }

  let mut tmp = path.clone();
  tmp.set_extension("json.tmp");

  std::fs::write(&tmp, contents).map_err(|e| format!("failed to write temp recent repos: {e}"))?;
  if path.exists() {
    std::fs::remove_file(&path).map_err(|e| format!("failed to remove old recent repos: {e}"))?;
  }
  std::fs::rename(&tmp, &path).map_err(|e| format!("failed to replace recent repos: {e}"))?;
  Ok(())
}

fn main() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_shell::init())
    .invoke_handler(tauri::generate_handler![
      run_command,
      load_recent_repos_json,
      save_recent_repos_json
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
