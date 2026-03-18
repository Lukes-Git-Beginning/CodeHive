mod db;

use db::{Database, DbProject, DbTask, DbAgentRun, DbKnowledge, DbScheduledTask, DbTeamMember, DbTaskAssignment};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::process::Stdio;
use std::sync::Arc;
use tauri::{Emitter, Manager, State};
use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use tokio::sync::Mutex;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

/// Create a Command that hides the console window on Windows.
fn silent_cmd(program: &str) -> Command {
    let mut cmd = Command::new(program);
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    cmd
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentProcess {
    pub id: String,
    pub role: String,
    pub status: String,
    pub project_path: String,
}

pub struct AppState {
    pub running_agents: Arc<Mutex<HashMap<String, AgentProcess>>>,
    pub db: Database,
}

#[derive(Clone, Serialize)]
struct AgentOutputEvent {
    agent_id: String,
    line: String,
}

#[derive(Clone, Serialize)]
struct AgentStatusEvent {
    agent_id: String,
    status: String,
}

// ── Agent Commands ──

#[tauri::command]
async fn spawn_agent(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    agent_id: String,
    role: String,
    prompt: String,
    project_path: String,
    system_prompt: String,
    model: Option<String>,
    permission_mode: Option<String>,
    mcp_config_path: Option<String>,
) -> Result<String, String> {
    // Clean up path: trim whitespace, quotes, normalize
    let clean_path = project_path.trim().trim_matches('"').trim_matches('\'').to_string();
    log::info!("spawn_agent: clean_path = '{}'", clean_path);

    let agent = AgentProcess {
        id: agent_id.clone(),
        role: role.clone(),
        status: "running".to_string(),
        project_path: clean_path.clone(),
    };

    {
        let mut agents = state.running_agents.lock().await;
        agents.insert(agent_id.clone(), agent);
    }

    let _ = app.emit("agent-status", AgentStatusEvent {
        agent_id: agent_id.clone(),
        status: "running".to_string(),
    });

    // Validate project path
    let project_dir = std::path::Path::new(&clean_path);
    if !project_dir.exists() {
        return Err(format!("Path does not exist: '{}'", clean_path));
    }
    if !project_dir.is_dir() {
        return Err(format!("Path is not a directory: '{}'", clean_path));
    }

    let mut cmd = silent_cmd("claude");
    cmd.arg("-p")
        .arg(&prompt)
        .arg("--output-format")
        .arg("stream-json")
        .arg("--verbose");

    if !system_prompt.is_empty() {
        cmd.arg("--system-prompt").arg(&system_prompt);
    }

    if let Some(ref model_id) = model {
        cmd.arg("--model").arg(model_id);
    }

    // Permission mode for auto-accept
    if let Some(ref perm) = permission_mode {
        cmd.arg("--permission-mode").arg(perm);
    }

    // MCP server configuration
    if let Some(ref mcp_path) = mcp_config_path {
        if std::path::Path::new(mcp_path).exists() {
            cmd.arg("--mcp-config").arg(mcp_path);
        }
    }

    cmd.current_dir(&clean_path)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut child = cmd.spawn().map_err(|e| format!("Failed to spawn claude: {}", e))?;

    let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
    let stderr = child.stderr.take().ok_or("Failed to capture stderr")?;

    let app_stdout = app.clone();
    let aid_stdout = agent_id.clone();
    tokio::spawn(async move {
        let reader = BufReader::new(stdout);
        let mut lines = reader.lines();
        while let Ok(Some(line)) = lines.next_line().await {
            let _ = app_stdout.emit("agent-output", AgentOutputEvent {
                agent_id: aid_stdout.clone(),
                line,
            });
        }
    });

    let app_stderr = app.clone();
    let aid_stderr = agent_id.clone();
    tokio::spawn(async move {
        let reader = BufReader::new(stderr);
        let mut lines = reader.lines();
        while let Ok(Some(line)) = lines.next_line().await {
            let _ = app_stderr.emit("agent-output", AgentOutputEvent {
                agent_id: aid_stderr.clone(),
                line: format!("[stderr] {}", line),
            });
        }
    });

    let app_done = app.clone();
    let aid_done = agent_id.clone();
    let state_clone = state.running_agents.clone();
    tokio::spawn(async move {
        // 10 minute timeout for agent subprocess
        let status = tokio::time::timeout(
            std::time::Duration::from_secs(600),
            child.wait()
        ).await;

        let final_status = match status {
            Ok(Ok(s)) if s.success() => "done",
            Ok(Ok(_)) => "error",
            Ok(Err(_)) => "error",
            Err(_) => "error", // timeout
        };

        {
            let mut agents = state_clone.lock().await;
            if let Some(agent) = agents.get_mut(&aid_done) {
                agent.status = final_status.to_string();
            }
        }

        let _ = app_done.emit("agent-status", AgentStatusEvent {
            agent_id: aid_done,
            status: final_status.to_string(),
        });
    });

    Ok(agent_id)
}

#[tauri::command]
async fn get_agents(state: State<'_, AppState>) -> Result<Vec<AgentProcess>, String> {
    let agents = state.running_agents.lock().await;
    Ok(agents.values().cloned().collect())
}

#[tauri::command]
async fn check_claude_cli() -> Result<String, String> {
    let output = silent_cmd("claude")
        .arg("--version")
        .output()
        .await
        .map_err(|e| format!("Claude CLI not found: {}", e))?;

    String::from_utf8(output.stdout)
        .map_err(|e| format!("Invalid output: {}", e))
}

// ── File Explorer ──

#[derive(Debug, Clone, Serialize)]
struct FileEntry {
    name: String,
    path: String,
    is_dir: bool,
    size: u64,
    children: Vec<FileEntry>,
}

const IGNORED_DIRS: &[&str] = &[
    ".git", "node_modules", "__pycache__", "target", "dist", ".venv",
    "venv", ".next", ".nuxt", "build", ".svelte-kit", ".turbo",
    "coverage", ".cache", ".parcel-cache",
];

fn scan_directory(dir: &std::path::Path, depth: u32, max_depth: u32) -> Vec<FileEntry> {
    if depth >= max_depth {
        return vec![];
    }

    let mut entries = Vec::new();
    let Ok(read_dir) = std::fs::read_dir(dir) else { return entries };

    for entry in read_dir.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();

        // Skip hidden files (except specific ones) and ignored dirs
        if name.starts_with('.') && name != ".env" && name != ".gitignore" {
            continue;
        }

        let path = entry.path();
        let is_dir = path.is_dir();

        if is_dir && IGNORED_DIRS.contains(&name.as_str()) {
            continue;
        }

        let size = if is_dir { 0 } else {
            entry.metadata().map(|m| m.len()).unwrap_or(0)
        };

        let children = if is_dir {
            scan_directory(&path, depth + 1, max_depth)
        } else {
            vec![]
        };

        entries.push(FileEntry {
            name,
            path: path.to_string_lossy().to_string(),
            is_dir,
            size,
            children,
        });
    }

    // Sort: directories first, then alphabetically
    entries.sort_by(|a, b| {
        b.is_dir.cmp(&a.is_dir).then(a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });

    entries
}

#[tauri::command]
fn list_project_files(path: String, max_depth: Option<u32>) -> Result<Vec<FileEntry>, String> {
    let clean = path.trim().trim_matches('"').to_string();
    let dir = std::path::Path::new(&clean);
    if !dir.exists() || !dir.is_dir() {
        return Err(format!("Path does not exist: {}", path));
    }
    Ok(scan_directory(dir, 0, max_depth.unwrap_or(3)))
}

#[tauri::command]
async fn detect_tech_stack(path: String) -> Result<Vec<String>, String> {
    let path = std::path::Path::new(&path);
    if !path.exists() {
        return Err("Path does not exist".to_string());
    }

    let mut stack = Vec::new();

    let indicators = vec![
        ("package.json", "Node.js"),
        ("tsconfig.json", "TypeScript"),
        ("Cargo.toml", "Rust"),
        ("requirements.txt", "Python"),
        ("pyproject.toml", "Python"),
        ("go.mod", "Go"),
        ("pom.xml", "Java"),
        ("build.gradle", "Java/Kotlin"),
        ("Gemfile", "Ruby"),
        ("composer.json", "PHP"),
        ("Dockerfile", "Docker"),
        ("docker-compose.yml", "Docker"),
        ("next.config.js", "Next.js"),
        ("next.config.ts", "Next.js"),
        ("vite.config.ts", "Vite"),
        ("angular.json", "Angular"),
        ("svelte.config.js", "Svelte"),
        ("Makefile", "Make"),
    ];

    for (file, tech) in indicators {
        if path.join(file).exists() && !stack.contains(&tech.to_string()) {
            stack.push(tech.to_string());
        }
    }

    let pkg_path = path.join("package.json");
    if pkg_path.exists() {
        if let Ok(content) = std::fs::read_to_string(&pkg_path) {
            if content.contains("\"react\"") { stack.push("React".to_string()); }
            if content.contains("\"vue\"") { stack.push("Vue.js".to_string()); }
            if content.contains("\"express\"") { stack.push("Express".to_string()); }
        }
    }

    let req_path = path.join("requirements.txt");
    if req_path.exists() {
        if let Ok(content) = std::fs::read_to_string(&req_path) {
            let lower = content.to_lowercase();
            if lower.contains("flask") { stack.push("Flask".to_string()); }
            if lower.contains("django") { stack.push("Django".to_string()); }
            if lower.contains("fastapi") { stack.push("FastAPI".to_string()); }
        }
    }

    Ok(stack)
}

// ── Project CRUD ──

#[tauri::command]
fn db_list_projects(state: State<'_, AppState>) -> Result<Vec<DbProject>, String> {
    state.db.list_projects().map_err(|e| e.to_string())
}

#[tauri::command]
fn db_save_project(state: State<'_, AppState>, project: DbProject) -> Result<(), String> {
    state.db.save_project(&project).map_err(|e| e.to_string())
}

#[tauri::command]
fn db_delete_project(state: State<'_, AppState>, id: String) -> Result<(), String> {
    state.db.delete_project(&id).map_err(|e| e.to_string())
}

// ── Task CRUD ──

#[tauri::command]
fn db_list_tasks(state: State<'_, AppState>, project_id: String) -> Result<Vec<DbTask>, String> {
    state.db.list_tasks(&project_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn db_save_task(state: State<'_, AppState>, task: DbTask) -> Result<(), String> {
    state.db.save_task(&task).map_err(|e| e.to_string())
}

#[tauri::command]
fn db_delete_task(state: State<'_, AppState>, id: String) -> Result<(), String> {
    state.db.delete_task(&id).map_err(|e| e.to_string())
}

// ── Agent Run History ──

#[tauri::command]
fn db_save_agent_run(state: State<'_, AppState>, run: DbAgentRun) -> Result<(), String> {
    state.db.save_agent_run(&run).map_err(|e| e.to_string())
}

#[tauri::command]
fn db_list_agent_runs(state: State<'_, AppState>, project_id: String, limit: i32) -> Result<Vec<DbAgentRun>, String> {
    state.db.list_agent_runs(&project_id, limit).map_err(|e| e.to_string())
}

// ── Knowledge ──

#[tauri::command]
fn db_save_knowledge(state: State<'_, AppState>, entry: DbKnowledge) -> Result<(), String> {
    state.db.save_knowledge(&entry).map_err(|e| e.to_string())
}

#[tauri::command]
fn db_get_knowledge(state: State<'_, AppState>, project_id: String) -> Result<Vec<DbKnowledge>, String> {
    state.db.get_knowledge(&project_id).map_err(|e| e.to_string())
}

// ── File Utilities ──

#[tauri::command]
fn write_temp_file(path: String, content: String) -> Result<(), String> {
    let file_path = std::path::Path::new(&path);
    if let Some(parent) = file_path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("Failed to create dir: {}", e))?;
    }
    std::fs::write(file_path, content).map_err(|e| format!("Failed to write file: {}", e))
}

// ── Knowledge Search & Delete ──

#[tauri::command]
fn db_search_knowledge(state: State<'_, AppState>, project_id: String, query: String, limit: Option<i32>) -> Result<Vec<DbKnowledge>, String> {
    state.db.search_knowledge(&project_id, &query, limit.unwrap_or(5)).map_err(|e| e.to_string())
}

#[tauri::command]
fn db_delete_knowledge(state: State<'_, AppState>, id: String) -> Result<(), String> {
    state.db.delete_knowledge(&id).map_err(|e| e.to_string())
}

// ── CLAUDE.md Reader ──

#[tauri::command]
fn read_claude_md(path: String) -> Result<Option<String>, String> {
    let clean = path.trim().trim_matches('"').to_string();
    let claude_md = std::path::Path::new(&clean).join("CLAUDE.md");
    if claude_md.exists() {
        std::fs::read_to_string(&claude_md).map(Some).map_err(|e| e.to_string())
    } else {
        Ok(None)
    }
}

// ── Clipboard ──

#[tauri::command]
fn read_clipboard() -> Result<String, String> {
    use std::process::Command as StdCommand;
    #[cfg(target_os = "windows")]
    use std::os::windows::process::CommandExt;

    let mut cmd = StdCommand::new("powershell");
    cmd.args(["-NoProfile", "-Command", "Get-Clipboard"]);

    #[cfg(target_os = "windows")]
    cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

    let output = cmd.output().map_err(|e| format!("Clipboard read failed: {}", e))?;
    String::from_utf8(output.stdout).map_err(|e| format!("UTF8 error: {}", e))
}

// ── Screenshot Capture ──

#[tauri::command]
fn capture_screenshot(app: tauri::AppHandle) -> Result<String, String> {
    let screens = screenshots::Screen::all().map_err(|e| format!("Failed to list screens: {}", e))?;
    let screen = screens.first().ok_or("No screen found")?;
    let image = screen.capture().map_err(|e| format!("Capture failed: {}", e))?;

    // Save to temp file
    let data_dir = app.path().app_data_dir().map_err(|e| format!("No app dir: {}", e))?;
    let screenshot_path = data_dir.join("screenshot.png");
    image.save(&screenshot_path).map_err(|e| format!("Save failed: {}", e))?;

    Ok(screenshot_path.to_string_lossy().to_string())
}

#[tauri::command]
fn screenshot_to_base64(app: tauri::AppHandle) -> Result<String, String> {
    let data_dir = app.path().app_data_dir().map_err(|e| format!("No app dir: {}", e))?;
    let screenshot_path = data_dir.join("screenshot.png");
    let bytes = std::fs::read(&screenshot_path).map_err(|e| format!("Read failed: {}", e))?;
    use base64::Engine;
    Ok(base64::engine::general_purpose::STANDARD.encode(&bytes))
}

// ── Conversations ──

#[derive(Debug, Clone, Serialize, Deserialize)]
struct DbMessage {
    id: String,
    project_id: String,
    role: String,
    agent_role: Option<String>,
    content: String,
    timestamp: String,
}

#[tauri::command]
fn db_save_message(state: State<'_, AppState>, msg: DbMessage) -> Result<(), String> {
    state.db.save_message(&msg.id, &msg.project_id, &msg.role, msg.agent_role.as_deref(), &msg.content, &msg.timestamp)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn db_load_messages(state: State<'_, AppState>, project_id: String, limit: Option<i32>) -> Result<Vec<DbMessage>, String> {
    let rows = state.db.load_messages(&project_id, limit.unwrap_or(100)).map_err(|e| e.to_string())?;
    Ok(rows.into_iter().map(|(id, project_id, role, agent_role, content, timestamp)| {
        DbMessage { id, project_id, role, agent_role, content, timestamp }
    }).collect())
}

#[tauri::command]
fn db_clear_messages(state: State<'_, AppState>, project_id: String) -> Result<(), String> {
    state.db.clear_messages(&project_id).map_err(|e| e.to_string())
}

// ── Git Intelligence ──

#[derive(Debug, Clone, Serialize)]
struct GitFileChange {
    path: String,
    status: String,
}

#[derive(Debug, Clone, Serialize)]
struct GitStatusResult {
    is_git_repo: bool,
    branch: String,
    files: Vec<GitFileChange>,
    ahead: u32,
    behind: u32,
}

#[tauri::command]
async fn git_status(path: String) -> Result<GitStatusResult, String> {
    let git_dir = std::path::Path::new(&path).join(".git");
    if !git_dir.exists() {
        return Ok(GitStatusResult {
            is_git_repo: false,
            branch: String::new(),
            files: vec![],
            ahead: 0,
            behind: 0,
        });
    }

    let output = silent_cmd("git")
        .args(["-C", &path, "status", "--porcelain=v2", "--branch"])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .await
        .map_err(|e| format!("Git exec failed: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut branch = String::new();
    let mut ahead: u32 = 0;
    let mut behind: u32 = 0;
    let mut files: Vec<GitFileChange> = vec![];

    for raw_line in stdout.lines() {
        let line = raw_line.trim();
        if line.starts_with("# branch.head ") {
            branch = line.strip_prefix("# branch.head ").unwrap_or("").to_string();
        } else if line.starts_with("# branch.ab ") {
            // Format: # branch.ab +N -M
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 4 {
                ahead = parts[2].trim_start_matches('+').parse().unwrap_or(0);
                behind = parts[3].trim_start_matches('-').parse().unwrap_or(0);
            }
        } else if line.starts_with("1 ") || line.starts_with("2 ") {
            // Changed entries: "1 XY sub mH mI mW hH hI path" or "2 XY sub mH mI mW hH hI X\tscore path"
            let parts: Vec<&str> = line.splitn(9, ' ').collect();
            if parts.len() >= 9 {
                let xy = parts[1];
                let file_path = if line.starts_with("2 ") {
                    // Rename: last part contains "old\tnew" — take new
                    parts[8].split('\t').last().unwrap_or(parts[8])
                } else {
                    parts[8]
                };
                let status = if xy.starts_with('.') {
                    xy.chars().nth(1).unwrap_or('M').to_string()
                } else {
                    xy.chars().next().unwrap_or('M').to_string()
                };
                files.push(GitFileChange { path: file_path.to_string(), status });
            }
        } else if line.starts_with("? ") {
            // Untracked: "? path"
            let file_path = line.strip_prefix("? ").unwrap_or("");
            files.push(GitFileChange { path: file_path.to_string(), status: "??".to_string() });
        }
    }

    // Cap at 200 files
    files.truncate(200);

    Ok(GitStatusResult { is_git_repo: true, branch, files, ahead, behind })
}

#[derive(Debug, Clone, Serialize)]
struct GitCommit {
    hash: String,
    short_hash: String,
    author: String,
    date: String,
    message: String,
}

#[tauri::command]
async fn git_log(path: String, limit: Option<u32>) -> Result<Vec<GitCommit>, String> {
    let n = limit.unwrap_or(10).min(50).to_string();
    let output = silent_cmd("git")
        .args(["-C", &path, "log", &format!("--format=%H%n%h%n%an%n%aI%n%s"), "-n", &n])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .await
        .map_err(|e| format!("Git log failed: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let lines: Vec<&str> = stdout.lines().map(|l| l.trim()).filter(|l| !l.is_empty()).collect();
    let mut commits = vec![];

    for chunk in lines.chunks(5) {
        if chunk.len() == 5 {
            commits.push(GitCommit {
                hash: chunk[0].to_string(),
                short_hash: chunk[1].to_string(),
                author: chunk[2].to_string(),
                date: chunk[3].to_string(),
                message: chunk[4].to_string(),
            });
        }
    }

    Ok(commits)
}

#[tauri::command]
async fn git_diff(path: String, staged: Option<bool>) -> Result<String, String> {
    let mut args = vec!["-C", &path, "diff"];
    if staged.unwrap_or(false) {
        args.push("--cached");
    }

    let output = silent_cmd("git")
        .args(&args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .await
        .map_err(|e| format!("Git diff failed: {}", e))?;

    let mut diff = String::from_utf8_lossy(&output.stdout).to_string();
    // Cap at 50KB
    if diff.len() > 50_000 {
        diff.truncate(50_000);
        diff.push_str("\n... (truncated)");
    }

    Ok(diff)
}

// ── Git Write Operations ──

#[tauri::command]
async fn git_commit(path: String, message: String, files: Vec<String>) -> Result<String, String> {
    // Stage files
    if files.is_empty() {
        silent_cmd("git")
            .args(["-C", &path, "add", "-A"])
            .output()
            .await
            .map_err(|e| format!("Git add failed: {}", e))?;
    } else {
        let mut args = vec!["-C".to_string(), path.clone(), "add".to_string()];
        args.extend(files);
        silent_cmd("git")
            .args(&args)
            .output()
            .await
            .map_err(|e| format!("Git add failed: {}", e))?;
    }

    // Commit
    let output = silent_cmd("git")
        .args(["-C", &path, "commit", "-m", &message])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .await
        .map_err(|e| format!("Git commit failed: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Commit failed: {}", stderr.trim()));
    }

    // Get commit hash
    let hash_output = silent_cmd("git")
        .args(["-C", &path, "rev-parse", "--short", "HEAD"])
        .stdout(Stdio::piped())
        .output()
        .await
        .map_err(|e| format!("Git rev-parse failed: {}", e))?;

    Ok(String::from_utf8_lossy(&hash_output.stdout).trim().to_string())
}

#[tauri::command]
async fn git_push(path: String, remote: Option<String>, branch: Option<String>) -> Result<String, String> {
    let r = remote.unwrap_or_else(|| "origin".to_string());
    let b = branch.unwrap_or_else(|| "HEAD".to_string());

    let output = silent_cmd("git")
        .args(["-C", &path, "push", &r, &b])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .await
        .map_err(|e| format!("Git push failed: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Push failed: {}", stderr.trim()));
    }

    Ok(String::from_utf8_lossy(&output.stderr).trim().to_string())
}

#[tauri::command]
async fn git_pull(path: String, remote: Option<String>, branch: Option<String>) -> Result<String, String> {
    let r = remote.unwrap_or_else(|| "origin".to_string());
    let mut args = vec!["-C".to_string(), path, "pull".to_string(), r];
    if let Some(b) = branch {
        args.push(b);
    }

    let output = silent_cmd("git")
        .args(&args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .await
        .map_err(|e| format!("Git pull failed: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Pull failed: {}", stderr.trim()));
    }

    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

#[tauri::command]
async fn git_checkout(path: String, branch: String, create: Option<bool>) -> Result<String, String> {
    let mut args = vec!["-C", &path, "checkout"];
    if create.unwrap_or(false) {
        args.push("-b");
    }
    args.push(&branch);

    let output = silent_cmd("git")
        .args(&args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .await
        .map_err(|e| format!("Git checkout failed: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Checkout failed: {}", stderr.trim()));
    }

    Ok(format!("Switched to branch '{}'", branch))
}

// ── Settings ──

#[tauri::command]
fn db_get_setting(state: State<'_, AppState>, key: String) -> Result<Option<String>, String> {
    state.db.get_setting(&key).map_err(|e| e.to_string())
}

#[tauri::command]
fn db_set_setting(state: State<'_, AppState>, key: String, value: String) -> Result<(), String> {
    state.db.set_setting(&key, &value).map_err(|e| e.to_string())
}

// ── Scheduled Tasks ──

#[tauri::command]
fn db_list_scheduled(state: State<'_, AppState>, project_id: String) -> Result<Vec<DbScheduledTask>, String> {
    state.db.list_scheduled_tasks(&project_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn db_save_scheduled(state: State<'_, AppState>, task: DbScheduledTask) -> Result<(), String> {
    state.db.save_scheduled_task(&task).map_err(|e| e.to_string())
}

#[tauri::command]
fn db_delete_scheduled(state: State<'_, AppState>, id: String) -> Result<(), String> {
    state.db.delete_scheduled_task(&id).map_err(|e| e.to_string())
}

// ── Team ──

#[tauri::command]
fn db_list_members(state: State<'_, AppState>) -> Result<Vec<DbTeamMember>, String> {
    state.db.list_team_members().map_err(|e| e.to_string())
}

#[tauri::command]
fn db_save_member(state: State<'_, AppState>, member: DbTeamMember) -> Result<(), String> {
    state.db.save_team_member(&member).map_err(|e| e.to_string())
}

#[tauri::command]
fn db_delete_member(state: State<'_, AppState>, id: String) -> Result<(), String> {
    state.db.delete_team_member(&id).map_err(|e| e.to_string())
}

#[tauri::command]
fn db_list_assignments(state: State<'_, AppState>) -> Result<Vec<DbTaskAssignment>, String> {
    state.db.list_task_assignments().map_err(|e| e.to_string())
}

#[tauri::command]
fn db_save_assignment(state: State<'_, AppState>, assignment: DbTaskAssignment) -> Result<(), String> {
    state.db.save_task_assignment(&assignment).map_err(|e| e.to_string())
}

#[tauri::command]
fn db_delete_assignment(state: State<'_, AppState>, id: String) -> Result<(), String> {
    state.db.delete_task_assignment(&id).map_err(|e| e.to_string())
}

// ── Multi-PC Deployment ──

#[tauri::command]
async fn get_machine_id(state: State<'_, AppState>) -> Result<String, String> {
    // Check if we already have a machine ID
    if let Ok(Some(id)) = state.db.get_setting("machine_id") {
        return Ok(id);
    }
    // Generate new machine ID: hostname + UUID
    let hostname = hostname::get()
        .map(|h| h.to_string_lossy().to_string())
        .unwrap_or_else(|_| "unknown".to_string());
    let id = format!("{}-{}", hostname, uuid::Uuid::new_v4().to_string().split('-').next().unwrap_or("0000"));
    state.db.set_setting("machine_id", &id).map_err(|e| e.to_string())?;
    Ok(id)
}

#[tauri::command]
async fn export_project_bundle(app: tauri::AppHandle, state: State<'_, AppState>, project_id: String) -> Result<String, String> {
    let bundle_json = state.db.export_project_data(&project_id)?;

    // Save to file in app data dir
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let export_dir = app_data.join("exports");
    std::fs::create_dir_all(&export_dir).map_err(|e| e.to_string())?;

    let filename = format!("codehive-export-{}.json", chrono::Utc::now().format("%Y%m%d-%H%M%S"));
    let filepath = export_dir.join(&filename);
    std::fs::write(&filepath, &bundle_json).map_err(|e| e.to_string())?;

    Ok(filepath.to_string_lossy().to_string())
}

#[tauri::command]
async fn import_project_bundle(state: State<'_, AppState>, file_path: String) -> Result<String, String> {
    let content = std::fs::read_to_string(&file_path).map_err(|e| e.to_string())?;
    let bundle: serde_json::Value = serde_json::from_str(&content).map_err(|e| e.to_string())?;

    // Extract project data
    let project = bundle.get("project").ok_or("No project in bundle")?;
    let project_id = project.get("id").and_then(|v| v.as_str()).ok_or("No project id")?;
    let project_name = project.get("name").and_then(|v| v.as_str()).unwrap_or("Imported Project");

    // Check if project already exists
    let exists = state.db.get_project(project_id).is_ok();

    if !exists {
        let tech_stack = project.get("techStack").and_then(|v| v.as_str()).unwrap_or("[]");
        let description = project.get("description").and_then(|v| v.as_str()).unwrap_or("");
        let git_remote = project.get("gitRemote").and_then(|v| v.as_str()).unwrap_or("");
        let identifier = project.get("projectIdentifier").and_then(|v| v.as_str()).unwrap_or("");
        let now = chrono::Utc::now().to_rfc3339();

        let new_project = db::DbProject {
            id: project_id.to_string(),
            name: project_name.to_string(),
            path: String::new(),
            tech_stack: tech_stack.to_string(),
            description: description.to_string(),
            created_at: now.clone(),
            updated_at: now,
        };
        state.db.save_project(&new_project).map_err(|e| e.to_string())?;
        state.db.update_project_identifier(project_id, identifier, git_remote).map_err(|e| e.to_string())?;
    }

    // Import tasks
    if let Some(tasks) = bundle.get("tasks").and_then(|v| v.as_array()) {
        for task in tasks {
            let task_id = match task.get("id").and_then(|v| v.as_str()) {
                Some(id) => id,
                None => continue,
            };
            // Skip if task already exists
            if let Ok(Some(_)) = state.db.get_task(task_id) { continue; }
            let now = chrono::Utc::now().to_rfc3339();
            let new_task = db::DbTask {
                id: task_id.to_string(),
                project_id: task.get("projectId").and_then(|v| v.as_str()).unwrap_or(project_id).to_string(),
                title: task.get("title").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                description: task.get("description").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                status: task.get("status").and_then(|v| v.as_str()).unwrap_or("planned").to_string(),
                priority: task.get("priority").and_then(|v| v.as_i64()).unwrap_or(1) as i32,
                milestone: task.get("milestone").and_then(|v| v.as_str()).map(|s| s.to_string()),
                created_at: task.get("createdAt").and_then(|v| v.as_str()).unwrap_or(&now).to_string(),
                completed_at: None,
            };
            let _ = state.db.save_task(&new_task);
        }
    }

    // Import conversations
    if let Some(convos) = bundle.get("conversations").and_then(|v| v.as_array()) {
        for msg in convos {
            let msg_id = match msg.get("id").and_then(|v| v.as_str()) {
                Some(id) => id,
                None => continue,
            };
            let _ = state.db.save_message(
                msg_id,
                msg.get("projectId").and_then(|v| v.as_str()).unwrap_or(project_id),
                msg.get("role").and_then(|v| v.as_str()).unwrap_or("system"),
                None,
                msg.get("content").and_then(|v| v.as_str()).unwrap_or(""),
                msg.get("timestamp").and_then(|v| v.as_str()).unwrap_or(""),
            );
        }
    }

    Ok(project_id.to_string())
}

#[tauri::command]
async fn save_path_mapping(state: State<'_, AppState>, project_id: String, local_path: String) -> Result<(), String> {
    let machine_id = {
        if let Ok(Some(id)) = state.db.get_setting("machine_id") {
            id
        } else {
            let hostname = hostname::get()
                .map(|h| h.to_string_lossy().to_string())
                .unwrap_or_else(|_| "unknown".to_string());
            let id = format!("{}-{}", hostname, uuid::Uuid::new_v4().to_string().split('-').next().unwrap_or("0000"));
            state.db.set_setting("machine_id", &id).map_err(|e| e.to_string())?;
            id
        }
    };
    let id = uuid::Uuid::new_v4().to_string();
    state.db.save_path_mapping(&id, &project_id, &machine_id, &local_path).map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_path_for_machine(state: State<'_, AppState>, project_id: String) -> Result<Option<String>, String> {
    let machine_id = {
        if let Ok(Some(id)) = state.db.get_setting("machine_id") {
            id
        } else {
            return Ok(None);
        }
    };
    state.db.get_path_mapping(&project_id, &machine_id).map_err(|e| e.to_string())
}

#[tauri::command]
async fn update_project_identifier(state: State<'_, AppState>, project_id: String, identifier: String, git_remote: String) -> Result<(), String> {
    state.db.update_project_identifier(&project_id, &identifier, &git_remote).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // Initialize database in app data directory
            let app_data = app.path().app_data_dir()
                .map_err(|e| Box::new(e) as Box<dyn std::error::Error>)?;
            let db = Database::new(app_data)
                .map_err(|e| Box::new(e) as Box<dyn std::error::Error>)?;

            app.manage(AppState {
                running_agents: Arc::new(Mutex::new(HashMap::new())),
                db,
            });

            // System Tray
            let show_item = MenuItem::with_id(app, "show", "Metis öffnen", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Beenden", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

            let _tray = TrayIconBuilder::new()
                .tooltip("Metis — AI Assistant")
                .menu(&menu)
                .on_menu_event(|app, event| {
                    match event.id.as_ref() {
                        "show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                            }
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let tauri::tray::TrayIconEvent::Click { .. } = event {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                        }
                    }
                })
                .build(app)?;

            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Agent commands
            spawn_agent,
            get_agents,
            check_claude_cli,
            detect_tech_stack,
            list_project_files,
            // Project CRUD
            db_list_projects,
            db_save_project,
            db_delete_project,
            // Task CRUD
            db_list_tasks,
            db_save_task,
            db_delete_task,
            // Agent runs
            db_save_agent_run,
            db_list_agent_runs,
            // File utilities
            write_temp_file,
            // Knowledge
            db_save_knowledge,
            db_get_knowledge,
            db_search_knowledge,
            db_delete_knowledge,
            read_claude_md,
            // Clipboard
            read_clipboard,
            // Screenshot
            capture_screenshot,
            screenshot_to_base64,
            // Conversations
            db_save_message,
            db_load_messages,
            db_clear_messages,
            // Settings
            db_get_setting,
            db_set_setting,
            // Git Intelligence
            git_status,
            git_log,
            git_diff,
            git_commit,
            git_push,
            git_pull,
            git_checkout,
            // Scheduled Tasks
            db_list_scheduled,
            db_save_scheduled,
            db_delete_scheduled,
            // Team
            db_list_members,
            db_save_member,
            db_delete_member,
            db_list_assignments,
            db_save_assignment,
            db_delete_assignment,
            // Multi-PC Deployment
            get_machine_id,
            export_project_bundle,
            import_project_bundle,
            save_path_mapping,
            get_path_for_machine,
            update_project_identifier,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
