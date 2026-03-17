import { useProjectStore } from '../../stores/projectStore'
import { useAgentStore } from '../../stores/agentStore'
import { FolderGit2, Activity, ChevronDown } from 'lucide-react'

export function ProjectBar() {
  const activeProject = useProjectStore((s) => s.getActiveProject())
  const phase = useAgentStore((s) => s.phase)

  if (!activeProject) return null

  return (
    <div className="w-full flex justify-center py-4 absolute top-0 left-0 z-40">
      <div className="glass-elevated px-6 py-2 rounded-full flex items-center gap-4 text-sm neon-hover cursor-pointer transition-all">
        <div className="flex items-center gap-2">
          <FolderGit2 className="w-4 h-4 text-accent" />
          <span className="font-hud text-text-primary text-xs">{activeProject.name}</span>
          <ChevronDown className="w-3.5 h-3.5 text-text-muted" />
        </div>

        <div className="w-px h-4 bg-border" />

        <div className="flex gap-2">
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

        <div className="w-px h-4 bg-border" />

        <div className="flex items-center gap-2">
          <Activity className={`w-3.5 h-3.5 ${phase === 'idle' || phase === 'done' ? 'text-text-muted' : 'text-accent animate-pulse-glow'}`} />
          <span className="font-hud text-text-secondary text-[10px]">
            {phase.toUpperCase().replace('_', ' ')}
          </span>
        </div>
      </div>
    </div>
  )
}
