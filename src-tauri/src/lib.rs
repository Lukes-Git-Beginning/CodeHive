mod db;

use db::{Database, DbProject, DbTask, DbAgentRun, DbKnowledge};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::process::Stdio;
use std::sync::Arc;
use tauri::{Emitter, Manager, State};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use tokio::sync::Mutex;

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

    let mut cmd = Command::new("claude");
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
        let status = child.wait().await;
        let final_status = match status {
            Ok(s) if s.success() => "done",
            Ok(_) => "error",
            Err(_) => "error",
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
    let output = Command::new("claude")
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

// ── Settings ──

#[tauri::command]
fn db_get_setting(state: State<'_, AppState>, key: String) -> Result<Option<String>, String> {
    state.db.get_setting(&key).map_err(|e| e.to_string())
}

#[tauri::command]
fn db_set_setting(state: State<'_, AppState>, key: String, value: String) -> Result<(), String> {
    state.db.set_setting(&key, &value).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // Initialize database in app data directory
            let app_data = app.path().app_data_dir().expect("Failed to get app data dir");
            let db = Database::new(app_data).expect("Failed to initialize database");

            app.manage(AppState {
                running_agents: Arc::new(Mutex::new(HashMap::new())),
                db,
            });

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
            // Settings
            db_get_setting,
            db_set_setting,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
