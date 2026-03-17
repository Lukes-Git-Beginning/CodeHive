import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, Check, X, Shield, TestTube, RefreshCw, Search } from 'lucide-react'
import { orchestrate } from '../../services/orchestrator'
import { useProjectStore } from '../../stores/projectStore'
import { useProfileStore } from '../../stores/profileStore'
import { useAgentStore } from '../../stores/agentStore'
import { useChatStore } from '../../stores/chatStore'
import type { ChatMessage } from '../../types/agent'

interface Suggestion {
  id: string
  icon: typeof Sparkles
  text: string
  actionPayload: string
  category: 'security' | 'testing' | 'review' | 'improve'
}

const CATEGORY_COLORS: Record<string, string> = {
  security: 'text-danger',
  testing: 'text-violet',
  review: 'text-cyan',
  improve: 'text-accent',
}

function generateSuggestions(
  profile: ReturnType<typeof useProfileStore.getState>['profile'],
  projectName: string,
  techStack: string[],
  taskCount: number,
): Suggestion[] {
  const suggestions: Suggestion[] = []

  // Security check if not done recently
  const securityRuns = profile.taskTypeFrequency['security'] || 0
  if (securityRuns === 0 || profile.totalRuns - securityRuns > 5) {
    suggestions.push({
      id: 'security-scan',
      icon: Shield,
      text: `Security-Audit für ${projectName} durchführen?`,
      actionPayload: `Führe einen Security-Audit des Codes durch. Prüfe auf OWASP Top 10, Input-Validierung, Auth-Schwachstellen.`,
      category: 'security',
    })
  }

  // Test suggestion
  const testRuns = profile.taskTypeFrequency['test'] || 0
  if (testRuns === 0 || profile.totalRuns - testRuns > 3) {
    suggestions.push({
      id: 'write-tests',
      icon: TestTube,
      text: 'Tests für die letzten Änderungen schreiben?',
      actionPayload: 'Analysiere die zuletzt geänderten Dateien und schreibe Tests dafür.',
      category: 'testing',
    })
  }

  // Code review if many runs without review
  if (profile.totalRuns > 3) {
    suggestions.push({
      id: 'code-review',
      icon: Search,
      text: 'Code-Review der letzten Änderungen?',
      actionPayload: 'Führe ein Code-Review der zuletzt geänderten Dateien durch. Prüfe auf Code-Qualität, Performance und Best Practices.',
      category: 'review',
    })
  }

  // Self-improvement if many runs since last self-improve
  if (profile.runsSinceLastSelfImprove >= 5) {
    suggestions.push({
      id: 'self-improve',
      icon: RefreshCw,
      text: 'Metis möchte sich selbst verbessern',
      actionPayload: 'Analysiere den CodeHive-Quellcode und schlage Verbesserungen vor. Fokus auf UX, Performance und fehlende Features.',
      category: 'improve',
    })
  }

  // Tech-stack specific
  if (techStack.includes('Python') || techStack.includes('Flask')) {
    if (!suggestions.some((s) => s.category === 'security')) {
      suggestions.push({
        id: 'flask-security',
        icon: Shield,
        text: 'Flask-App auf Sicherheitslücken prüfen?',
        actionPayload: 'Prüfe die Flask-Anwendung auf SQL-Injection, XSS, CSRF, Session-Sicherheit und fehlende Input-Validierung.',
        category: 'security',
      })
    }
  }

  // Open tasks reminder
  if (taskCount > 0) {
    suggestions.push({
      id: 'open-tasks',
      icon: Sparkles,
      text: `${taskCount} offene Tasks — soll Metis einen bearbeiten?`,
      actionPayload: 'Schau dir die offenen Tasks auf der Roadmap an und bearbeite den mit der höchsten Priorität.',
      category: 'improve',
    })
  }

  return suggestions.slice(0, 3) // Max 3
}

export function ProactiveSuggestions() {
  const activeProject = useProjectStore((s) => s.getActiveProject())
  const tasks = useProjectStore((s) => s.tasks)
  const profile = useProfileStore((s) => s.profile)
  const phase = useAgentStore((s) => s.phase)
  const { isProcessing, addMessage, setProcessing } = useChatStore()
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])

  // Regenerate suggestions when project or profile changes
  useEffect(() => {
    if (!activeProject || phase !== 'idle') {
      setSuggestions([])
      return
    }
    const openTasks = tasks.filter((t) => t.status !== 'done').length
    const generated = generateSuggestions(
      profile,
      activeProject.name,
      activeProject.techStack,
      openTasks,
    )
    setSuggestions(generated)
    setDismissed(new Set())
  }, [activeProject?.id, profile.totalRuns, phase, tasks.length])

  const handleAccept = async (suggestion: Suggestion) => {
    if (!activeProject || isProcessing) return
    setDismissed((prev) => new Set(prev).add(suggestion.id))

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: suggestion.actionPayload,
      timestamp: new Date().toISOString(),
    }
    addMessage(userMessage)
    setProcessing(true)

    try {
      await orchestrate(suggestion.actionPayload, activeProject)
    } catch (err) {
      addMessage({
        id: crypto.randomUUID(),
        role: 'system',
        content: `Fehler: ${err}`,
        timestamp: new Date().toISOString(),
      })
      setProcessing(false)
    }
  }

  const handleDismiss = (id: string) => {
    setDismissed((prev) => new Set(prev).add(id))
  }

  const visible = suggestions.filter((s) => !dismissed.has(s.id)).slice(0, 2)
  if (visible.length === 0 || isProcessing) return null

  return (
    <div className="w-full max-w-lg flex flex-col gap-2.5 items-center mb-4">
      <AnimatePresence>
        {visible.map((suggestion) => {
          const Icon = suggestion.icon
          const color = CATEGORY_COLORS[suggestion.category] || 'text-accent'

          return (
            <motion.div
              key={suggestion.id}
              initial={{ opacity: 0, y: 15, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -15, scale: 0.9 }}
              className="glass-elevated px-4 py-3 rounded-xl flex items-center justify-between gap-4 w-full neon-hover border border-border"
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 shrink-0 ${color}`} />
                <span className="text-xs text-text-primary">{suggestion.text}</span>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <button
                  onClick={() => handleAccept(suggestion)}
                  className="p-1.5 rounded-md hover:bg-accent/20 text-text-secondary hover:text-accent transition-colors"
                  title="Ausführen"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDismiss(suggestion.id)}
                  className="p-1.5 rounded-md hover:bg-danger/20 text-text-secondary hover:text-danger transition-colors"
                  title="Verwerfen"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
