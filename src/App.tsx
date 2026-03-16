import { useState, useEffect } from 'react'
import { Sidebar } from './components/layout/Sidebar'
import { ChatPanel } from './components/chat/ChatPanel'
import { AgentMonitor } from './components/agents/AgentMonitor'
import { OfficeView } from './components/office/OfficeView'
import { ProjectSelector } from './components/projects/ProjectSelector'
import { RoadmapView } from './components/roadmap/RoadmapView'
import { SettingsPanel } from './components/settings/SettingsPanel'
import { StatusBar } from './components/layout/StatusBar'
import { useProjectStore } from './stores/projectStore'
import { Monitor, Gamepad2 } from 'lucide-react'

type View = 'projects' | 'roadmap' | 'settings'
type RightPanel = 'monitor' | 'office'

function App() {
  const [currentView, setCurrentView] = useState<View>('projects')
  const [rightPanel, setRightPanel] = useState<RightPanel>('monitor')
  const activeProjectId = useProjectStore((s) => s.activeProjectId)
  const initialized = useProjectStore((s) => s.initialized)
  const initialize = useProjectStore((s) => s.initialize)

  useEffect(() => {
    initialize()
  }, [initialize])

  if (!initialized) {
    return (
      <div className="flex items-center justify-center h-screen bg-bg-primary">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-text-muted">CodeHive wird geladen...</p>
        </div>
      </div>
    )
  }

  const renderRightPanel = () => {
    return (
      <div className="w-80 shrink-0 flex flex-col">
        {/* Panel Toggle */}
        <div className="flex border-b border-border bg-bg-secondary">
          <button
            onClick={() => setRightPanel('monitor')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors ${
              rightPanel === 'monitor'
                ? 'text-accent border-b-2 border-accent'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
            Monitor
          </button>
          <button
            onClick={() => setRightPanel('office')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors ${
              rightPanel === 'office'
                ? 'text-accent border-b-2 border-accent'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            <Gamepad2 className="w-3.5 h-3.5" />
            Pixel Office
          </button>
        </div>
        {/* Panel Content */}
        <div className="flex-1 min-h-0">
          {rightPanel === 'monitor' ? <AgentMonitor /> : <OfficeView />}
        </div>
      </div>
    )
  }

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
    <div className="flex h-screen">
      <Sidebar
        currentView={currentView}
        onViewChange={setCurrentView}
        onAddProject={() => {
          setCurrentView('projects')
          useProjectStore.getState().setActiveProject(null)
        }}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 flex flex-col min-w-0 bg-bg-primary">
          {renderMainContent()}
        </main>
        <StatusBar />
      </div>
    </div>
  )
}

export default App
