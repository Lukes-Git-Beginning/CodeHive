import { useState, useEffect } from 'react'
import { Sidebar } from './components/layout/Sidebar'
import { ChatPanel } from './components/chat/ChatPanel'
import { AgentMonitor } from './components/agents/AgentMonitor'
import { ProjectSelector } from './components/projects/ProjectSelector'
import { RoadmapView } from './components/roadmap/RoadmapView'
import { SettingsPanel } from './components/settings/SettingsPanel'
import { useProjectStore } from './stores/projectStore'

type View = 'projects' | 'roadmap' | 'settings'

function App() {
  const [currentView, setCurrentView] = useState<View>('projects')
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
        <div className="w-80 shrink-0">
          <AgentMonitor />
        </div>
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
      <main className="flex-1 flex flex-col min-w-0 bg-bg-primary">
        {renderMainContent()}
      </main>
    </div>
  )
}

export default App
