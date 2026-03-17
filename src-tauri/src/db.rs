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

// Helper to safely acquire the mutex lock without panicking
fn lock_conn(conn: &Mutex<Connection>) -> Result<std::sync::MutexGuard<'_, Connection>> {
    conn.lock().map_err(|e| {
        rusqlite::Error::SqliteFailure(
            rusqlite::ffi::Error::new(1),
            Some(format!("Lock poisoned: {}", e)),
        )
    })
}

// ── Migration System ──

struct Migration {
    version: u32,
    description: &'static str,
    sql: &'static str,
}

const MIGRATIONS: &[Migration] = &[
    Migration {
        version: 1,
        description: "Initial schema",
        sql: "
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
    },
    Migration {
        version: 2,
        description: "Add compound index for tasks and knowledge FTS",
        sql: "
            CREATE INDEX IF NOT EXISTS idx_tasks_project_status ON tasks(project_id, status);
            CREATE INDEX IF NOT EXISTS idx_knowledge_key ON project_knowledge(project_id, key);
        ",
    },
    Migration {
        version: 3,
        description: "Add FTS5 full-text search for knowledge base",
        sql: "
            CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_fts USING fts5(
                key,
                value,
                source_agent,
                content=project_knowledge,
                content_rowid=rowid
            );

            CREATE TRIGGER IF NOT EXISTS knowledge_ai AFTER INSERT ON project_knowledge BEGIN
                INSERT INTO knowledge_fts(rowid, key, value, source_agent)
                VALUES (new.rowid, new.key, new.value, new.source_agent);
            END;

            CREATE TRIGGER IF NOT EXISTS knowledge_ad AFTER DELETE ON project_knowledge BEGIN
                INSERT INTO knowledge_fts(knowledge_fts, rowid, key, value, source_agent)
                VALUES ('delete', old.rowid, old.key, old.value, old.source_agent);
            END;

            CREATE TRIGGER IF NOT EXISTS knowledge_au AFTER UPDATE ON project_knowledge BEGIN
                INSERT INTO knowledge_fts(knowledge_fts, rowid, key, value, source_agent)
                VALUES ('delete', old.rowid, old.key, old.value, old.source_agent);
                INSERT INTO knowledge_fts(rowid, key, value, source_agent)
                VALUES (new.rowid, new.key, new.value, new.source_agent);
            END;
        ",
    },
];

impl Database {
    pub fn new(app_data_dir: PathBuf) -> Result<Self> {
        std::fs::create_dir_all(&app_data_dir).ok();
        let db_path = app_data_dir.join("codehive.db");
        let conn = Connection::open(db_path)?;

        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;

        let db = Database {
            conn: Mutex::new(conn),
        };
        db.run_migrations()?;
        Ok(db)
    }

    fn run_migrations(&self) -> Result<()> {
        let conn = lock_conn(&self.conn)?;

        // Create schema_version table if it doesn't exist
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS schema_version (
                version INTEGER PRIMARY KEY,
                description TEXT NOT NULL,
                applied_at TEXT NOT NULL
            );",
        )?;

        // Get current version
        let current_version: u32 = conn
            .query_row(
                "SELECT COALESCE(MAX(version), 0) FROM schema_version",
                [],
                |row| row.get(0),
            )
            .unwrap_or(0);

        // Run pending migrations
        for migration in MIGRATIONS {
            if migration.version > current_version {
                log::info!(
                    "Running migration v{}: {}",
                    migration.version,
                    migration.description
                );
                conn.execute_batch(migration.sql)?;
                conn.execute(
                    "INSERT INTO schema_version (version, description, applied_at) VALUES (?1, ?2, ?3)",
                    params![
                        migration.version,
                        migration.description,
                        chrono::Utc::now().to_rfc3339(),
                    ],
                )?;
            }
        }

        Ok(())
    }

    // ── Projects ──

    pub fn list_projects(&self) -> Result<Vec<DbProject>> {
        let conn = lock_conn(&self.conn)?;
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
        let conn = lock_conn(&self.conn)?;
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
        let conn = lock_conn(&self.conn)?;
        conn.execute("DELETE FROM projects WHERE id = ?1", params![id])?;
        Ok(())
    }

    // ── Tasks ──

    pub fn list_tasks(&self, project_id: &str) -> Result<Vec<DbTask>> {
        let conn = lock_conn(&self.conn)?;
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
        let conn = lock_conn(&self.conn)?;
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
        let conn = lock_conn(&self.conn)?;
        conn.execute("DELETE FROM tasks WHERE id = ?1", params![id])?;
        Ok(())
    }

    // ── Agent Runs ──

    pub fn save_agent_run(&self, run: &DbAgentRun) -> Result<()> {
        let conn = lock_conn(&self.conn)?;
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
        let conn = lock_conn(&self.conn)?;
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
        let conn = lock_conn(&self.conn)?;
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
        let conn = lock_conn(&self.conn)?;
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

    pub fn search_knowledge(&self, project_id: &str, query: &str, limit: i32) -> Result<Vec<DbKnowledge>> {
        let conn = lock_conn(&self.conn)?;
        // Use FTS5 MATCH for full-text search, joined back to main table for project filtering
        let mut stmt = conn.prepare(
            "SELECT pk.id, pk.project_id, pk.key, pk.value, pk.source_agent, pk.created_at
             FROM project_knowledge pk
             JOIN knowledge_fts fts ON pk.rowid = fts.rowid
             WHERE pk.project_id = ?1 AND knowledge_fts MATCH ?2
             ORDER BY rank
             LIMIT ?3",
        )?;
        let rows = stmt.query_map(params![project_id, query, limit], |row| {
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

    pub fn delete_knowledge(&self, id: &str) -> Result<()> {
        let conn = lock_conn(&self.conn)?;
        conn.execute("DELETE FROM project_knowledge WHERE id = ?1", params![id])?;
        Ok(())
    }

    // ── Settings ──

    pub fn get_setting(&self, key: &str) -> Result<Option<String>> {
        let conn = lock_conn(&self.conn)?;
        let mut stmt = conn.prepare("SELECT value FROM settings WHERE key = ?1")?;
        let mut rows = stmt.query(params![key])?;
        match rows.next()? {
            Some(row) => Ok(Some(row.get(0)?)),
            None => Ok(None),
        }
    }

    pub fn set_setting(&self, key: &str, value: &str) -> Result<()> {
        let conn = lock_conn(&self.conn)?;
        conn.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
            params![key, value],
        )?;
        Ok(())
    }
}
