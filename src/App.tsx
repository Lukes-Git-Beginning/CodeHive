import { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ProjectSelector } from './components/projects/ProjectSelector'
import { SettingsPanel } from './components/settings/SettingsPanel'
import { ErrorBoundary } from './components/ui/ErrorBoundary'
import { ToastContainer } from './components/ui/Toast'
import { JarvisCore } from './components/jarvis/JarvisCore'
import { Omnibox } from './components/jarvis/Omnibox'
import { ProactiveSuggestions } from './components/jarvis/ProactiveSuggestions'
import { ConversationStream } from './components/jarvis/ConversationStream'
import { MindPalace } from './components/jarvis/MindPalace'
import { ProjectBar } from './components/jarvis/ProjectBar'
import { ThoughtNodes } from './components/jarvis/ThoughtNodes'
import { useProjectStore } from './stores/projectStore'
import { useAgentStore } from './stores/agentStore'
import { BrainCircuit, Settings, FolderPlus } from 'lucide-react'

function App() {
  const [showSettings, setShowSettings] = useState(false)
  const [isMindPalaceOpen, setIsMindPalaceOpen] = useState(false)
  const activeProjectId = useProjectStore((s) => s.activeProjectId)
  const initialized = useProjectStore((s) => s.initialized)
  const initialize = useProjectStore((s) => s.initialize)
  const pendingPlan = useAgentStore((s) => s.pendingPlan)
  const approvePlan = useAgentStore((s) => s.approvePlan)
  const rejectPlan = useAgentStore((s) => s.rejectPlan)

  useEffect(() => { initialize() }, [initialize])

  // Loading state
  if (!initialized) {
    return (
      <div className="flex items-center justify-center h-screen bg-bg-deep grid-bg">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            className="w-10 h-10 border-2 border-accent border-t-transparent rounded-full mx-auto mb-4"
          />
          <p className="font-hud text-xs text-accent text-glow-green">Initializing Systems...</p>
        </motion.div>
      </div>
    )
  }

  // No project selected → project selector
  if (!activeProjectId) {
    return (
      <div className="relative w-screen h-screen bg-bg-deep grid-bg overflow-hidden">
        <div className="flex-1 flex flex-col h-full">
          <ProjectSelector onProjectSelect={() => {}} />
        </div>

        {/* Settings button */}
        <button
          onClick={() => setShowSettings(true)}
          className="absolute bottom-6 right-6 z-30 p-3 glass-elevated rounded-full text-text-muted hover:text-accent neon-hover transition-all"
        >
          <Settings className="w-5 h-5" />
        </button>

        {/* Settings Modal */}
        <SettingsModal show={showSettings} onClose={() => setShowSettings(false)} />
        <ToastContainer />
      </div>
    )
  }

  // ── JARVIS LAYOUT ──
  return (
    <div className="relative w-screen h-screen bg-bg-deep grid-bg overflow-hidden">
      {/* Project Context Bar */}
      <ProjectBar />

      {/* Top-right controls */}
      <div className="absolute right-6 top-5 z-30 flex items-center gap-2">
        <button
          onClick={() => useProjectStore.getState().setActiveProject(null)}
          className="p-2.5 glass-elevated rounded-full text-text-muted hover:text-accent neon-hover transition-all"
          title="Projekt wechseln"
        >
          <FolderPlus className="w-4 h-4" />
        </button>
        <button
          onClick={() => setShowSettings(true)}
          className="p-2.5 glass-elevated rounded-full text-text-muted hover:text-accent neon-hover transition-all"
          title="Einstellungen"
        >
          <Settings className="w-4 h-4" />
        </button>
        <button
          onClick={() => setIsMindPalaceOpen(true)}
          className="p-2.5 glass-elevated rounded-full text-text-secondary hover:text-violet neon-hover transition-all group"
          title="Mind Palace"
        >
          <BrainCircuit className="w-4 h-4 group-hover:animate-pulse-glow" />
        </button>
      </div>

      {/* Mind Palace Overlay */}
      <MindPalace
        isOpen={isMindPalaceOpen}
        onClose={() => setIsMindPalaceOpen(false)}
      />

      {/* Main Interaction Area */}
      <main className="w-full h-full flex flex-col items-center justify-center relative z-20 px-8 pt-16 pb-10 overflow-y-auto">
        <ErrorBoundary label="Jarvis">
          <div className="relative flex flex-col items-center w-full max-w-4xl">
            {/* Proactive Suggestions */}
            <ProactiveSuggestions />

            {/* Core Sphere + Thought Nodes */}
            <div className="relative">
              <JarvisCore />
              <ThoughtNodes />
            </div>

            {/* Plan Approval (inline) */}
            <AnimatePresence>
              {pendingPlan && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="w-full max-w-2xl glass-accent rounded-xl p-5 mb-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-hud text-[10px] text-accent">
                      {pendingPlan.tasks.length} Tasks · {pendingPlan.waveCount} Wellen
                    </span>
                  </div>
                  <div className="space-y-1.5 mb-4 max-h-40 overflow-y-auto">
                    {pendingPlan.tasks.map((task) => (
                      <div key={task.id} className="flex items-center gap-2 text-[10px] glass rounded-md px-3 py-2">
                        <span className="text-text-primary flex-1 truncate">{task.name}</span>
                        {task.role && (
                          <span className="font-mono text-[8px] text-text-muted bg-bg-surface px-1 rounded">{task.role}</span>
                        )}
                        <span className="font-mono text-[8px] text-cyan">{task.model}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={approvePlan}
                      className="flex-1 py-2 rounded-lg bg-accent/15 border border-accent/30 text-accent text-xs font-hud
                                 hover:bg-accent/25 hover:shadow-[0_0_20px_rgba(0,255,136,0.3)] transition-all"
                    >
                      Execute
                    </button>
                    <button
                      onClick={rejectPlan}
                      className="flex-1 py-2 rounded-lg bg-danger-dim border border-danger/30 text-danger text-xs font-hud
                                 hover:bg-danger/25 hover:shadow-[0_0_20px_rgba(255,51,102,0.3)] transition-all"
                    >
                      Abort
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Omnibox */}
            <div className="w-full relative z-30">
              <Omnibox />
            </div>

            {/* Conversation Stream */}
            <ConversationStream />
          </div>
        </ErrorBoundary>
      </main>

      {/* Minimal Status Bar */}
      <div className="absolute bottom-0 w-full h-7 glass flex items-center justify-between px-4 z-40 border-t border-border">
        <span className="text-[9px] font-hud text-text-muted">CODEHIVE v2.0</span>
        <span className="flex items-center gap-1.5 text-[9px] font-mono text-accent">
          <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
          ONLINE
        </span>
      </div>

      {/* Settings Modal */}
      <SettingsModal show={showSettings} onClose={() => setShowSettings(false)} />

      {/* Toast Notifications */}
      <ToastContainer />
    </div>
  )
}

function SettingsModal({ show, onClose }: { show: boolean; onClose: () => void }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="glass-elevated rounded-2xl w-full max-w-xl max-h-[80vh] overflow-hidden"
          >
            <SettingsPanel />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default App
