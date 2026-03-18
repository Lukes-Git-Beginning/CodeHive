import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Map, Brain, LayoutDashboard, Settings, FolderPlus, Camera, Shield, TestTube, RefreshCw, Trash2, Bell, Layers, Palette } from 'lucide-react'
import { useThemeStore } from '../../stores/themeStore'

interface Command {
  id: string
  icon: typeof Search
  label: string
  description: string
  shortcut?: string
  action: () => void
}

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  onOpenPanel: (panel: 'roadmap' | 'knowledge' | 'dashboard' | 'templates') => void
  onOpenSettings: () => void
  onOpenMindPalace: () => void
  onOpenNotifications: () => void
  onSwitchProject: () => void
  onScreenshot: () => void
  onOrchestrate: (prompt: string) => void
  onSelfImprove: () => void
  onClearChat: () => void
}

export function CommandPalette({
  isOpen,
  onClose,
  onOpenPanel,
  onOpenSettings,
  onOpenMindPalace,
  onOpenNotifications,
  onSwitchProject,
  onScreenshot,
  onOrchestrate,
  onSelfImprove,
  onClearChat,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const commands: Command[] = [
    { id: 'roadmap', icon: Map, label: 'Roadmap öffnen', description: 'Kanban-Board mit Tasks', shortcut: 'Ctrl+R', action: () => { onOpenPanel('roadmap'); onClose() } },
    { id: 'knowledge', icon: Brain, label: 'Knowledge Base', description: 'Gespeichertes Wissen durchsuchen', shortcut: 'Ctrl+K', action: () => { onOpenPanel('knowledge'); onClose() } },
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard', description: 'Projektübersicht', shortcut: 'Ctrl+D', action: () => { onOpenPanel('dashboard'); onClose() } },
    { id: 'mindpalace', icon: Brain, label: 'Mind Palace', description: 'Agent-Aktivität und History', shortcut: 'Ctrl+M', action: () => { onOpenMindPalace(); onClose() } },
    { id: 'settings', icon: Settings, label: 'Einstellungen', description: 'Metis konfigurieren', action: () => { onOpenSettings(); onClose() } },
    { id: 'screenshot', icon: Camera, label: 'Screenshot analysieren', description: 'Bildschirm aufnehmen und analysieren', shortcut: 'Ctrl+Shift+S', action: () => { onScreenshot(); onClose() } },
    { id: 'security', icon: Shield, label: 'Security-Audit', description: 'Code auf Sicherheitslücken prüfen', action: () => { onOrchestrate('Führe einen Security-Audit des Codes durch.'); onClose() } },
    { id: 'tests', icon: TestTube, label: 'Tests generieren', description: 'Tests für aktuelle Änderungen schreiben', action: () => { onOrchestrate('Generiere Tests für die zuletzt geänderten Dateien.'); onClose() } },
    { id: 'improve', icon: RefreshCw, label: 'Metis verbessern', description: 'Selbstverbesserung starten', action: () => { onSelfImprove(); onClose() } },
    { id: 'switch', icon: FolderPlus, label: 'Projekt wechseln', description: 'Anderes Projekt auswählen', action: () => { onSwitchProject(); onClose() } },
    { id: 'clear', icon: Trash2, label: 'Chat leeren', description: 'Konversation zurücksetzen', action: () => { onClearChat(); onClose() } },
    // New features
    { id: 'notifications', icon: Bell, label: 'Benachrichtigungen', description: 'Notification-Verlauf anzeigen', shortcut: 'Ctrl+N', action: () => { onOpenNotifications(); onClose() } },
    { id: 'templates', icon: Layers, label: 'Agent Templates', description: 'Vordefinierte Workflows ausführen', shortcut: 'Ctrl+T', action: () => { onOpenPanel('templates'); onClose() } },
    { id: 'toggle-theme', icon: Palette, label: 'Theme wechseln', description: 'Dark/Light Theme umschalten', shortcut: 'Ctrl+Shift+T', action: () => { useThemeStore.getState().toggleTheme(); onClose() } },
  ]

  const filtered = query
    ? commands.filter((c) =>
        c.label.toLowerCase().includes(query.toLowerCase()) ||
        c.description.toLowerCase().includes(query.toLowerCase())
      )
    : commands

  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
      const timer = setTimeout(() => inputRef.current?.focus(), 100)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || (e.key === 'j' && query === '')) {
      e.preventDefault()
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp' || (e.key === 'k' && query === '')) {
      e.preventDefault()
      setSelectedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered[selectedIndex]) filtered[selectedIndex].action()
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-start justify-center pt-[15vh]"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            onClick={(e) => e.stopPropagation()}
            className="glass-elevated rounded-2xl w-full max-w-lg overflow-hidden"
          >
            {/* Search Input */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
              <Search className="w-4 h-4 text-accent shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Metis Command..."
                className="flex-1 bg-transparent text-sm text-text-primary placeholder-text-muted outline-none font-mono"
              />
              <span className="text-[9px] font-hud text-text-muted">ESC</span>
            </div>

            {/* Commands */}
            <div role="listbox" className="max-h-80 overflow-y-auto py-2">
              {filtered.map((cmd, i) => {
                const Icon = cmd.icon
                const isSelected = i === selectedIndex

                return (
                  <button
                    key={cmd.id}
                    role="option"
                    aria-selected={isSelected}
                    onClick={cmd.action}
                    onMouseEnter={() => setSelectedIndex(i)}
                    className={`w-full flex items-center gap-3 px-5 py-2.5 text-left transition-colors ${
                      isSelected ? 'bg-accent/10 text-text-primary' : 'text-text-secondary hover:bg-bg-hover'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${isSelected ? 'text-accent' : 'text-text-muted'}`} />
                    <div className="flex-1 min-w-0">
                      <span className="text-xs">{cmd.label}</span>
                      <p className="text-[10px] text-text-muted truncate">{cmd.description}</p>
                    </div>
                    {cmd.shortcut && (
                      <span className="text-[9px] font-mono text-text-muted bg-bg-surface px-1.5 py-0.5 rounded shrink-0">
                        {cmd.shortcut}
                      </span>
                    )}
                  </button>
                )
              })}

              {filtered.length === 0 && (
                <p className="text-center text-text-muted text-xs py-6">Kein Befehl gefunden.</p>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
