#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use dunce::canonicalize;
use serde::{Deserialize, Serialize};
use std::io::Read;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::time::Duration;
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

fn main() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .invoke_handler(tauri::generate_handler![run_command])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
