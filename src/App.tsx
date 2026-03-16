import { useState, useEffect, Component, type ReactNode, type ErrorInfo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Sidebar } from './components/layout/Sidebar'
import { StatusBar } from './components/layout/StatusBar'
import { ChatPanel } from './components/chat/ChatPanel'
import { AgentMonitor } from './components/agents/AgentMonitor'
import { OfficeView } from './components/office/OfficeView'
import { ProjectSelector } from './components/projects/ProjectSelector'
import { RoadmapView } from './components/roadmap/RoadmapView'
import { SettingsPanel } from './components/settings/SettingsPanel'
import { ProjectDashboard } from './components/dashboard/ProjectDashboard'
import { useProjectStore } from './stores/projectStore'
import { useAgentStore } from './stores/agentStore'
import { ScanLine } from './components/ui/ScanLine'
import { Monitor, Gamepad2, MessageSquare, LayoutDashboard, Map, AlertTriangle } from 'lucide-react'

type MainTab = 'dashboard' | 'chat' | 'office' | 'roadmap'

// ── Error Boundary ──
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) { return { error } }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('UI Error:', error, info) }
  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center">
          <AlertTriangle className="w-10 h-10 text-danger mb-3" />
          <p className="font-hud text-xs text-danger mb-2">System Error</p>
          <p className="text-xs text-text-muted max-w-md font-mono mb-4">{this.state.error.message}</p>
          <button
            onClick={() => this.setState({ error: null })}
            className="glass neon-hover rounded-lg px-4 py-2 text-xs text-accent font-hud"
          >
            Retry
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

function App() {
  const [mainTab, setMainTab] = useState<MainTab>('dashboard')
  const [showSettings, setShowSettings] = useState(false)
  const activeProjectId = useProjectStore((s) => s.activeProjectId)
  const initialized = useProjectStore((s) => s.initialized)
  const initialize = useProjectStore((s) => s.initialize)
  const phase = useAgentStore((s) => s.phase)
  const isRunning = phase !== 'idle' && phase !== 'done'

  useEffect(() => { initialize() }, [initialize])

  // Auto-switch to chat when agents start running
  useEffect(() => {
    if (isRunning && mainTab !== 'chat') setMainTab('chat')
  }, [isRunning])

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

  // No project selected → show project selector
  if (!activeProjectId) {
    return (
      <div className="flex h-screen grid-bg">
        <Sidebar onShowSettings={() => setShowSettings(true)} onAddProject={() => useProjectStore.getState().setActiveProject(null)} />
        <div className="flex-1 flex flex-col min-w-0 relative z-10">
          <main className="flex-1"><ProjectSelector onProjectSelect={() => setMainTab('dashboard')} /></main>
          <StatusBar />
        </div>
      </div>
    )
  }

  const mainTabs: { id: MainTab; icon: typeof MessageSquare; label: string }[] = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'chat', icon: MessageSquare, label: 'Chat' },
    { id: 'office', icon: Gamepad2, label: 'Office' },
    { id: 'roadmap', icon: Map, label: 'Roadmap' },
  ]

  return (
    <div className="flex h-screen grid-bg">
      <Sidebar
        onShowSettings={() => setShowSettings(true)}
        onAddProject={() => useProjectStore.getState().setActiveProject(null)}
      />

      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        <div className="flex flex-1 min-h-0">
          {/* Main Content Area */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Main Tab Bar */}
            <div className="flex border-b border-border glass shrink-0">
              {mainTabs.map(({ id, icon: Icon, label }) => (
                <button
                  key={id}
                  onClick={() => setMainTab(id)}
                  className={`flex items-center gap-2 px-5 py-2.5 text-[11px] font-hud tracking-wider transition-all ${
                    mainTab === id
                      ? 'text-accent border-b border-accent bg-accent/5'
                      : 'text-text-muted hover:text-text-secondary hover:bg-bg-hover'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                  {id === 'chat' && isRunning && (
                    <div className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse" />
                  )}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 min-h-0">
              <ErrorBoundary>
                {mainTab === 'chat' && <ChatPanel />}
                {mainTab === 'dashboard' && <ProjectDashboard />}
                {mainTab === 'office' && <OfficeView />}
                {mainTab === 'roadmap' && <RoadmapView />}
              </ErrorBoundary>
            </div>
          </div>

          {/* Right Panel: Agent Monitor */}
          <div className="w-72 shrink-0 flex flex-col glass-elevated border-l border-border relative">
            {isRunning && <ScanLine duration={4} />}
            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border">
              <Monitor className="w-3.5 h-3.5 text-accent" />
              <span className="font-hud text-[10px] text-accent">Agent Monitor</span>
            </div>
            <div className="flex-1 min-h-0">
              <ErrorBoundary>
                <AgentMonitor />
              </ErrorBoundary>
            </div>
          </div>
        </div>

        <StatusBar />
      </div>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center"
            onClick={() => setShowSettings(false)}
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
    </div>
  )
}

export default App
