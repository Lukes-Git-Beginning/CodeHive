import { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Sidebar } from './components/layout/Sidebar'
import { StatusBar } from './components/layout/StatusBar'
import { ChatPanel } from './components/chat/ChatPanel'
import { AgentMonitor } from './components/agents/AgentMonitor'
import { OfficeView } from './components/office/OfficeView'
import { ProjectSelector } from './components/projects/ProjectSelector'
import { RoadmapView } from './components/roadmap/RoadmapView'
import { SettingsPanel } from './components/settings/SettingsPanel'
import { useProjectStore } from './stores/projectStore'
import { useAgentStore } from './stores/agentStore'
import { ScanLine } from './components/ui/ScanLine'
import { Monitor, Gamepad2 } from 'lucide-react'

type View = 'projects' | 'roadmap' | 'settings'
type RightPanel = 'monitor' | 'office'

function App() {
  const [currentView, setCurrentView] = useState<View>('projects')
  const [rightPanel, setRightPanel] = useState<RightPanel>('monitor')
  const activeProjectId = useProjectStore((s) => s.activeProjectId)
  const initialized = useProjectStore((s) => s.initialized)
  const initialize = useProjectStore((s) => s.initialize)
  const phase = useAgentStore((s) => s.phase)
  const isRunning = phase !== 'idle' && phase !== 'done'

  useEffect(() => {
    initialize()
  }, [initialize])

  if (!initialized) {
    return (
      <div className="flex items-center justify-center h-screen bg-bg-deep grid-bg">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
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

  const renderRightPanel = () => (
    <div className="w-80 shrink-0 flex flex-col glass-elevated border-l border-border relative">
      {/* Scan line when running */}
      {isRunning && <ScanLine duration={4} />}

      {/* Panel Toggle */}
      <div className="flex border-b border-border">
        {[
          { id: 'monitor' as RightPanel, icon: Monitor, label: 'Monitor' },
          { id: 'office' as RightPanel, icon: Gamepad2, label: 'Pixel Office' },
        ].map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => setRightPanel(id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-medium transition-all ${
              rightPanel === id
                ? 'text-accent border-b border-accent bg-accent/5'
                : 'text-text-muted hover:text-text-secondary hover:bg-bg-hover'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={rightPanel}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="h-full"
          >
            {rightPanel === 'monitor' ? <AgentMonitor /> : <OfficeView />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )

  const renderMainContent = () => {
    if (currentView === 'roadmap') return <RoadmapView />
    if (currentView === 'settings') return <SettingsPanel />

    if (!activeProjectId) {
      return <ProjectSelector onProjectSelect={() => setCurrentView('projects')} />
    }

    return (
      <div className="flex flex-1 min-w-0">
        <div className="flex-1 min-w-0">
          <ChatPanel />
        </div>
        {renderRightPanel()}
      </div>
    )
  }

  return (
    <div className="flex h-screen grid-bg">
      <Sidebar
        currentView={currentView}
        onViewChange={setCurrentView}
        onAddProject={() => {
          setCurrentView('projects')
          useProjectStore.getState().setActiveProject(null)
        }}
      />
      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        <main className="flex-1 flex flex-col min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentView + (activeProjectId || 'none')}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="flex-1 flex flex-col min-w-0"
            >
              {renderMainContent()}
            </motion.div>
          </AnimatePresence>
        </main>
        <StatusBar />
      </div>
    </div>
  )
}

export default App
