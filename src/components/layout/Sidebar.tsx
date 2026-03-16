import { FolderOpen, Plus, Map, Settings, Hexagon } from 'lucide-react'
import { useProjectStore } from '../../stores/projectStore'

type View = 'projects' | 'roadmap' | 'settings'

interface SidebarProps {
  currentView: View
  onViewChange: (view: View) => void
  onAddProject: () => void
}

export function Sidebar({ currentView, onViewChange, onAddProject }: SidebarProps) {
  const { projects, activeProjectId, setActiveProject } = useProjectStore()

  return (
    <div className="w-64 bg-bg-secondary border-r border-border flex flex-col h-full shrink-0">
      {/* Logo */}
      <div className="p-4 border-b border-border flex items-center gap-2">
        <Hexagon className="w-8 h-8 text-accent" />
        <div>
          <h1 className="text-lg font-bold text-text-primary">CodeHive</h1>
          <p className="text-xs text-text-muted">Multi-Agent Orchestrator</p>
        </div>
      </div>

      {/* Projects */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
              Projekte
            </span>
            <button
              onClick={onAddProject}
              className="p-1 rounded hover:bg-bg-hover text-text-muted hover:text-accent transition-colors"
              title="Projekt hinzufügen"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-1">
            {projects.length === 0 ? (
              <p className="text-xs text-text-muted italic px-2 py-4">
                Noch keine Projekte. Klicke + um eins hinzuzufügen.
              </p>
            ) : (
              projects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => {
                    setActiveProject(project.id)
                    onViewChange('projects')
                  }}
                  className={`w-full flex items-center gap-2 px-2 py-2 rounded text-sm transition-colors ${
                    activeProjectId === project.id
                      ? 'bg-bg-hover text-accent'
                      : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
                  }`}
                >
                  <FolderOpen className="w-4 h-4 shrink-0" />
                  <div className="text-left truncate">
                    <div className="truncate">{project.name}</div>
                    {project.techStack.length > 0 && (
                      <div className="text-xs text-text-muted truncate">
                        {project.techStack.join(', ')}
                      </div>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Bottom Nav */}
      <div className="border-t border-border p-2 space-y-1">
        <button
          onClick={() => onViewChange('roadmap')}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded text-sm transition-colors ${
            currentView === 'roadmap'
              ? 'bg-bg-hover text-accent'
              : 'text-text-secondary hover:bg-bg-hover'
          }`}
        >
          <Map className="w-4 h-4" />
          Roadmap
        </button>
        <button
          onClick={() => onViewChange('settings')}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded text-sm transition-colors ${
            currentView === 'settings'
              ? 'bg-bg-hover text-accent'
              : 'text-text-secondary hover:bg-bg-hover'
          }`}
        >
          <Settings className="w-4 h-4" />
          Einstellungen
        </button>
      </div>
    </div>
  )
}
