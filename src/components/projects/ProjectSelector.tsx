import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FolderOpen, Plus, ChevronRight, Hexagon, Loader2, X, Download, Upload } from 'lucide-react'
import { useProjectStore } from '../../stores/projectStore'
import { useNotificationStore } from '../../stores/notificationStore'
import { detectTechStack } from '../../services/orchestrator'
import { exportProjectBundle, importProjectBundle } from '../../services/persistence'
import { open } from '@tauri-apps/plugin-dialog'
import type { Project } from '../../types/project'
import { GlowButton } from '../ui/GlowButton'

interface ProjectSelectorProps {
  onProjectSelect: () => void
}

export function ProjectSelector({ onProjectSelect }: ProjectSelectorProps) {
  const { projects, addProject, setActiveProject } = useProjectStore()
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPath, setNewPath] = useState('')
  const [detecting, setDetecting] = useState(false)
  const [detectedStack, setDetectedStack] = useState<string[]>([])

  const handleImportProject = async () => {
    try {
      const file = await open({
        filters: [{ name: 'CodeHive Bundle', extensions: ['json'] }],
        multiple: false,
      })
      if (file) {
        await importProjectBundle(file)
        await useProjectStore.getState().initialize()
        useNotificationStore.getState().addNotification('success', 'Projekt importiert!')
      }
    } catch (err) {
      useNotificationStore.getState().addNotification('error', `Import fehlgeschlagen: ${err}`)
    }
  }

  const handleExportProject = async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const filePath = await exportProjectBundle(projectId)
      useNotificationStore.getState().addNotification('success', `Exportiert: ${filePath}`)
    } catch (err) {
      useNotificationStore.getState().addNotification('error', `Export fehlgeschlagen: ${err}`)
    }
  }

  const handlePathChange = async (path: string) => {
    setNewPath(path)
    if (path.trim().length > 5) {
      setDetecting(true)
      const stack = await detectTechStack(path.trim())
      setDetectedStack(stack)
      setDetecting(false)
    }
  }

  const handleAddProject = async () => {
    if (!newName.trim() || !newPath.trim()) return
    const project: Project = {
      id: crypto.randomUUID(),
      name: newName.trim(),
      path: newPath.trim(),
      techStack: detectedStack,
      description: '',
      gitRemote: '',
      projectIdentifier: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    await addProject(project)
    setNewName('')
    setNewPath('')
    setDetectedStack([])
    setShowAdd(false)
    setActiveProject(project.id)
    onProjectSelect()
  }

  return (
    <div className="flex flex-col items-center justify-center h-full p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <motion.div
          className="w-20 h-20 rounded-2xl glass-accent flex items-center justify-center mx-auto mb-5"
          animate={{
            boxShadow: [
              '0 0 20px rgba(0,255,136,0.2)',
              '0 0 40px rgba(0,255,136,0.4)',
              '0 0 20px rgba(0,255,136,0.2)',
            ],
          }}
          transition={{ duration: 3, repeat: Infinity }}
        >
          <Hexagon className="w-10 h-10 text-accent" />
        </motion.div>
        <h2 className="font-hud text-lg text-accent text-glow-green mb-2">CodeHive</h2>
        <p className="text-sm text-text-muted max-w-md">
          Wähle ein Projekt oder erstelle ein neues, um mit den AI-Agenten zu arbeiten.
        </p>
      </motion.div>

      {/* Project Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-3xl mb-6">
        {projects.map((project, i) => (
          <motion.button
            key={project.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            whileHover={{ y: -3 }}
            onClick={() => { setActiveProject(project.id); onProjectSelect() }}
            className="glass neon-hover rounded-xl p-5 text-left group"
          >
            <div className="flex items-start justify-between mb-3">
              <FolderOpen className="w-7 h-7 text-accent/50 group-hover:text-accent transition-colors" />
              <div className="flex items-center gap-1.5">
                <button
                  onClick={(e) => handleExportProject(project.id, e)}
                  className="p-1 rounded text-text-muted hover:text-cyan hover:bg-cyan/10 transition-all opacity-0 group-hover:opacity-100"
                  title="Projekt exportieren"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
                <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-accent transition-colors" />
              </div>
            </div>
            <h3 className="font-medium text-sm mb-1 group-hover:text-accent transition-colors">
              {project.name}
            </h3>
            <p className="text-[11px] text-text-muted truncate font-mono">{project.path}</p>
            {project.techStack.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2.5">
                {project.techStack.map((tech) => (
                  <span key={tech} className="text-[10px] bg-accent/10 text-accent/70 rounded px-1.5 py-0.5 font-mono">
                    {tech}
                  </span>
                ))}
              </div>
            )}
          </motion.button>
        ))}

        {/* Add Card */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          whileHover={{ y: -3 }}
          onClick={() => setShowAdd(true)}
          className="border border-dashed border-border-accent rounded-xl p-5
                     flex flex-col items-center justify-center min-h-[160px]
                     hover:border-accent/40 hover:bg-accent/5 transition-all group"
        >
          <Plus className="w-7 h-7 text-text-muted group-hover:text-accent mb-2 transition-colors" />
          <span className="text-xs text-text-muted group-hover:text-text-secondary font-hud">
            New Project
          </span>
        </motion.button>

        {/* Import Card */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          whileHover={{ y: -3 }}
          onClick={handleImportProject}
          className="border border-dashed border-cyan/20 rounded-xl p-5
                     flex flex-col items-center justify-center min-h-[160px]
                     hover:border-cyan/40 hover:bg-cyan/5 transition-all group"
        >
          <Upload className="w-7 h-7 text-text-muted group-hover:text-cyan mb-2 transition-colors" />
          <span className="text-xs text-text-muted group-hover:text-text-secondary font-hud">
            Import Project
          </span>
        </motion.button>
      </div>

      {/* Add Dialog */}
      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
            onClick={() => setShowAdd(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-elevated rounded-2xl p-6 w-full max-w-md"
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-hud text-sm text-accent">New Project</h3>
                <button onClick={() => setShowAdd(false)} className="text-text-muted hover:text-text-primary">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="font-hud text-[10px] text-text-muted mb-1.5 block">Name</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="My Project"
                    autoFocus
                    className="w-full glass rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder-text-muted
                               focus:outline-none focus:border-accent/40 font-mono"
                  />
                </div>
                <div>
                  <label className="font-hud text-[10px] text-text-muted mb-1.5 block">Path</label>
                  <input
                    type="text"
                    value={newPath}
                    onChange={(e) => handlePathChange(e.target.value)}
                    placeholder="C:\Users\..."
                    className="w-full glass rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder-text-muted
                               focus:outline-none focus:border-accent/40 font-mono"
                  />
                </div>

                {(detecting || detectedStack.length > 0) && (
                  <div>
                    <label className="font-hud text-[10px] text-text-muted mb-1.5 block">Detected Stack</label>
                    <div className="flex flex-wrap gap-1.5">
                      {detecting ? (
                        <span className="flex items-center gap-1 text-[11px] text-text-muted">
                          <Loader2 className="w-3 h-3 animate-spin" /> Scanning...
                        </span>
                      ) : (
                        detectedStack.map((tech) => (
                          <span key={tech} className="text-[11px] bg-accent/15 text-accent rounded-md px-2 py-0.5 font-mono">
                            {tech}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <GlowButton variant="ghost" onClick={() => setShowAdd(false)} className="flex-1">
                  Cancel
                </GlowButton>
                <GlowButton
                  variant="primary"
                  onClick={handleAddProject}
                  disabled={!newName.trim() || !newPath.trim()}
                  className="flex-1"
                >
                  Add Project
                </GlowButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
