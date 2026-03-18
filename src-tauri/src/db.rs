use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DbScheduledTask {
    pub id: String,
    pub project_id: String,
    pub name: String,
    pub prompt: String,
    pub schedule_interval: String,
    pub enabled: bool,
    pub last_run: Option<String>,
    pub next_run: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DbTeamMember {
    pub id: String,
    pub name: String,
    pub role: String,
    pub email: Option<String>,
    pub avatar_color: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DbTaskAssignment {
    pub id: String,
    pub task_id: String,
    pub member_id: String,
    pub assigned_at: String,
}

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
    Migration {
        version: 4,
        description: "Add conversations table for persistent chat memory",
        sql: "
            CREATE TABLE IF NOT EXISTS conversations (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                role TEXT NOT NULL,
                agent_role TEXT,
                content TEXT NOT NULL,
                timestamp TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_conversations_project ON conversations(project_id, timestamp);
        ",
    },
    Migration {
        version: 5,
        description: "Add scheduled_tasks and team tables",
        sql: "
            CREATE TABLE IF NOT EXISTS scheduled_tasks (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                name TEXT NOT NULL,
                prompt TEXT NOT NULL,
                schedule_interval TEXT NOT NULL,
                enabled INTEGER NOT NULL DEFAULT 1,
                last_run TEXT,
                next_run TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_scheduled_project ON scheduled_tasks(project_id);
            CREATE INDEX IF NOT EXISTS idx_scheduled_next ON scheduled_tasks(next_run);

            CREATE TABLE IF NOT EXISTS team_members (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'developer',
                email TEXT,
                avatar_color TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS task_assignments (
                id TEXT PRIMARY KEY,
                task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
                member_id TEXT NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
                assigned_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_assignments_task ON task_assignments(task_id);
            CREATE INDEX IF NOT EXISTS idx_assignments_member ON task_assignments(member_id);
        ",
    },
    Migration {
        version: 6,
        description: "Path abstraction for multi-PC support",
        sql: "
            ALTER TABLE projects ADD COLUMN git_remote TEXT NOT NULL DEFAULT '';
            ALTER TABLE projects ADD COLUMN project_identifier TEXT NOT NULL DEFAULT '';

            CREATE TABLE IF NOT EXISTS path_mappings (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                machine_id TEXT NOT NULL,
                local_path TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_path_mappings_project ON path_mappings(project_id);
            CREATE INDEX IF NOT EXISTS idx_path_mappings_machine ON path_mappings(machine_id);
            CREATE UNIQUE INDEX IF NOT EXISTS idx_path_mappings_unique ON path_mappings(project_id, machine_id);

            CREATE TABLE IF NOT EXISTS export_history (
                id TEXT PRIMARY KEY,
                export_type TEXT NOT NULL,
                file_path TEXT,
                created_at TEXT NOT NULL,
                project_ids TEXT NOT NULL DEFAULT '[]'
            );
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

    // ── Conversations ──

    pub fn save_message(&self, id: &str, project_id: &str, role: &str, agent_role: Option<&str>, content: &str, timestamp: &str) -> Result<()> {
        let conn = lock_conn(&self.conn)?;
        conn.execute(
            "INSERT OR REPLACE INTO conversations (id, project_id, role, agent_role, content, timestamp)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![id, project_id, role, agent_role, content, timestamp],
        )?;
        Ok(())
    }

    pub fn load_messages(&self, project_id: &str, limit: i32) -> Result<Vec<(String, String, String, Option<String>, String, String)>> {
        let conn = lock_conn(&self.conn)?;
        let mut stmt = conn.prepare(
            "SELECT id, project_id, role, agent_role, content, timestamp
             FROM conversations WHERE project_id = ?1 ORDER BY timestamp ASC LIMIT ?2",
        )?;
        let rows = stmt.query_map(params![project_id, limit], |row| {
            Ok((
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
                row.get(3)?,
                row.get(4)?,
                row.get(5)?,
            ))
        })?;
        rows.collect()
    }

    pub fn clear_messages(&self, project_id: &str) -> Result<()> {
        let conn = lock_conn(&self.conn)?;
        conn.execute("DELETE FROM conversations WHERE project_id = ?1", params![project_id])?;
        Ok(())
    }

    // ── Scheduled Tasks ──

    pub fn list_scheduled_tasks(&self, project_id: &str) -> Result<Vec<DbScheduledTask>> {
        let conn = lock_conn(&self.conn)?;
        let mut stmt = conn.prepare(
            "SELECT id, project_id, name, prompt, schedule_interval, enabled, last_run, next_run, created_at, updated_at
             FROM scheduled_tasks WHERE project_id = ?1 ORDER BY created_at ASC",
        )?;
        let rows = stmt.query_map(params![project_id], |row| {
            Ok(DbScheduledTask {
                id: row.get(0)?,
                project_id: row.get(1)?,
                name: row.get(2)?,
                prompt: row.get(3)?,
                schedule_interval: row.get(4)?,
                enabled: row.get::<_, i32>(5)? != 0,
                last_run: row.get(6)?,
                next_run: row.get(7)?,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            })
        })?;
        rows.collect()
    }

    pub fn save_scheduled_task(&self, task: &DbScheduledTask) -> Result<()> {
        let conn = lock_conn(&self.conn)?;
        conn.execute(
            "INSERT OR REPLACE INTO scheduled_tasks (id, project_id, name, prompt, schedule_interval, enabled, last_run, next_run, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![
                task.id,
                task.project_id,
                task.name,
                task.prompt,
                task.schedule_interval,
                task.enabled as i32,
                task.last_run,
                task.next_run,
                task.created_at,
                task.updated_at,
            ],
        )?;
        Ok(())
    }

    pub fn delete_scheduled_task(&self, id: &str) -> Result<()> {
        let conn = lock_conn(&self.conn)?;
        conn.execute("DELETE FROM scheduled_tasks WHERE id = ?1", params![id])?;
        Ok(())
    }

    // ── Team Members ──

    pub fn list_team_members(&self) -> Result<Vec<DbTeamMember>> {
        let conn = lock_conn(&self.conn)?;
        let mut stmt = conn.prepare(
            "SELECT id, name, role, email, avatar_color, created_at FROM team_members ORDER BY created_at ASC",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(DbTeamMember {
                id: row.get(0)?,
                name: row.get(1)?,
                role: row.get(2)?,
                email: row.get(3)?,
                avatar_color: row.get(4)?,
                created_at: row.get(5)?,
            })
        })?;
        rows.collect()
    }

    pub fn save_team_member(&self, member: &DbTeamMember) -> Result<()> {
        let conn = lock_conn(&self.conn)?;
        conn.execute(
            "INSERT OR REPLACE INTO team_members (id, name, role, email, avatar_color, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![member.id, member.name, member.role, member.email, member.avatar_color, member.created_at],
        )?;
        Ok(())
    }

    pub fn delete_team_member(&self, id: &str) -> Result<()> {
        let conn = lock_conn(&self.conn)?;
        conn.execute("DELETE FROM team_members WHERE id = ?1", params![id])?;
        Ok(())
    }

    // ── Task Assignments ──

    pub fn list_task_assignments(&self) -> Result<Vec<DbTaskAssignment>> {
        let conn = lock_conn(&self.conn)?;
        let mut stmt = conn.prepare(
            "SELECT id, task_id, member_id, assigned_at FROM task_assignments ORDER BY assigned_at DESC",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(DbTaskAssignment {
                id: row.get(0)?,
                task_id: row.get(1)?,
                member_id: row.get(2)?,
                assigned_at: row.get(3)?,
            })
        })?;
        rows.collect()
    }

    pub fn save_task_assignment(&self, assignment: &DbTaskAssignment) -> Result<()> {
        let conn = lock_conn(&self.conn)?;
        conn.execute(
            "INSERT OR REPLACE INTO task_assignments (id, task_id, member_id, assigned_at)
             VALUES (?1, ?2, ?3, ?4)",
            params![assignment.id, assignment.task_id, assignment.member_id, assignment.assigned_at],
        )?;
        Ok(())
    }

    pub fn delete_task_assignment(&self, id: &str) -> Result<()> {
        let conn = lock_conn(&self.conn)?;
        conn.execute("DELETE FROM task_assignments WHERE id = ?1", params![id])?;
        Ok(())
    }

    // ── Multi-PC Support ──

    pub fn get_project(&self, id: &str) -> Result<DbProject> {
        let conn = lock_conn(&self.conn)?;
        conn.query_row(
            "SELECT id, name, path, tech_stack, description, created_at, updated_at FROM projects WHERE id = ?1",
            params![id],
            |row| {
                Ok(DbProject {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    path: row.get(2)?,
                    tech_stack: row.get(3)?,
                    description: row.get(4)?,
                    created_at: row.get(5)?,
                    updated_at: row.get(6)?,
                })
            },
        )
    }

    pub fn get_task(&self, id: &str) -> Result<Option<DbTask>> {
        let conn = lock_conn(&self.conn)?;
        let mut stmt = conn.prepare(
            "SELECT id, project_id, title, description, status, priority, milestone, created_at, completed_at FROM tasks WHERE id = ?1",
        )?;
        let result = stmt.query_row(params![id], |row| {
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
        });
        match result {
            Ok(task) => Ok(Some(task)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    }

    pub fn save_path_mapping(&self, id: &str, project_id: &str, machine_id: &str, local_path: &str) -> Result<()> {
        let now = chrono::Utc::now().to_rfc3339();
        let conn = lock_conn(&self.conn)?;
        conn.execute(
            "INSERT OR REPLACE INTO path_mappings (id, project_id, machine_id, local_path, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?5)",
            params![id, project_id, machine_id, local_path, now],
        )?;
        Ok(())
    }

    pub fn get_path_mapping(&self, project_id: &str, machine_id: &str) -> Result<Option<String>> {
        let conn = lock_conn(&self.conn)?;
        let mut stmt = conn.prepare(
            "SELECT local_path FROM path_mappings WHERE project_id = ?1 AND machine_id = ?2"
        )?;
        let result = stmt.query_row(params![project_id, machine_id], |row| {
            row.get::<_, String>(0)
        });
        match result {
            Ok(path) => Ok(Some(path)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    }

    pub fn update_project_identifier(&self, project_id: &str, identifier: &str, git_remote: &str) -> Result<()> {
        let conn = lock_conn(&self.conn)?;
        conn.execute(
            "UPDATE projects SET project_identifier = ?1, git_remote = ?2 WHERE id = ?3",
            params![identifier, git_remote, project_id],
        )?;
        Ok(())
    }

    pub fn export_project_data(&self, project_id: &str) -> Result<String, String> {
        let conn = lock_conn(&self.conn).map_err(|e| e.to_string())?;

        // Get project
        let mut stmt = conn.prepare("SELECT id, name, path, tech_stack, description, created_at, updated_at, git_remote, project_identifier FROM projects WHERE id = ?1")
            .map_err(|e| e.to_string())?;
        let project: String = stmt.query_row(params![project_id], |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, String>(0)?,
                "name": row.get::<_, String>(1)?,
                "path": row.get::<_, String>(2)?,
                "techStack": row.get::<_, String>(3)?,
                "description": row.get::<_, String>(4)?,
                "createdAt": row.get::<_, String>(5)?,
                "updatedAt": row.get::<_, String>(6)?,
                "gitRemote": row.get::<_, String>(7).unwrap_or_default(),
                "projectIdentifier": row.get::<_, String>(8).unwrap_or_default(),
            }).to_string())
        }).map_err(|e| e.to_string())?;

        // Get tasks
        let mut stmt = conn.prepare("SELECT id, project_id, title, description, status, priority, milestone, created_at FROM tasks WHERE project_id = ?1")
            .map_err(|e| e.to_string())?;
        let tasks: Vec<String> = stmt.query_map(params![project_id], |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, String>(0)?,
                "projectId": row.get::<_, String>(1)?,
                "title": row.get::<_, String>(2)?,
                "description": row.get::<_, String>(3).unwrap_or_default(),
                "status": row.get::<_, String>(4)?,
                "priority": row.get::<_, i32>(5).unwrap_or(1),
                "milestone": row.get::<_, String>(6).unwrap_or_default(),
                "createdAt": row.get::<_, String>(7)?,
            }).to_string())
        }).map_err(|e| e.to_string())?.filter_map(|r| r.ok()).collect();

        // Get conversations
        let mut stmt = conn.prepare("SELECT id, project_id, role, content, timestamp FROM conversations WHERE project_id = ?1 ORDER BY timestamp ASC")
            .map_err(|e| e.to_string())?;
        let conversations: Vec<String> = stmt.query_map(params![project_id], |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, String>(0)?,
                "projectId": row.get::<_, String>(1)?,
                "role": row.get::<_, String>(2)?,
                "content": row.get::<_, String>(3)?,
                "timestamp": row.get::<_, String>(4)?,
            }).to_string())
        }).map_err(|e| e.to_string())?.filter_map(|r| r.ok()).collect();

        // Get agent runs
        let mut stmt = conn.prepare("SELECT id, project_id, prompt, status, output, agent_type, files_changed, started_at, finished_at FROM agent_runs WHERE project_id = ?1")
            .map_err(|e| e.to_string())?;
        let agent_runs: Vec<String> = stmt.query_map(params![project_id], |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, String>(0)?,
                "projectId": row.get::<_, String>(1)?,
                "prompt": row.get::<_, String>(2)?,
                "status": row.get::<_, String>(3)?,
                "output": row.get::<_, String>(4).unwrap_or_default(),
                "agentType": row.get::<_, String>(5).unwrap_or_default(),
                "filesChanged": row.get::<_, String>(6).unwrap_or_default(),
                "startedAt": row.get::<_, String>(7)?,
                "finishedAt": row.get::<_, String>(8).unwrap_or_default(),
            }).to_string())
        }).map_err(|e| e.to_string())?.filter_map(|r| r.ok()).collect();

        let bundle = serde_json::json!({
            "version": "1.0",
            "exportedAt": chrono::Utc::now().to_rfc3339(),
            "project": serde_json::from_str::<serde_json::Value>(&project).unwrap_or_default(),
            "tasks": tasks.iter().map(|t| serde_json::from_str::<serde_json::Value>(t).unwrap_or_default()).collect::<Vec<_>>(),
            "conversations": conversations.iter().map(|c| serde_json::from_str::<serde_json::Value>(c).unwrap_or_default()).collect::<Vec<_>>(),
            "agentRuns": agent_runs.iter().map(|r| serde_json::from_str::<serde_json::Value>(r).unwrap_or_default()).collect::<Vec<_>>(),
        });

        Ok(bundle.to_string())
    }
}
