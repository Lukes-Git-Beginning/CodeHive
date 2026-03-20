import { useState, useEffect, lazy, Suspense } from 'react'
import { createMemoryRouter, RouterProvider, Navigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { invoke } from '@tauri-apps/api/core'
import { FirstRunWizard } from './components/onboarding/FirstRunWizard'
import { ProjectSelector } from './components/projects/ProjectSelector'
import { SettingsPanel } from './components/settings/SettingsPanel'
import { ErrorBoundary } from './components/ui/ErrorBoundary'
import { ToastContainer } from './components/ui/Toast'
import { CommandPalette } from './components/jarvis/CommandPalette'
import { NotificationCenter } from './components/ui/NotificationCenter'
import { ShortcutOverlay } from './components/ui/ShortcutOverlay'
import { AppShell } from './components/metis/AppShell'
import { ChatPage } from './components/chat/ChatPage'
import { useProjectStore } from './stores/projectStore'
import { useProfileStore } from './stores/profileStore'
import { useNotificationStore } from './stores/notificationStore'
import { useChatStore } from './stores/chatStore'
import { useUIStore } from './stores/uiStore'
import { quickScan } from './services/autoScan'
import { captureAndAnalyze } from './services/vision'
import { orchestrate } from './services/orchestrator'
import { startClipboardMonitor, stopClipboardMonitor } from './services/clipboard'
import { triggerSelfImprovement } from './services/selfImprove'
import { useGitStore } from './stores/gitStore'
import { useSchedulerStore } from './stores/schedulerStore'
import { useThemeStore } from './stores/themeStore'
import { Settings, Loader2 } from 'lucide-react'

// Lazy-loaded pages
const KnowledgePanel = lazy(() => import('./components/knowledge/KnowledgePanel').then(m => ({ default: m.KnowledgePanel })))
const MetricsDashboard = lazy(() => import('./components/dashboard/MetricsDashboard').then(m => ({ default: m.MetricsDashboard })))
const AgentsPanel = lazy(() => import('./components/agents/AgentsPanel').then(m => ({ default: m.AgentsPanel })))
const LogsPanel = lazy(() => import('./components/logs/LogsPanel').then(m => ({ default: m.LogsPanel })))
const DeepScanPanel = lazy(() => import('./components/deepscan/DeepScanPanel').then(m => ({ default: m.DeepScanPanel })))
const RoadmapView = lazy(() => import('./components/roadmap/RoadmapView').then(m => ({ default: m.RoadmapView })))

function PageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-5 h-5 text-accent animate-spin" />
      </div>
    }>
      <ErrorBoundary label="page">
        <div className="h-full overflow-y-auto">
          {children}
        </div>
      </ErrorBoundary>
    </Suspense>
  )
}

const router = createMemoryRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/chat" replace /> },
      { path: 'chat', element: <ChatPage /> },
      { path: 'knowledge', element: <PageWrapper><KnowledgePanel /></PageWrapper> },
      { path: 'agents', element: <PageWrapper><AgentsPanel /></PageWrapper> },
      { path: 'dashboard', element: <PageWrapper><MetricsDashboard /></PageWrapper> },
      { path: 'logs', element: <PageWrapper><LogsPanel /></PageWrapper> },
      { path: 'deepscan', element: <PageWrapper><DeepScanPanel /></PageWrapper> },
      { path: 'roadmap', element: <PageWrapper><RoadmapView /></PageWrapper> },
    ],
  },
])

function App() {
  const [showWizard, setShowWizard] = useState(false)
  const activeProjectId = useProjectStore((s) => s.activeProjectId)
  const initialized = useProjectStore((s) => s.initialized)
  const initialize = useProjectStore((s) => s.initialize)
  const activeProject = useProjectStore((s) => s.getActiveProject())

  const settingsOpen = useUIStore((s) => s.settingsOpen)
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen)
  const commandPaletteOpen = useUIStore((s) => s.commandPaletteOpen)
  const setCommandPaletteOpen = useUIStore((s) => s.setCommandPaletteOpen)
  const notificationCenterOpen = useUIStore((s) => s.notificationCenterOpen)
  const setNotificationCenterOpen = useUIStore((s) => s.setNotificationCenterOpen)
  const shortcutOverlayOpen = useUIStore((s) => s.shortcutOverlayOpen)
  const setShortcutOverlayOpen = useUIStore((s) => s.setShortcutOverlayOpen)

  // Init
  const loadProfile = useProfileStore((s) => s.loadProfile)
  useEffect(() => {
    initialize()
    loadProfile()
    useThemeStore.getState().loadTheme()
    useUIStore.getState().loadUI()
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

  // Clipboard monitoring
  useEffect(() => {
    if (!activeProjectId) return
    startClipboardMonitor((code) => {
      useNotificationStore.getState().addNotification(
        'info',
        `Code im Clipboard erkannt (${code.split('\n').length} Zeilen) — füge ihn in den Chat ein um ihn zu analysieren.`
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
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.shiftKey && e.key === 'T') { e.preventDefault(); useThemeStore.getState().toggleTheme(); return }
        if (e.shiftKey && e.key === 'S') { e.preventDefault(); captureAndAnalyze(); return }
        if (e.key === 'n') { e.preventDefault(); setNotificationCenterOpen(!notificationCenterOpen) }
        if (e.key === ',') { e.preventDefault(); setSettingsOpen(!settingsOpen) }
        if (e.key === 'p') { e.preventDefault(); setCommandPaletteOpen(!commandPaletteOpen) }
      }
      if (e.key === '?' && !['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault()
        setShortcutOverlayOpen(!shortcutOverlayOpen)
      }
      if (e.key === 'Escape') {
        if (shortcutOverlayOpen) { setShortcutOverlayOpen(false); return }
        if (notificationCenterOpen) { setNotificationCenterOpen(false); return }
        if (commandPaletteOpen) { setCommandPaletteOpen(false); return }
        if (settingsOpen) { setSettingsOpen(false); return }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [settingsOpen, commandPaletteOpen, notificationCenterOpen, shortcutOverlayOpen])

  // Loading state
  if (!initialized) {
    return (
      <div className="flex items-center justify-center h-screen bg-bg-deep">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
          <Loader2 className="w-8 h-8 text-accent animate-spin mx-auto mb-4" />
          <p className="text-sm text-text-muted">Metis wird initialisiert...</p>
        </motion.div>
      </div>
    )
  }

  // First-run wizard
  if (showWizard && !activeProjectId) {
    return (
      <div className="relative w-screen h-screen bg-bg-deep overflow-hidden">
        <FirstRunWizard onComplete={() => setShowWizard(false)} />
        <ToastContainer />
      </div>
    )
  }

  // No project selected
  if (!activeProjectId) {
    return (
      <div className="relative w-screen h-screen bg-bg-deep overflow-hidden">
        <div className="flex-1 flex flex-col h-full">
          <ProjectSelector onProjectSelect={() => {}} />
        </div>
        <button
          onClick={() => setSettingsOpen(true)}
          aria-label="Einstellungen öffnen"
          className="absolute bottom-6 right-6 z-30 p-3 bg-bg-elevated rounded-xl border border-border text-text-muted hover:text-accent hover-lift transition-all"
        >
          <Settings className="w-5 h-5" />
        </button>
        <SettingsModal show={settingsOpen} onClose={() => setSettingsOpen(false)} />
        <ToastContainer />
      </div>
    )
  }

  // ── METIS LAYOUT (Router-based) ──
  return (
    <div className="relative w-screen h-screen bg-bg-deep overflow-hidden">
      <RouterProvider router={router} />

      {/* Notification Center */}
      <NotificationCenter
        isOpen={notificationCenterOpen}
        onClose={() => setNotificationCenterOpen(false)}
      />

      {/* Shortcut Overlay */}
      <ShortcutOverlay
        isOpen={shortcutOverlayOpen}
        onClose={() => setShortcutOverlayOpen(false)}
      />

      {/* Command Palette */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onOpenPanel={(panel) => {
          // Navigate via router
          if (panel) router.navigate(`/${panel}`)
          setCommandPaletteOpen(false)
        }}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenMindPalace={() => {}} // deprecated
        onOpenNotifications={() => setNotificationCenterOpen(true)}
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
      <SettingsModal show={settingsOpen} onClose={() => setSettingsOpen(false)} />

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
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Einstellungen"
            className="w-full max-w-xl max-h-[80vh] overflow-hidden rounded-xl bg-bg-deep border border-border shadow-floating"
          >
            <SettingsPanel />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default App
