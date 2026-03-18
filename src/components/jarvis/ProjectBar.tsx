import { useProjectStore } from '../../stores/projectStore'
import { useAgentStore } from '../../stores/agentStore'
import { useGitStore } from '../../stores/gitStore'
import { GitBranch, Activity } from 'lucide-react'

export function ProjectBar() {
  const activeProject = useProjectStore((s) => s.getActiveProject())
  const phase = useAgentStore((s) => s.phase)
  const gitStatus = useGitStore((s) => s.status)

  if (!activeProject) return null

  const isActive = phase !== 'idle' && phase !== 'done'
  const systemStatus = isActive ? 'PROCESSING' : 'OPERATIONAL'
  const statusColor = isActive ? 'text-warning' : 'text-accent'

  return (
    <div className="absolute top-0 left-0 w-full h-12 z-40 flex items-center justify-between px-5"
      style={{
        background: 'linear-gradient(180deg, rgba(10, 14, 39, 0.95) 0%, rgba(10, 14, 39, 0.7) 100%)',
        borderBottom: '1px solid rgba(0, 212, 255, 0.08)',
      }}
    >
      {/* Left: METIS logo */}
      <div className="flex items-center gap-4">
        <span className="font-hud text-sm text-accent holo-text tracking-widest">METIS</span>

        <div className="w-px h-5 bg-cyan/15" />

        {/* Project + Branch */}
        <div className="flex items-center gap-2.5">
          <span className="font-hud text-[10px] text-text-primary">{activeProject.name}</span>
          {gitStatus?.is_git_repo && (
            <>
              <span className="text-text-muted text-[10px]">/</span>
              <div className="flex items-center gap-1">
                <GitBranch className="w-3 h-3 text-cyan" />
                <span className="font-mono text-[10px] text-text-secondary">{gitStatus.branch}</span>
              </div>
              {gitStatus.files.length > 0 && (
                <span className="px-1.5 py-0.5 rounded bg-warning/15 text-warning font-mono text-[9px]">
                  {gitStatus.files.length} changed
                </span>
              )}
            </>
          )}
        </div>
      </div>

      {/* Right: System status */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="font-hud text-[9px] text-text-muted">SYSTEM:</span>
          <span className={`font-hud text-[9px] ${statusColor}`}>{systemStatus}</span>
          <Activity className={`w-3 h-3 ${isActive ? 'text-warning animate-pulse' : 'text-accent'}`} />
        </div>
      </div>
    </div>
  )
}
