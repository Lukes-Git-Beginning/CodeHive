import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Brain, Search, Trash2, BookOpen, FileText, Clock, ChevronDown, RefreshCw, ScanLine } from 'lucide-react'
import { useProjectStore } from '../../stores/projectStore'
import { getAllKnowledge, deleteKnowledge, searchKnowledge } from '../../services/rag'
import { useNotificationStore } from '../../stores/notificationStore'

interface KnowledgeEntry {
  id: string
  project_id: string
  key: string
  value: string
  source_agent: string
  created_at: string
}

function KnowledgeCard({ entry, onDelete }: { entry: KnowledgeEntry; onDelete: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false)

  const getIcon = () => {
    if (entry.key.startsWith('deepscan:')) return ScanLine
    if (entry.key.startsWith('project:')) return BookOpen
    if (entry.key.startsWith('run:')) return Clock
    if (entry.key.startsWith('learning:')) return Brain
    return FileText
  }

  const getTypeLabel = () => {
    if (entry.key.startsWith('deepscan:')) {
      const sub = entry.key.replace('deepscan:', '')
      const labels: Record<string, string> = {
        architecture: 'Architektur', entry_points: 'Entry Points', dependencies: 'Dependencies',
        code_quality: 'Code-Qualität', features: 'Features', improvements: 'Verbesserungen',
        inventory: 'Inventar', brief: 'Projekt-Brief', raw_analysis: 'KI-Analyse',
      }
      return `Deep Scan: ${labels[sub] || sub}`
    }
    if (entry.key.startsWith('project:brief')) return 'Project Brief'
    if (entry.key.startsWith('run:')) return 'Run History'
    if (entry.key.startsWith('learning:')) return 'Learning'
    return entry.key
  }

  const getTypeColor = () => {
    if (entry.key.startsWith('deepscan:')) return 'text-success border-success/20 bg-success-dim'
    if (entry.key.startsWith('project:')) return 'text-accent border-accent/20 bg-accent-dim'
    if (entry.key.startsWith('run:')) return 'text-warning border-warning/20 bg-warning-dim'
    if (entry.key.startsWith('learning:')) return 'text-text-secondary border-border bg-bg-elevated'
    return 'text-text-muted border-border bg-bg-surface'
  }

  const getDisplayValue = (): string => {
    try {
      const data = JSON.parse(entry.value)
      if (data.prompt) return data.prompt
      if (data.learnings) return data.learnings.slice(0, 300)
      return entry.value.slice(0, 300)
    } catch {
      return entry.value.slice(0, 300)
    }
  }

  const Icon = getIcon()

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="glass rounded-lg p-3 mb-2"
    >
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <Icon className="w-3.5 h-3.5 text-text-muted" />
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded border ${getTypeColor()}`}>
            {getTypeLabel()}
          </span>
          <span className="text-[9px] text-text-muted font-mono">
            {entry.source_agent}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-text-muted font-mono">
            {new Date(entry.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
          </span>
          <button
            onClick={() => onDelete(entry.id)}
            className="text-text-muted hover:text-danger transition-colors p-0.5"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      <p className="text-[11px] text-text-secondary truncate mb-1">
        {getDisplayValue()}
      </p>

      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-[10px] text-text-muted hover:text-text-secondary"
      >
        <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        {expanded ? 'Weniger' : 'Details'}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <pre className="mt-2 bg-bg-deep/50 rounded p-2 text-[10px] text-text-muted font-mono whitespace-pre-wrap max-h-48 overflow-y-auto">
              {(() => {
                try {
                  return JSON.stringify(JSON.parse(entry.value), null, 2)
                } catch {
                  return entry.value
                }
              })()}
            </pre>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export function KnowledgePanel() {
  const [entries, setEntries] = useState<KnowledgeEntry[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<KnowledgeEntry[] | null>(null)
  const [loading, setLoading] = useState(false)
  const activeProject = useProjectStore((s) => s.getActiveProject())
  const activeProjectId = activeProject?.id
  const addNotification = useNotificationStore((s) => s.addNotification)

  const loadEntries = useCallback(async () => {
    const project = useProjectStore.getState().getActiveProject()
    if (!project) return
    setLoading(true)
    const data = await getAllKnowledge(project.id)
    setEntries(data)
    setLoading(false)
  }, [activeProjectId])

  useEffect(() => {
    loadEntries()
  }, [loadEntries])

  const handleSearch = async () => {
    if (!searchQuery.trim() || !activeProject) {
      setSearchResults(null)
      return
    }
    const results = await searchKnowledge(activeProject.id, searchQuery, 10)
    setSearchResults(results)
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteKnowledge(id)
      setEntries((prev) => prev.filter((e) => e.id !== id))
      if (searchResults) {
        setSearchResults((prev) => prev?.filter((e) => e.id !== id) || null)
      }
      addNotification('success', 'Knowledge-Eintrag gelöscht')
    } catch {
      addNotification('error', 'Löschen fehlgeschlagen')
    }
  }

  const displayEntries = searchResults !== null ? searchResults : entries

  // Stats
  const briefCount = entries.filter((e) => e.key.startsWith('project:')).length
  const runCount = entries.filter((e) => e.key.startsWith('run:')).length
  const learningCount = entries.filter((e) => e.key.startsWith('learning:')).length

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border glass shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-accent" />
            <span className="font-label text-sm text-text-primary">Knowledge Base</span>
          </div>
          <button
            onClick={loadEntries}
            className="text-text-muted hover:text-text-secondary transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Stats */}
        <div className="flex gap-3 mb-3">
          <div className="flex items-center gap-1.5 text-[10px]">
            <BookOpen className="w-3 h-3 text-accent" />
            <span className="text-text-muted">{briefCount} Brief</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px]">
            <Clock className="w-3 h-3 text-cyan" />
            <span className="text-text-muted">{runCount} Runs</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px]">
            <Brain className="w-3 h-3 text-violet" />
            <span className="text-text-muted">{learningCount} Learnings</span>
          </div>
        </div>

        {/* Search */}
        <div className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              if (!e.target.value.trim()) setSearchResults(null)
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            aria-label="Knowledge durchsuchen"
            placeholder="Knowledge durchsuchen (FTS5)..."
            className="flex-1 glass rounded-lg px-3 py-2 text-xs text-text-primary placeholder-text-muted
                       focus:outline-none focus:border-accent/40 transition-all font-mono"
          />
          <button
            onClick={handleSearch}
            className="glass neon-hover rounded-lg px-3 py-2 text-text-muted hover:text-accent transition-colors"
          >
            <Search className="w-3.5 h-3.5" />
          </button>
        </div>
        {searchResults !== null && (
          <div className="flex items-center justify-between mt-2">
            <span className="text-[10px] text-text-muted">
              {searchResults.length} Treffer für "{searchQuery}"
            </span>
            <button
              onClick={() => { setSearchResults(null); setSearchQuery('') }}
              className="text-[10px] text-accent hover:underline"
            >
              Alle anzeigen
            </button>
          </div>
        )}
      </div>

      {/* Entries */}
      <div className="flex-1 overflow-y-auto p-3">
        {displayEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-text-muted">
            <Brain className="w-10 h-10 mb-3 opacity-15" />
            <p className="text-[11px] text-center font-mono">
              {searchResults !== null
                ? 'Keine Treffer gefunden.'
                : 'Noch keine Knowledge-Einträge.\nStarte eine Orchestrierung um Wissen zu sammeln.'}
            </p>
          </div>
        ) : (
          <AnimatePresence>
            {displayEntries.map((entry) => (
              <KnowledgeCard key={entry.id} entry={entry} onDelete={handleDelete} />
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}
