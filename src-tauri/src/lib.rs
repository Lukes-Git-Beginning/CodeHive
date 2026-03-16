use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::process::Stdio;
use std::sync::Arc;
use tauri::{Emitter, State};
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

#[derive(Default)]
pub struct AppState {
    pub running_agents: Arc<Mutex<HashMap<String, AgentProcess>>>,
}

/// Event payload sent to frontend when agent produces output
#[derive(Clone, Serialize)]
struct AgentOutputEvent {
    agent_id: String,
    line: String,
}

/// Event payload sent when agent status changes
#[derive(Clone, Serialize)]
struct AgentStatusEvent {
    agent_id: String,
    status: String,
}

/// Spawn a Claude agent via CLI headless mode
#[tauri::command]
async fn spawn_agent(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    agent_id: String,
    role: String,
    prompt: String,
    project_path: String,
    system_prompt: String,
) -> Result<String, String> {
    let agent = AgentProcess {
        id: agent_id.clone(),
        role: role.clone(),
        status: "running".to_string(),
        project_path: project_path.clone(),
    };

    // Register agent
    {
        let mut agents = state.running_agents.lock().await;
        agents.insert(agent_id.clone(), agent);
    }

    // Emit status
    let _ = app.emit("agent-status", AgentStatusEvent {
        agent_id: agent_id.clone(),
        status: "running".to_string(),
    });

    // Build claude CLI command
    let mut cmd = Command::new("claude");
    cmd.arg("-p")
        .arg(&prompt)
        .arg("--output-format")
        .arg("stream-json")
        .arg("--verbose");

    if !system_prompt.is_empty() {
        cmd.arg("--system-prompt").arg(&system_prompt);
    }

    cmd.current_dir(&project_path)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut child = cmd.spawn().map_err(|e| format!("Failed to spawn claude: {}", e))?;

    let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
    let stderr = child.stderr.take().ok_or("Failed to capture stderr")?;

    // Stream stdout to frontend
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

    // Stream stderr
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

    // Wait for completion in background
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

        // Update agent status
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

/// Get list of running agents
#[tauri::command]
async fn get_agents(state: State<'_, AppState>) -> Result<Vec<AgentProcess>, String> {
    let agents = state.running_agents.lock().await;
    Ok(agents.values().cloned().collect())
}

/// Check if claude CLI is available
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

/// Read directory to detect project tech stack
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
        (".csproj", "C#/.NET"),
        ("Dockerfile", "Docker"),
        ("docker-compose.yml", "Docker"),
        ("tailwind.config.js", "Tailwind CSS"),
        ("tailwind.config.ts", "Tailwind CSS"),
        ("next.config.js", "Next.js"),
        ("next.config.ts", "Next.js"),
        ("vite.config.ts", "Vite"),
        ("angular.json", "Angular"),
        ("vue.config.js", "Vue.js"),
        ("svelte.config.js", "Svelte"),
        ("flask", "Flask"),
        ("django", "Django"),
        ("Makefile", "Make"),
    ];

    for (file, tech) in indicators {
        if path.join(file).exists() && !stack.contains(&tech.to_string()) {
            stack.push(tech.to_string());
        }
    }

    // Check for specific content in package.json
    let pkg_path = path.join("package.json");
    if pkg_path.exists() {
        if let Ok(content) = std::fs::read_to_string(&pkg_path) {
            if content.contains("\"react\"") {
                stack.push("React".to_string());
            }
            if content.contains("\"vue\"") {
                stack.push("Vue.js".to_string());
            }
            if content.contains("\"express\"") {
                stack.push("Express".to_string());
            }
        }
    }

    // Check for Flask in requirements.txt
    let req_path = path.join("requirements.txt");
    if req_path.exists() {
        if let Ok(content) = std::fs::read_to_string(&req_path) {
            if content.to_lowercase().contains("flask") {
                stack.push("Flask".to_string());
            }
            if content.to_lowercase().contains("django") {
                stack.push("Django".to_string());
            }
            if content.to_lowercase().contains("fastapi") {
                stack.push("FastAPI".to_string());
            }
        }
    }

    Ok(stack)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            spawn_agent,
            get_agents,
            check_claude_cli,
            detect_tech_stack,
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
