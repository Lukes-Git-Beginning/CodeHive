import { motion } from 'framer-motion'
import { Plus, Settings, Hexagon, Trash2 } from 'lucide-react'
import { useProjectStore } from '../../stores/projectStore'
import { StatusDot } from '../ui/StatusDot'

interface SidebarProps {
  onShowSettings: () => void
  onAddProject: () => void
}

export function Sidebar({ onShowSettings, onAddProject }: SidebarProps) {
  const projects = useProjectStore((s) => s.projects)
  const activeProjectId = useProjectStore((s) => s.activeProjectId)
  const setActiveProject = useProjectStore((s) => s.setActiveProject)
  const removeProject = useProjectStore((s) => s.removeProject)

  return (
    <div className="w-56 glass border-r border-border flex flex-col h-full shrink-0 relative z-10">
      {/* Logo */}
      <div className="p-4 border-b border-border flex items-center gap-3">
        <motion.div
          animate={{
            filter: [
              'drop-shadow(0 0 4px rgba(0,255,136,0.3))',
              'drop-shadow(0 0 8px rgba(0,255,136,0.6))',
              'drop-shadow(0 0 4px rgba(0,255,136,0.3))',
            ],
          }}
          transition={{ duration: 3, repeat: Infinity }}
        >
          <Hexagon className="w-7 h-7 text-accent" />
        </motion.div>
        <div>
          <h1 className="font-hud text-sm text-accent text-glow-green tracking-wider">CodeHive</h1>
          <p className="text-[10px] text-text-muted font-mono">AI Command Center</p>
        </div>
      </div>

      {/* Projects */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-3">
          <div className="flex items-center justify-between mb-3">
            <span className="font-hud text-[10px] text-text-muted">Projects</span>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={onAddProject}
              className="p-1 rounded-md hover:bg-bg-hover text-text-muted hover:text-accent transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
            </motion.button>
          </div>

          <div className="space-y-1">
            {projects.length === 0 ? (
              <p className="text-[11px] text-text-muted italic px-2 py-6 text-center">
                No projects yet.
              </p>
            ) : (
              projects.map((project) => {
                const isActive = activeProjectId === project.id
                return (
                  <motion.div
                    key={project.id}
                    whileHover={{ x: 2 }}
                    onClick={() => setActiveProject(project.id)}
                    role="button"
                    tabIndex={0}
                    className={`group w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition-all relative cursor-pointer ${
                      isActive
                        ? 'bg-accent/10 text-accent border border-accent-dim'
                        : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary border border-transparent'
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="active-project"
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-accent rounded-full glow-green"
                      />
                    )}

                    <StatusDot status={isActive ? 'online' : 'idle'} size={6} pulse={isActive} />

                    <div className="text-left truncate flex-1">
                      <div className="truncate font-medium">{project.name}</div>
                      {project.techStack.length > 0 && (
                        <div className="text-[10px] text-text-muted truncate mt-0.5">
                          {project.techStack.slice(0, 3).join(' · ')}
                        </div>
                      )}
                    </div>

                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          if (confirm(`"${project.name}" löschen?`)) removeProject(project.id)
                        }}
                        className="p-0.5 rounded hover:bg-danger/20 text-text-muted hover:text-danger transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </motion.div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* Settings */}
      <div className="border-t border-border p-2">
        <button
          onClick={onShowSettings}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-text-muted hover:bg-bg-hover hover:text-text-secondary transition-all"
        >
          <Settings className="w-3.5 h-3.5" />
          <span className="font-medium">Settings</span>
        </button>
      </div>
    </div>
  )
}
