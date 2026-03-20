import { useProjectStore } from '../../stores/projectStore'
import { useAgentStore } from '../../stores/agentStore'
import { useGitStore } from '../../stores/gitStore'
import { GitBranch, Activity, FolderPlus, Bell, Settings, BrainCircuit } from 'lucide-react'
import { DeepScanButton } from '../deepscan/DeepScanButton'

interface ProjectBarProps {
  onSwitchProject: () => void
  onOpenNotifications: () => void
  onOpenSettings: () => void
  onOpenMindPalace: () => void
  onOpenDeepScan: () => void
  unreadCount: number
}

export function ProjectBar({ onSwitchProject, onOpenNotifications, onOpenSettings, onOpenMindPalace, onOpenDeepScan, unreadCount }: ProjectBarProps) {
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
      {/* Left: METIS logo + Project + Branch */}
      <div className="flex items-center gap-4">
        <span className="font-hud text-sm text-accent holo-text tracking-widest">METIS</span>
        <div className="w-px h-5 bg-cyan/15" />
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
                  {gitStatus.files.length}
                </span>
              )}
            </>
          )}
        </div>
      </div>

      {/* Right: System status + Action buttons */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 mr-2">
          <span className="font-hud text-[9px] text-text-muted">SYSTEM:</span>
          <span className={`font-hud text-[9px] ${statusColor}`}>{systemStatus}</span>
          <Activity className={`w-3 h-3 ${isActive ? 'text-warning animate-pulse' : 'text-accent'}`} />
        </div>

        <div className="w-px h-5 bg-cyan/10" />

        <button onClick={onSwitchProject}
          className="p-2 rounded text-text-muted hover:text-accent hover:bg-white/5 transition-all"
          aria-label="Projekt wechseln"
          title="Projekt wechseln"
        >
          <FolderPlus className="w-4 h-4" />
        </button>
        <button onClick={onOpenNotifications}
          className="p-2 rounded text-text-muted hover:text-cyan hover:bg-white/5 transition-all relative"
          aria-label="Benachrichtigungen (Ctrl+N)"
          title="Benachrichtigungen (Ctrl+N)"
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-danger text-[8px] text-white flex items-center justify-center font-mono">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
        <DeepScanButton onClick={onOpenDeepScan} />
        <button onClick={onOpenSettings}
          className="p-2 rounded text-text-muted hover:text-accent hover:bg-white/5 transition-all"
          aria-label="Einstellungen (Ctrl+,)"
          title="Einstellungen (Ctrl+,)"
        >
          <Settings className="w-4 h-4" />
        </button>
        <button onClick={onOpenMindPalace}
          className="p-2 rounded text-text-secondary hover:text-violet hover:bg-white/5 transition-all"
          aria-label="Mind Palace (Ctrl+M)"
          title="Mind Palace (Ctrl+M)"
        >
          <BrainCircuit className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
