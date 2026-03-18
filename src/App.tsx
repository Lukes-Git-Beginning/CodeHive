import { useState, useEffect, lazy, Suspense } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { invoke } from '@tauri-apps/api/core'
import { FirstRunWizard } from './components/onboarding/FirstRunWizard'
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
import { CommandPalette } from './components/jarvis/CommandPalette'
import type { AgentRun } from './types/agent'
import { useProjectStore } from './stores/projectStore'
import { useAgentStore } from './stores/agentStore'
import { useProfileStore } from './stores/profileStore'
import { useNotificationStore } from './stores/notificationStore'
import { useChatStore } from './stores/chatStore'
import { quickScan } from './services/autoScan'
import { captureAndAnalyze } from './services/vision'
import { orchestrate } from './services/orchestrator'
import { startClipboardMonitor, stopClipboardMonitor } from './services/clipboard'
import { triggerSelfImprovement } from './services/selfImprove'
import { useGitStore } from './stores/gitStore'
import { useSchedulerStore } from './stores/schedulerStore'
import { useThemeStore } from './stores/themeStore'
import { NotificationCenter } from './components/ui/NotificationCenter'
import { ShortcutOverlay } from './components/ui/ShortcutOverlay'
import { BrainCircuit, Settings, FolderPlus, Map, Brain, LayoutDashboard, X, Bell, Cpu, ScrollText } from 'lucide-react'

// Lazy-loaded panels (opened as overlays)
const RoadmapView = lazy(() => import('./components/roadmap/RoadmapView').then(m => ({ default: m.RoadmapView })))
const KnowledgePanel = lazy(() => import('./components/knowledge/KnowledgePanel').then(m => ({ default: m.KnowledgePanel })))
const ProjectDashboard = lazy(() => import('./components/dashboard/MetricsDashboard').then(m => ({ default: m.MetricsDashboard })))
const TemplateSelectorPanel = lazy(() => import('./components/ui/TemplateSelector').then(m => ({ default: m.TemplateSelector })))
const AgentsPanel = lazy(() => import('./components/agents/AgentsPanel').then(m => ({ default: m.AgentsPanel })))
const LogsPanel = lazy(() => import('./components/logs/LogsPanel').then(m => ({ default: m.LogsPanel })))

type OverlayPanel = 'roadmap' | 'knowledge' | 'dashboard' | 'templates' | 'agents' | 'logs' | null

function App() {
  const [showWizard, setShowWizard] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [isMindPalaceOpen, setIsMindPalaceOpen] = useState(false)
  const [completedRun, setCompletedRun] = useState<AgentRun | null>(null)
  const [overlayPanel, setOverlayPanel] = useState<OverlayPanel>(null)
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  const [isNotifCenterOpen, setIsNotifCenterOpen] = useState(false)
  const [showShortcutOverlay, setShowShortcutOverlay] = useState(false)
  const activeProjectId = useProjectStore((s) => s.activeProjectId)
  const initialized = useProjectStore((s) => s.initialized)
  const initialize = useProjectStore((s) => s.initialize)
  const phase = useAgentStore((s) => s.phase)
  const pendingPlan = useAgentStore((s) => s.pendingPlan)
  const approvePlan = useAgentStore((s) => s.approvePlan)
  const rejectPlan = useAgentStore((s) => s.rejectPlan)
  const latestRun = useAgentStore((s) => s.runHistory[0] ?? null)
  const activeProject = useProjectStore((s) => s.getActiveProject())

  // Show results summary when a run completes
  useEffect(() => {
    if (phase === 'done' && latestRun && !completedRun) {
      setCompletedRun(latestRun)
    }
  }, [phase, latestRun, completedRun])

  // Init
  const loadProfile = useProfileStore((s) => s.loadProfile)
  useEffect(() => {
    initialize()
    loadProfile()
    useThemeStore.getState().loadTheme()
    useSchedulerStore.getState().start()
    invoke('get_setting', { key: 'onboarding_completed' }).then((val) => {
      if (!val) setShowWizard(true)
    }).catch(() => setShowWizard(true))
    return () => useSchedulerStore.getState().stop()
  }, [initialize, loadProfile])

  // Load chat messages on project switch
  const loadMessages = useChatStore((s) => s.loadMessages)
  useEffect(() => {
    if (activeProjectId) loadMessages(activeProjectId)
  }, [activeProjectId, loadMessages])

  // Clipboard monitoring — detect code and suggest analysis
  useEffect(() => {
    if (!activeProjectId) return
    startClipboardMonitor((code) => {
      useNotificationStore.getState().addNotification(
        'info',
        `Code im Clipboard erkannt (${code.split('\n').length} Zeilen) — füge ihn in die Omnibox ein um ihn zu analysieren.`
      )
    })
    return () => stopClipboardMonitor()
  }, [activeProjectId])

  // Git polling on project switch
  useEffect(() => {
    if (activeProject) {
      useGitStore.getState().startPolling(activeProject.path)
    } else {
      useGitStore.getState().clear()
    }
    return () => useGitStore.getState().stopPolling()
  }, [activeProjectId])

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
  const unreadCount = useNotificationStore((s) => s.notifications.filter((n) => !n.dismissed).length)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.shiftKey && e.key === 'T') { e.preventDefault(); useThemeStore.getState().toggleTheme(); return }
        if (e.shiftKey && e.key === 'S') { e.preventDefault(); captureAndAnalyze(); return }
        if (e.key === 'r') { e.preventDefault(); setOverlayPanel(overlayPanel === 'roadmap' ? null : 'roadmap') }
        if (e.key === 'k') { e.preventDefault(); setOverlayPanel(overlayPanel === 'knowledge' ? null : 'knowledge') }
        if (e.key === 'd') { e.preventDefault(); setOverlayPanel(overlayPanel === 'dashboard' ? null : 'dashboard') }
        if (e.key === 'm') { e.preventDefault(); setIsMindPalaceOpen((p) => !p) }
        if (e.key === 'n') { e.preventDefault(); setIsNotifCenterOpen((p) => !p) }
        if (e.key === 't') { e.preventDefault(); setOverlayPanel(overlayPanel === 'templates' ? null : 'templates') }
        if (e.key === ',') { e.preventDefault(); setShowSettings((p) => !p) }
        if (e.key === 'p') { e.preventDefault(); setShowCommandPalette((p) => !p) }
      }
      // ? for shortcut overlay (only when no input focused)
      if (e.key === '?' && !['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault()
        setShowShortcutOverlay((p) => !p)
      }
      if (e.key === 'Escape') {
        if (showShortcutOverlay) { setShowShortcutOverlay(false); return }
        if (isNotifCenterOpen) { setIsNotifCenterOpen(false); return }
        setOverlayPanel(null)
        setIsMindPalaceOpen(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [overlayPanel, showShortcutOverlay, isNotifCenterOpen])

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
          <p className="font-hud text-xs text-accent holo-text">Metis wird initialisiert...</p>
        </motion.div>
      </div>
    )
  }

  // First-run wizard
  if (showWizard && !activeProjectId) {
    return (
      <div className="relative w-screen h-screen bg-bg-deep grid-bg overflow-hidden">
        <FirstRunWizard onComplete={() => setShowWizard(false)} />
        <ToastContainer />
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
      <div className="absolute right-6 top-5 z-30 flex items-center gap-2.5">
        <button
          onClick={() => useProjectStore.getState().setActiveProject(null)}
          className="p-3 glass-holo rounded-sm text-text-muted hover:text-accent transition-all hover:shadow-[0_0_15px_rgba(0,212,255,0.15)]"
          title="Projekt wechseln"
        >
          <FolderPlus className="w-5 h-5" />
        </button>
        <button
          onClick={() => setIsNotifCenterOpen(true)}
          className="p-3 glass-holo rounded-sm text-text-muted hover:text-cyan transition-all hover:shadow-[0_0_15px_rgba(0,212,255,0.15)] relative"
          title="Benachrichtigungen (Ctrl+N)"
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 rounded-full bg-danger text-[9px] text-white flex items-center justify-center font-mono">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setShowSettings(true)}
          className="p-3 glass-holo rounded-sm text-text-muted hover:text-accent transition-all hover:shadow-[0_0_15px_rgba(0,212,255,0.15)]"
          title="Einstellungen (Ctrl+,)"
        >
          <Settings className="w-5 h-5" />
        </button>
        <button
          onClick={() => setIsMindPalaceOpen(true)}
          className="p-3 glass-holo rounded-sm text-text-secondary hover:text-violet transition-all hover:shadow-[0_0_15px_rgba(123,97,255,0.15)] group"
          title="Mind Palace (Ctrl+M)"
        >
          <BrainCircuit className="w-5 h-5 group-hover:animate-pulse-glow" />
        </button>
      </div>

      {/* Mind Palace Overlay */}
      <MindPalace
        isOpen={isMindPalaceOpen}
        onClose={() => setIsMindPalaceOpen(false)}
      />

      {/* Notification Center */}
      <NotificationCenter
        isOpen={isNotifCenterOpen}
        onClose={() => setIsNotifCenterOpen(false)}
      />

      {/* Shortcut Overlay */}
      <ShortcutOverlay
        isOpen={showShortcutOverlay}
        onClose={() => setShowShortcutOverlay(false)}
      />

      {/* Main Interaction Area */}
      <main className="w-full h-full flex flex-col items-center justify-center relative z-20 px-4 pt-14 pb-12 overflow-hidden">
        <ErrorBoundary label="Metis">
          {/* Thought Nodes */}
          <ThoughtNodes onOpenMindPalace={() => setIsMindPalaceOpen(true)} />

          <div className="relative flex flex-col items-center w-full max-w-4xl mx-auto">
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
                  className="w-full max-w-2xl hud-panel hud-brackets p-5 mb-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-hud text-[10px] text-accent">
                      {pendingPlan.tasks.length} Tasks · {pendingPlan.waveCount} Wellen
                    </span>
                  </div>
                  <div className="space-y-1.5 mb-4 max-h-40 overflow-y-auto">
                    {pendingPlan.tasks.map((task) => (
                      <div key={task.id} className="flex items-center gap-2 text-[10px] glass-holo rounded-sm px-3 py-2">
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
                      className="flex-1 py-2 rounded-sm bg-accent/15 border border-accent/30 text-accent text-xs font-hud
                                 hover:bg-accent/25 hover:shadow-[0_0_20px_rgba(0,212,255,0.3)] transition-all"
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
            onClose={() => { setCompletedRun(null); useAgentStore.getState().setPhase('idle') }}
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
              className="hud-panel hud-brackets w-full max-w-5xl h-[80vh] overflow-hidden flex flex-col"
            >
              <div className="flex items-center justify-between p-4 border-b border-cyan/10 shrink-0">
                <span className="font-hud text-xs text-accent">
                  {overlayPanel === 'roadmap' && 'Roadmap'}
                  {overlayPanel === 'knowledge' && 'Knowledge Base'}
                  {overlayPanel === 'dashboard' && 'Dashboard'}
                  {overlayPanel === 'templates' && 'Agent Templates'}
                  {overlayPanel === 'agents' && 'Agents'}
                  {overlayPanel === 'logs' && 'Run Logs'}
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
                    {overlayPanel === 'templates' && <TemplateSelectorPanel />}
                    {overlayPanel === 'agents' && <AgentsPanel />}
                    {overlayPanel === 'logs' && <LogsPanel />}
                  </Suspense>
                </ErrorBoundary>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Navigation Bar */}
      <div className="absolute bottom-0 w-full h-10 z-40 flex items-center justify-between px-4"
        style={{
          background: 'linear-gradient(0deg, rgba(10, 14, 39, 0.95) 0%, rgba(10, 14, 39, 0.7) 100%)',
          borderTop: '1px solid rgba(0, 212, 255, 0.08)',
        }}
      >
        {/* Left: Navigation tabs */}
        <div className="flex items-center gap-0.5">
          {([
            { id: 'dashboard' as const, label: 'DASHBOARD', icon: LayoutDashboard },
            { id: 'roadmap' as const, label: 'ROADMAP', icon: Map },
            { id: 'knowledge' as const, label: 'KNOWLEDGE', icon: Brain },
            { id: 'agents' as const, label: 'AGENTS', icon: Cpu },
            { id: 'logs' as const, label: 'LOGS', icon: ScrollText },
          ]).map((tab) => {
            const isTabActive = overlayPanel === tab.id
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setOverlayPanel(isTabActive ? null : tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition-all font-hud text-[9px] tracking-wider ${
                  isTabActive
                    ? 'text-accent bg-accent/10 shadow-[0_0_10px_rgba(0,212,255,0.1)]'
                    : 'text-text-muted hover:text-text-secondary hover:bg-white/5'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Right: Status */}
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-[9px] font-hud text-accent">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            API: OK
          </span>
          <span className="text-[9px] font-mono text-text-muted">
            {new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>

      {/* Command Palette */}
      <CommandPalette
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        onOpenPanel={setOverlayPanel}
        onOpenSettings={() => setShowSettings(true)}
        onOpenMindPalace={() => setIsMindPalaceOpen(true)}
        onOpenNotifications={() => setIsNotifCenterOpen(true)}
        onSelfImprove={() => triggerSelfImprovement()}
        onSwitchProject={() => useProjectStore.getState().setActiveProject(null)}
        onScreenshot={() => captureAndAnalyze()}
        onOrchestrate={(prompt) => {
          if (activeProject) {
            const chatStore = useChatStore.getState()
            chatStore.addMessage({ id: crypto.randomUUID(), role: 'user', content: prompt, timestamp: new Date().toISOString() })
            chatStore.setProcessing(true)
            orchestrate(prompt, activeProject).catch(() => chatStore.setProcessing(false))
          }
        }}
        onClearChat={() => useChatStore.getState().clearMessages()}
      />

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
            className="hud-panel hud-brackets w-full max-w-xl max-h-[80vh] overflow-hidden"
          >
            <SettingsPanel />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default App
