import { motion } from 'framer-motion'
import { FolderOpen, Plus, Map, Settings, Hexagon, Trash2 } from 'lucide-react'
import { useProjectStore } from '../../stores/projectStore'
import { StatusDot } from '../ui/StatusDot'

type View = 'projects' | 'roadmap' | 'settings'

interface SidebarProps {
  currentView: View
  onViewChange: (view: View) => void
  onAddProject: () => void
}

export function Sidebar({ currentView, onViewChange, onAddProject }: SidebarProps) {
  const { projects, activeProjectId, setActiveProject, removeProject } = useProjectStore()

  return (
    <div className="w-60 glass border-r border-border flex flex-col h-full shrink-0 relative z-10">
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
          <p className="text-[10px] text-text-muted font-mono">Multi-Agent Orchestrator</p>
        </div>
      </div>

      {/* Projects */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-3">
          <div className="flex items-center justify-between mb-3">
            <span className="font-hud text-[10px] text-text-muted">Projekte</span>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={onAddProject}
              className="p-1 rounded-md hover:bg-bg-hover text-text-muted hover:text-accent transition-colors"
              title="Projekt hinzufügen"
            >
              <Plus className="w-3.5 h-3.5" />
            </motion.button>
          </div>

          <div className="space-y-1">
            {projects.length === 0 ? (
              <p className="text-[11px] text-text-muted italic px-2 py-6 text-center">
                Noch keine Projekte.
              </p>
            ) : (
              projects.map((project) => {
                const isActive = activeProjectId === project.id
                return (
                  <motion.button
                    key={project.id}
                    whileHover={{ x: 2 }}
                    onClick={() => {
                      setActiveProject(project.id)
                      onViewChange('projects')
                    }}
                    className={`group w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition-all relative ${
                      isActive
                        ? 'bg-accent/10 text-accent border border-accent-dim'
                        : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary border border-transparent'
                    }`}
                  >
                    {/* Active indicator line */}
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

                    {/* Delete button */}
                    <motion.div
                      initial={{ opacity: 0 }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          if (confirm(`"${project.name}" wirklich löschen?`)) {
                            removeProject(project.id)
                          }
                        }}
                        className="p-0.5 rounded hover:bg-danger/20 text-text-muted hover:text-danger transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </motion.div>
                  </motion.button>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* Bottom Nav */}
      <div className="border-t border-border p-2 space-y-0.5">
        {[
          { id: 'roadmap' as View, icon: Map, label: 'Roadmap' },
          { id: 'settings' as View, icon: Settings, label: 'System' },
        ].map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => onViewChange(id)}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-all ${
              currentView === id
                ? 'bg-accent/10 text-accent border border-accent-dim'
                : 'text-text-muted hover:bg-bg-hover hover:text-text-secondary border border-transparent'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span className="font-medium">{label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
