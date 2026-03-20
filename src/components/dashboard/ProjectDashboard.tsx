import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useProjectStore } from '../../stores/projectStore'
import { useChatStore } from '../../stores/chatStore'
import { StatsRow } from './StatsRow'
import { FileExplorer } from './FileExplorer'
import { ActivityTimeline } from './ActivityTimeline'
import { QuickActions } from './QuickActions'

interface FileEntry {
  name: string
  path: string
  is_dir: boolean
  size: number
  children: FileEntry[]
}

interface AgentRun {
  id: string
  agent_type: string
  prompt: string
  status: string
  started_at: string
  finished_at: string | null
}

function countFiles(entries: FileEntry[]): number {
  return entries.reduce((acc, e) => acc + (e.is_dir ? countFiles(e.children) : 1), 0)
}

export function ProjectDashboard() {
  const project = useProjectStore((s) => s.getActiveProject())
  const [files, setFiles] = useState<FileEntry[]>([])
  const [runs, setRuns] = useState<AgentRun[]>([])
  const [loadingFiles, setLoadingFiles] = useState(true)
  const [loadingRuns, setLoadingRuns] = useState(true)

  useEffect(() => {
    if (!project) return

    // Load files
    setLoadingFiles(true)
    invoke<FileEntry[]>('list_project_files', { path: project.path, maxDepth: 3 })
      .then(setFiles)
      .catch((err) => {
        console.error('Failed to list files:', err)
        setFiles([])
      })
      .finally(() => setLoadingFiles(false))

    // Load agent runs
    setLoadingRuns(true)
    invoke<AgentRun[]>('db_list_agent_runs', { projectId: project.id, limit: 20 })
      .then(setRuns)
      .catch((err) => {
        console.error('Failed to list runs:', err)
        setRuns([])
      })
      .finally(() => setLoadingRuns(false))
  }, [project?.id])

  if (!project) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-text-muted font-mono">Select a project.</p>
      </div>
    )
  }

  const handleQuickAction = (prompt: string) => {
    // Add the prompt to chat and switch to chat tab
    useChatStore.getState().addMessage({
      id: crypto.randomUUID(),
      role: 'user',
      content: prompt,
      timestamp: new Date().toISOString(),
    })
    // Trigger orchestration would happen in chat — for now just set the message
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      {/* Header */}
      <div className="mb-4">
        <h2 className="font-semibold text-sm text-accent">{project.name}</h2>
        <p className="text-[11px] text-text-muted font-mono mt-0.5">{project.path}</p>
      </div>

      {/* Stats */}
      <StatsRow
        project={project}
        fileCount={countFiles(files)}
        runCount={runs.length}
      />

      {/* Main Grid: Files + Activity */}
      <div className="grid grid-cols-5 gap-4 mb-4" style={{ height: 'calc(100vh - 340px)', minHeight: '300px' }}>
        <div className="col-span-2">
          <FileExplorer files={files} loading={loadingFiles} />
        </div>
        <div className="col-span-3">
          <ActivityTimeline runs={runs} loading={loadingRuns} />
        </div>
      </div>

      {/* Quick Actions */}
      <QuickActions onAction={handleQuickAction} />
    </div>
  )
}
