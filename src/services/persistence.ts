import { invoke } from '@tauri-apps/api/core'
import type { Project, Task } from '../types/project'
import { useProjectStore } from '../stores/projectStore'

// ── DB Types (match Rust structs) ──

interface DbProject {
  id: string
  name: string
  path: string
  tech_stack: string
  description: string
  created_at: string
  updated_at: string
}

interface DbTask {
  id: string
  project_id: string
  title: string
  description: string
  status: string
  priority: number
  milestone: string | null
  created_at: string
  completed_at: string | null
}

// ── Converters ──

function projectToDb(p: Project): DbProject {
  return {
    id: p.id,
    name: p.name,
    path: p.path,
    tech_stack: JSON.stringify(p.techStack),
    description: p.description,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
  }
}

function dbToProject(d: DbProject): Project {
  let techStack: string[] = []
  try { techStack = JSON.parse(d.tech_stack) } catch { /* empty */ }
  return {
    id: d.id,
    name: d.name,
    path: d.path,
    techStack,
    description: d.description,
    createdAt: d.created_at,
    updatedAt: d.updated_at,
  }
}

function taskToDb(t: Task): DbTask {
  return {
    id: t.id,
    project_id: t.projectId,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    milestone: t.milestone || null,
    created_at: t.createdAt,
    completed_at: t.completedAt || null,
  }
}

function dbToTask(d: DbTask): Task {
  return {
    id: d.id,
    projectId: d.project_id,
    title: d.title,
    description: d.description,
    status: d.status as Task['status'],
    priority: d.priority,
    milestone: d.milestone || undefined,
    createdAt: d.created_at,
    completedAt: d.completed_at || undefined,
  }
}

// ── Public API ──

export async function loadProjects(): Promise<Project[]> {
  try {
    const dbProjects = await invoke<DbProject[]>('db_list_projects')
    return dbProjects.map(dbToProject)
  } catch (err) {
    console.error('Failed to load projects:', err)
    return []
  }
}

export async function saveProject(project: Project): Promise<void> {
  try {
    await invoke('db_save_project', { project: projectToDb(project) })
  } catch (err) {
    console.error('Failed to save project:', err)
  }
}

export async function deleteProject(id: string): Promise<void> {
  try {
    await invoke('db_delete_project', { id })
  } catch (err) {
    console.error('Failed to delete project:', err)
  }
}

export async function loadTasks(projectId: string): Promise<Task[]> {
  try {
    const dbTasks = await invoke<DbTask[]>('db_list_tasks', { projectId })
    return dbTasks.map(dbToTask)
  } catch (err) {
    console.error('Failed to load tasks:', err)
    return []
  }
}

export async function saveTask(task: Task): Promise<void> {
  try {
    await invoke('db_save_task', { task: taskToDb(task) })
  } catch (err) {
    console.error('Failed to save task:', err)
  }
}

export async function deleteTask(id: string): Promise<void> {
  try {
    await invoke('db_delete_task', { id })
  } catch (err) {
    console.error('Failed to delete task:', err)
  }
}

// ── Agent Runs ──

interface DbAgentRun {
  id: string
  project_id: string
  task_id: string | null
  agent_type: string
  prompt: string
  status: string
  output: string
  files_changed: string
  started_at: string
  finished_at: string | null
}

export async function saveAgentRun(run: DbAgentRun): Promise<void> {
  try {
    await invoke('db_save_agent_run', { run })
  } catch (err) {
    console.error('Failed to save agent run:', err)
  }
}

export async function loadAgentRuns(projectId: string, limit = 20): Promise<DbAgentRun[]> {
  try {
    return await invoke<DbAgentRun[]>('db_list_agent_runs', { projectId, limit })
  } catch {
    return []
  }
}

// ── Settings ──

export async function getSetting(key: string): Promise<string | null> {
  try {
    return await invoke<string | null>('db_get_setting', { key })
  } catch {
    return null
  }
}

export async function setSetting(key: string, value: string): Promise<void> {
  try {
    await invoke('db_set_setting', { key, value })
  } catch (err) {
    console.error('Failed to save setting:', err)
  }
}

/**
 * Initialize app state from database on startup
 */
export async function initializeFromDb(): Promise<void> {
  const store = useProjectStore.getState()
  const projects = await loadProjects()
  store.setProjects(projects)

  // Restore last active project
  const lastProjectId = await getSetting('last_active_project')
  if (lastProjectId && projects.some((p) => p.id === lastProjectId)) {
    store.setActiveProject(lastProjectId)
  }
}
