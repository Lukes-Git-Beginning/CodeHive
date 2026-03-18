import { useProjectStore } from '../../stores/projectStore'
import { useAgentStore } from '../../stores/agentStore'
import { useGitStore } from '../../stores/gitStore'
import { FolderGit2, Activity, ChevronDown, GitBranch } from 'lucide-react'

export function ProjectBar() {
  const activeProject = useProjectStore((s) => s.getActiveProject())
  const phase = useAgentStore((s) => s.phase)
  const gitStatus = useGitStore((s) => s.status)

  if (!activeProject) return null

  const isActive = phase !== 'idle' && phase !== 'done'

  return (
    <div className="w-full flex justify-center py-4 absolute top-0 left-0 z-40">
      <div className="hud-panel hud-brackets px-6 py-2 flex items-center gap-4 text-sm cursor-pointer transition-all relative overflow-hidden">
        {isActive && (
          <div className="absolute inset-0 animate-data-stream pointer-events-none" />
        )}

        <div className="flex items-center gap-2 relative z-10">
          <FolderGit2 className="w-4 h-4 text-accent" />
          <span className="font-hud text-text-primary text-xs">{activeProject.name}</span>
          <ChevronDown className="w-3.5 h-3.5 text-text-muted" />
        </div>

        <div className="w-px h-4 bg-cyan/20" />

        <div className="flex gap-2 relative z-10">
          {activeProject.techStack.slice(0, 3).map((tech) => (
            <span key={tech} className="px-2 py-0.5 rounded-md bg-bg-surface text-text-secondary font-mono text-[10px]">
              {tech}
            </span>
          ))}
          {activeProject.techStack.length > 3 && (
            <span className="px-2 py-0.5 rounded-md bg-bg-surface text-text-secondary font-mono text-[10px]">
              +{activeProject.techStack.length - 3}
            </span>
          )}
        </div>

        {gitStatus?.is_git_repo && (
          <>
            <div className="w-px h-4 bg-cyan/20" />
            <div className="flex items-center gap-2 relative z-10">
              <GitBranch className="w-3.5 h-3.5 text-cyan" />
              <span className="font-mono text-[10px] text-text-secondary">{gitStatus.branch}</span>
              {gitStatus.files.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-md bg-warning/20 text-warning font-mono text-[9px]">
                  {gitStatus.files.length}
                </span>
              )}
            </div>
          </>
        )}

        <div className="w-px h-4 bg-cyan/20" />

        <div className="flex items-center gap-2 relative z-10">
          <Activity className={`w-3.5 h-3.5 ${phase === 'idle' || phase === 'done' ? 'text-text-muted' : 'text-accent animate-pulse-glow'}`} />
          <span className="font-hud text-text-secondary text-[10px]">
            {phase.toUpperCase().replace('_', ' ')}
          </span>
        </div>
      </div>
    </div>
  )
}
