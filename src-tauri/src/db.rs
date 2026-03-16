use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;

pub struct Database {
    conn: Mutex<Connection>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DbProject {
    pub id: String,
    pub name: String,
    pub path: String,
    pub tech_stack: String, // JSON array
    pub description: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DbTask {
    pub id: String,
    pub project_id: String,
    pub title: String,
    pub description: String,
    pub status: String,
    pub priority: i32,
    pub milestone: Option<String>,
    pub created_at: String,
    pub completed_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DbAgentRun {
    pub id: String,
    pub project_id: String,
    pub task_id: Option<String>,
    pub agent_type: String,
    pub prompt: String,
    pub status: String,
    pub output: String,
    pub files_changed: String, // JSON array
    pub started_at: String,
    pub finished_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DbKnowledge {
    pub id: String,
    pub project_id: String,
    pub key: String,
    pub value: String,
    pub source_agent: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DbSettings {
    pub key: String,
    pub value: String,
}

impl Database {
    pub fn new(app_data_dir: PathBuf) -> Result<Self> {
        std::fs::create_dir_all(&app_data_dir).ok();
        let db_path = app_data_dir.join("codehive.db");
        let conn = Connection::open(db_path)?;

        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;

        let db = Database {
            conn: Mutex::new(conn),
        };
        db.init_tables()?;
        Ok(db)
    }

    fn init_tables(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                path TEXT NOT NULL,
                tech_stack TEXT DEFAULT '[]',
                description TEXT DEFAULT '',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                title TEXT NOT NULL,
                description TEXT DEFAULT '',
                status TEXT DEFAULT 'planned',
                priority INTEGER DEFAULT 0,
                milestone TEXT,
                created_at TEXT NOT NULL,
                completed_at TEXT
            );

            CREATE TABLE IF NOT EXISTS agent_runs (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
                agent_type TEXT NOT NULL,
                prompt TEXT NOT NULL,
                status TEXT DEFAULT 'running',
                output TEXT DEFAULT '',
                files_changed TEXT DEFAULT '[]',
                started_at TEXT NOT NULL,
                finished_at TEXT
            );

            CREATE TABLE IF NOT EXISTS project_knowledge (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                key TEXT NOT NULL,
                value TEXT NOT NULL,
                source_agent TEXT DEFAULT '',
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
            CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
            CREATE INDEX IF NOT EXISTS idx_agent_runs_project ON agent_runs(project_id);
            CREATE INDEX IF NOT EXISTS idx_knowledge_project ON project_knowledge(project_id);
            ",
        )?;
        Ok(())
    }

    // ── Projects ──

    pub fn list_projects(&self) -> Result<Vec<DbProject>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, name, path, tech_stack, description, created_at, updated_at FROM projects ORDER BY updated_at DESC",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(DbProject {
                id: row.get(0)?,
                name: row.get(1)?,
                path: row.get(2)?,
                tech_stack: row.get(3)?,
                description: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        })?;
        rows.collect()
    }

    pub fn save_project(&self, project: &DbProject) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT OR REPLACE INTO projects (id, name, path, tech_stack, description, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                project.id,
                project.name,
                project.path,
                project.tech_stack,
                project.description,
                project.created_at,
                project.updated_at,
            ],
        )?;
        Ok(())
    }

    pub fn delete_project(&self, id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM projects WHERE id = ?1", params![id])?;
        Ok(())
    }

    // ── Tasks ──

    pub fn list_tasks(&self, project_id: &str) -> Result<Vec<DbTask>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, project_id, title, description, status, priority, milestone, created_at, completed_at
             FROM tasks WHERE project_id = ?1 ORDER BY priority DESC, created_at ASC",
        )?;
        let rows = stmt.query_map(params![project_id], |row| {
            Ok(DbTask {
                id: row.get(0)?,
                project_id: row.get(1)?,
                title: row.get(2)?,
                description: row.get(3)?,
                status: row.get(4)?,
                priority: row.get(5)?,
                milestone: row.get(6)?,
                created_at: row.get(7)?,
                completed_at: row.get(8)?,
            })
        })?;
        rows.collect()
    }

    pub fn save_task(&self, task: &DbTask) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT OR REPLACE INTO tasks (id, project_id, title, description, status, priority, milestone, created_at, completed_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                task.id,
                task.project_id,
                task.title,
                task.description,
                task.status,
                task.priority,
                task.milestone,
                task.created_at,
                task.completed_at,
            ],
        )?;
        Ok(())
    }

    pub fn delete_task(&self, id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM tasks WHERE id = ?1", params![id])?;
        Ok(())
    }

    // ── Agent Runs ──

    pub fn save_agent_run(&self, run: &DbAgentRun) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT OR REPLACE INTO agent_runs (id, project_id, task_id, agent_type, prompt, status, output, files_changed, started_at, finished_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![
                run.id,
                run.project_id,
                run.task_id,
                run.agent_type,
                run.prompt,
                run.status,
                run.output,
                run.files_changed,
                run.started_at,
                run.finished_at,
            ],
        )?;
        Ok(())
    }

    pub fn list_agent_runs(&self, project_id: &str, limit: i32) -> Result<Vec<DbAgentRun>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, project_id, task_id, agent_type, prompt, status, output, files_changed, started_at, finished_at
             FROM agent_runs WHERE project_id = ?1 ORDER BY started_at DESC LIMIT ?2",
        )?;
        let rows = stmt.query_map(params![project_id, limit], |row| {
            Ok(DbAgentRun {
                id: row.get(0)?,
                project_id: row.get(1)?,
                task_id: row.get(2)?,
                agent_type: row.get(3)?,
                prompt: row.get(4)?,
                status: row.get(5)?,
                output: row.get(6)?,
                files_changed: row.get(7)?,
                started_at: row.get(8)?,
                finished_at: row.get(9)?,
            })
        })?;
        rows.collect()
    }

    // ── Knowledge ──

    pub fn save_knowledge(&self, entry: &DbKnowledge) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT OR REPLACE INTO project_knowledge (id, project_id, key, value, source_agent, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                entry.id,
                entry.project_id,
                entry.key,
                entry.value,
                entry.source_agent,
                entry.created_at,
            ],
        )?;
        Ok(())
    }

    pub fn get_knowledge(&self, project_id: &str) -> Result<Vec<DbKnowledge>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, project_id, key, value, source_agent, created_at
             FROM project_knowledge WHERE project_id = ?1 ORDER BY created_at DESC",
        )?;
        let rows = stmt.query_map(params![project_id], |row| {
            Ok(DbKnowledge {
                id: row.get(0)?,
                project_id: row.get(1)?,
                key: row.get(2)?,
                value: row.get(3)?,
                source_agent: row.get(4)?,
                created_at: row.get(5)?,
            })
        })?;
        rows.collect()
    }

    // ── Settings ──

    pub fn get_setting(&self, key: &str) -> Result<Option<String>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT value FROM settings WHERE key = ?1")?;
        let mut rows = stmt.query(params![key])?;
        match rows.next()? {
            Some(row) => Ok(Some(row.get(0)?)),
            None => Ok(None),
        }
    }

    pub fn set_setting(&self, key: &str, value: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
            params![key, value],
        )?;
        Ok(())
    }
}
