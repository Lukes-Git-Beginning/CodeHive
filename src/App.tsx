import { useState, useEffect, lazy, Suspense } from 'react'
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
import { ResultsSummary } from './components/jarvis/ResultsSummary'
import type { AgentRun } from './types/agent'
import { useProjectStore } from './stores/projectStore'
import { useAgentStore } from './stores/agentStore'
import { useProfileStore } from './stores/profileStore'
import { useNotificationStore } from './stores/notificationStore'
import { quickScan } from './services/autoScan'
import { BrainCircuit, Settings, FolderPlus, Map, Brain, LayoutDashboard, X } from 'lucide-react'

// Lazy-loaded panels (opened as overlays)
const RoadmapView = lazy(() => import('./components/roadmap/RoadmapView').then(m => ({ default: m.RoadmapView })))
const KnowledgePanel = lazy(() => import('./components/knowledge/KnowledgePanel').then(m => ({ default: m.KnowledgePanel })))
const ProjectDashboard = lazy(() => import('./components/dashboard/ProjectDashboard').then(m => ({ default: m.ProjectDashboard })))

type OverlayPanel = 'roadmap' | 'knowledge' | 'dashboard' | null

function App() {
  const [showSettings, setShowSettings] = useState(false)
  const [isMindPalaceOpen, setIsMindPalaceOpen] = useState(false)
  const [completedRun, setCompletedRun] = useState<AgentRun | null>(null)
  const [overlayPanel, setOverlayPanel] = useState<OverlayPanel>(null)
  const activeProjectId = useProjectStore((s) => s.activeProjectId)
  const initialized = useProjectStore((s) => s.initialized)
  const initialize = useProjectStore((s) => s.initialize)
  const phase = useAgentStore((s) => s.phase)
  const pendingPlan = useAgentStore((s) => s.pendingPlan)
  const approvePlan = useAgentStore((s) => s.approvePlan)
  const rejectPlan = useAgentStore((s) => s.rejectPlan)
  const runHistory = useAgentStore((s) => s.runHistory)
  const activeProject = useProjectStore((s) => s.getActiveProject())

  // Show results summary when a run completes
  useEffect(() => {
    if (phase === 'done' && runHistory.length > 0 && !completedRun) {
      setCompletedRun(runHistory[0])
    }
  }, [phase, runHistory, completedRun])

  // Init
  const loadProfile = useProfileStore((s) => s.loadProfile)
  useEffect(() => { initialize(); loadProfile() }, [initialize, loadProfile])

  // AutoScan on project switch
  useEffect(() => {
    if (!activeProject) return
    quickScan(activeProject).then((results) => {
      const notify = useNotificationStore.getState().addNotification
      for (const r of results.slice(0, 2)) {
        notify(r.type === 'warning' ? 'warning' : 'info', `${r.title}: ${r.detail}`)
      }
    })
  }, [activeProject?.id])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'r') { e.preventDefault(); setOverlayPanel(overlayPanel === 'roadmap' ? null : 'roadmap') }
        if (e.key === 'k') { e.preventDefault(); setOverlayPanel(overlayPanel === 'knowledge' ? null : 'knowledge') }
        if (e.key === 'd') { e.preventDefault(); setOverlayPanel(overlayPanel === 'dashboard' ? null : 'dashboard') }
        if (e.key === 'm') { e.preventDefault(); setIsMindPalaceOpen((p) => !p) }
      }
      if (e.key === 'Escape') {
        setOverlayPanel(null)
        setIsMindPalaceOpen(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [overlayPanel])

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
          <p className="font-hud text-xs text-accent text-glow-green">Metis wird initialisiert...</p>
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
        <button
          onClick={() => setShowSettings(true)}
          className="absolute bottom-6 right-6 z-30 p-3 glass-elevated rounded-full text-text-muted hover:text-accent neon-hover transition-all"
        >
          <Settings className="w-5 h-5" />
        </button>
        <SettingsModal show={showSettings} onClose={() => setShowSettings(false)} />
        <ToastContainer />
      </div>
    )
  }

  // ── METIS LAYOUT ──
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
          title="Mind Palace (Ctrl+M)"
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
      <main className="w-full h-full flex flex-col items-center justify-center relative z-20 px-8 pt-16 pb-14 overflow-hidden">
        <ErrorBoundary label="Metis">
          {/* Thought Nodes */}
          <ThoughtNodes onOpenMindPalace={() => setIsMindPalaceOpen(true)} />

          <div className="relative flex flex-col items-center w-full max-w-4xl">
            {/* Proactive Suggestions */}
            <ProactiveSuggestions />

            {/* Core Sphere */}
            <JarvisCore />

            {/* Plan Approval */}
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

      {/* Results Summary Modal */}
      <AnimatePresence>
        {completedRun && (
          <ResultsSummary
            run={completedRun}
            onClose={() => setCompletedRun(null)}
          />
        )}
      </AnimatePresence>

      {/* Overlay Panels (Roadmap, Knowledge, Dashboard) */}
      <AnimatePresence>
        {overlayPanel && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6"
            onClick={() => setOverlayPanel(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-elevated rounded-2xl w-full max-w-5xl h-[80vh] overflow-hidden flex flex-col"
            >
              <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
                <span className="font-hud text-xs text-accent">
                  {overlayPanel === 'roadmap' && 'Roadmap'}
                  {overlayPanel === 'knowledge' && 'Knowledge Base'}
                  {overlayPanel === 'dashboard' && 'Dashboard'}
                </span>
                <button
                  onClick={() => setOverlayPanel(null)}
                  className="p-1.5 hover:bg-bg-surface rounded-lg text-text-muted hover:text-text-primary transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <ErrorBoundary label={overlayPanel}>
                  <Suspense fallback={<div className="flex items-center justify-center h-full"><span className="text-text-muted font-mono text-xs">Laden...</span></div>}>
                    {overlayPanel === 'roadmap' && <RoadmapView />}
                    {overlayPanel === 'knowledge' && <KnowledgePanel />}
                    {overlayPanel === 'dashboard' && <ProjectDashboard />}
                  </Suspense>
                </ErrorBoundary>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick-Access Bar (above StatusBar) */}
      <div className="absolute bottom-7 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1.5">
        <button
          onClick={() => setOverlayPanel('dashboard')}
          className={`p-2 rounded-lg transition-all ${overlayPanel === 'dashboard' ? 'glass-accent text-accent' : 'glass text-text-muted hover:text-accent neon-hover'}`}
          title="Dashboard (Ctrl+D)"
        >
          <LayoutDashboard className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => setOverlayPanel('roadmap')}
          className={`p-2 rounded-lg transition-all ${overlayPanel === 'roadmap' ? 'glass-accent text-accent' : 'glass text-text-muted hover:text-accent neon-hover'}`}
          title="Roadmap (Ctrl+R)"
        >
          <Map className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => setOverlayPanel('knowledge')}
          className={`p-2 rounded-lg transition-all ${overlayPanel === 'knowledge' ? 'glass-accent text-accent' : 'glass text-text-muted hover:text-accent neon-hover'}`}
          title="Knowledge (Ctrl+K)"
        >
          <Brain className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Status Bar */}
      <div className="absolute bottom-0 w-full h-7 glass flex items-center justify-between px-4 z-30 border-t border-border">
        <span className="text-[9px] font-hud text-text-muted">METIS v1.0</span>
        <div className="flex items-center gap-4">
          {activeProject && (
            <span className="text-[9px] font-mono text-text-muted">
              {activeProject.name}
              {phase !== 'idle' && phase !== 'done' && (
                <span className="text-cyan ml-2">{phase.toUpperCase().replace('_', ' ')}</span>
              )}
            </span>
          )}
          <span className="flex items-center gap-1.5 text-[9px] font-mono text-accent">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            ONLINE
          </span>
        </div>
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
