import { useState } from 'react'
import { FolderOpen, Plus, Trash2, ChevronRight, Code2 } from 'lucide-react'
import { useProjectStore } from '../../stores/projectStore'
import type { Project } from '../../types/project'

interface ProjectSelectorProps {
  onProjectSelect: () => void
}

export function ProjectSelector({ onProjectSelect }: ProjectSelectorProps) {
  const { projects, addProject, removeProject, setActiveProject } = useProjectStore()
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPath, setNewPath] = useState('')

  const handleAddProject = () => {
    if (!newName.trim() || !newPath.trim()) return

    const project: Project = {
      id: crypto.randomUUID(),
      name: newName.trim(),
      path: newPath.trim(),
      techStack: [],
      description: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    addProject(project)
    setNewName('')
    setNewPath('')
    setShowAdd(false)
    setActiveProject(project.id)
    onProjectSelect()
  }

  return (
    <div className="flex flex-col items-center justify-center h-full p-8">
      <Code2 className="w-20 h-20 text-accent mb-6 opacity-60" />
      <h2 className="text-2xl font-bold mb-2">Willkommen bei CodeHive</h2>
      <p className="text-text-secondary mb-8 text-center max-w-md">
        Wähle ein Projekt aus oder füge ein neues hinzu, um mit den AI-Agenten zu arbeiten.
      </p>

      {/* Project Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-3xl mb-6">
        {projects.map((project) => (
          <button
            key={project.id}
            onClick={() => {
              setActiveProject(project.id)
              onProjectSelect()
            }}
            className="bg-bg-card border border-border hover:border-accent/50 rounded-xl p-4
                       text-left transition-all group"
          >
            <div className="flex items-start justify-between mb-3">
              <FolderOpen className="w-8 h-8 text-accent/60 group-hover:text-accent transition-colors" />
              <ChevronRight className="w-5 h-5 text-text-muted group-hover:text-accent transition-colors" />
            </div>
            <h3 className="font-semibold mb-1 group-hover:text-accent transition-colors">
              {project.name}
            </h3>
            <p className="text-xs text-text-muted truncate">{project.path}</p>
            {project.techStack.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {project.techStack.map((tech) => (
                  <span
                    key={tech}
                    className="text-xs bg-bg-hover text-text-secondary rounded px-1.5 py-0.5"
                  >
                    {tech}
                  </span>
                ))}
              </div>
            )}
          </button>
        ))}

        {/* Add Project Card */}
        <button
          onClick={() => setShowAdd(true)}
          className="border-2 border-dashed border-border hover:border-accent/50 rounded-xl p-4
                     flex flex-col items-center justify-center min-h-[140px] transition-colors group"
        >
          <Plus className="w-8 h-8 text-text-muted group-hover:text-accent mb-2 transition-colors" />
          <span className="text-sm text-text-muted group-hover:text-text-secondary transition-colors">
            Projekt hinzufügen
          </span>
        </button>
      </div>

      {/* Add Project Dialog */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-bg-secondary border border-border rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Neues Projekt</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-text-muted mb-1 block">Projektname</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="z.B. Meine Web-App"
                  className="w-full bg-bg-card border border-border rounded-lg px-3 py-2 text-sm
                             text-text-primary placeholder-text-muted focus:outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="text-xs text-text-muted mb-1 block">Projekt-Pfad</label>
                <input
                  type="text"
                  value={newPath}
                  onChange={(e) => setNewPath(e.target.value)}
                  placeholder="z.B. C:\Users\Luke\Documents\MeinProjekt"
                  className="w-full bg-bg-card border border-border rounded-lg px-3 py-2 text-sm
                             text-text-primary placeholder-text-muted focus:outline-none focus:border-accent"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setShowAdd(false)}
                className="flex-1 bg-bg-hover text-text-secondary py-2 rounded-lg text-sm hover:text-text-primary transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={handleAddProject}
                disabled={!newName.trim() || !newPath.trim()}
                className="flex-1 bg-accent text-bg-primary py-2 rounded-lg text-sm font-medium
                           hover:bg-accent-hover transition-colors disabled:opacity-50"
              >
                Hinzufügen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
