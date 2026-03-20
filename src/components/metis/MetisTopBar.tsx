import { useLocation } from 'react-router-dom'
import { Bell, Search, Sun, Moon } from 'lucide-react'
import { useProjectStore } from '../../stores/projectStore'
import { useAgentStore } from '../../stores/agentStore'
import { useGitStore } from '../../stores/gitStore'
import { useThemeStore } from '../../stores/themeStore'
import { useUIStore } from '../../stores/uiStore'
import { useNotificationStore } from '../../stores/notificationStore'

const PAGE_TITLES: Record<string, string> = {
  '/chat': 'Chat',
  '/knowledge': 'Knowledge Base',
  '/agents': 'Agents',
  '/dashboard': 'Dashboard',
  '/logs': 'Logs',
  '/deepscan': 'Deep Scan',
  '/roadmap': 'Roadmap',
  '/settings': 'Einstellungen',
}

export function MetisTopBar() {
  const location = useLocation()
  const activeProject = useProjectStore((s) => s.getActiveProject())
  const phase = useAgentStore((s) => s.phase)
  const gitStatus = useGitStore((s) => s.status)
  const theme = useThemeStore((s) => s.theme)
  const toggleTheme = useThemeStore((s) => s.toggleTheme)
  const setCommandPaletteOpen = useUIStore((s) => s.setCommandPaletteOpen)
  const setNotificationCenterOpen = useUIStore((s) => s.setNotificationCenterOpen)
  const unreadCount = useNotificationStore((s) => s.notifications.filter((n) => !n.read).length)

  const pageTitle = PAGE_TITLES[location.pathname] || 'Metis'
  const isActive = phase !== 'idle' && phase !== 'done'

  return (
    <header className="h-14 border-b border-border flex items-center justify-between px-5 shrink-0 bg-bg-deep/80 backdrop-blur-sm">
      {/* Left: Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        {activeProject && (
          <>
            <span className="text-text-muted">{activeProject.name}</span>
            <span className="text-text-muted/40">/</span>
          </>
        )}
        <span className="font-semibold text-text-primary">{pageTitle}</span>
        {gitStatus?.is_git_repo && gitStatus.branch && (
          <span className="ml-2 px-2 py-0.5 rounded-md bg-bg-surface border border-border text-xs text-text-muted font-mono">
            {gitStatus.branch}
            {gitStatus.files.length > 0 && (
              <span className="ml-1 text-warning">+{gitStatus.files.length}</span>
            )}
          </span>
        )}
        {isActive && (
          <span className="ml-2 flex items-center gap-1.5 text-xs text-accent">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-subtle-pulse" />
            Verarbeitung...
          </span>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => setCommandPaletteOpen(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-text-muted hover:text-text-secondary hover:bg-bg-hover transition-colors text-sm"
          title="Suche (Ctrl+P)"
        >
          <Search className="w-4 h-4" />
          <span className="text-xs text-text-muted/60 hidden lg:inline">Ctrl+P</span>
        </button>

        <button
          onClick={() => setNotificationCenterOpen(true)}
          className="relative p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
          title="Benachrichtigungen (Ctrl+N)"
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-accent text-[9px] text-white flex items-center justify-center font-medium">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
          title="Theme wechseln (Ctrl+Shift+T)"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>
    </header>
  )
}
