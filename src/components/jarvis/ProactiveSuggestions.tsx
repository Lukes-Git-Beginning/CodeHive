import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, Check, X, Shield, TestTube, RefreshCw, Search, GraduationCap, GitBranch } from 'lucide-react'
import { orchestrate } from '../../services/orchestrator'
import { useProjectStore } from '../../stores/projectStore'
import { useProfileStore } from '../../stores/profileStore'
import { useAgentStore } from '../../stores/agentStore'
import { useChatStore } from '../../stores/chatStore'
import { generateResearchSuggestions, buildResearchPrompt } from '../../services/webResearch'
import { useGitStore } from '../../stores/gitStore'
import { triggerSelfImprovement } from '../../services/selfImprove'
import type { ChatMessage } from '../../types/agent'

interface Suggestion {
  id: string
  icon: typeof Sparkles
  text: string
  actionPayload: string
  category: 'security' | 'testing' | 'review' | 'improve' | 'learn' | 'git'
}

const CATEGORY_COLORS: Record<string, string> = {
  security: 'text-danger',
  testing: 'text-violet',
  review: 'text-cyan',
  learn: 'text-warning',
  improve: 'text-accent',
  git: 'text-cyan',
}

function generateSuggestions(
  profile: ReturnType<typeof useProfileStore.getState>['profile'],
  projectName: string,
  techStack: string[],
  taskCount: number,
  gitFileCount: number,
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

  // Web Research suggestions from Metis
  const researchIdeas = generateResearchSuggestions({ id: '', name: projectName, path: '', techStack, description: '', gitRemote: '', projectIdentifier: '', createdAt: '', updatedAt: '' })
  for (const idea of researchIdeas.slice(0, 1)) {
    suggestions.push({
      id: idea.id,
      icon: GraduationCap,
      text: `Metis möchte lernen: ${idea.topic}`,
      actionPayload: buildResearchPrompt(idea),
      category: 'learn',
    })
  }

  // Git suggestions
  if (gitFileCount > 0) {
    suggestions.push({
      id: 'git-uncommitted',
      icon: GitBranch,
      text: `${gitFileCount} ungespeicherte Änderungen — committen?`,
      actionPayload: `Analysiere die aktuellen Git-Änderungen in ${projectName} und erstelle eine passende Commit-Message. Zeige den Diff und schlage eine konventionelle Commit-Message vor.`,
      category: 'git',
    })
  }

  return suggestions.slice(0, 3) // Max 3
}

export function ProactiveSuggestions() {
  const activeProject = useProjectStore((s) => s.getActiveProject())
  const tasks = useProjectStore((s) => s.tasks)
  const profileTotalRuns = useProfileStore((s) => s.profile.totalRuns)
  const phase = useAgentStore((s) => s.phase)
  const isProcessing = useChatStore((s) => s.isProcessing)
  const addMessage = useChatStore((s) => s.addMessage)
  const setProcessing = useChatStore((s) => s.setProcessing)
  const gitStatus = useGitStore((s) => s.status)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])

  // Regenerate suggestions when project, profile, or git status changes
  const gitFileCount = gitStatus?.files.length ?? 0
  useEffect(() => {
    if (!activeProject || phase !== 'idle') {
      setSuggestions([])
      return
    }
    const profile = useProfileStore.getState().profile
    const openTasks = tasks.filter((t) => t.status !== 'done').length
    const generated = generateSuggestions(
      profile,
      activeProject.name,
      activeProject.techStack,
      openTasks,
      gitFileCount,
    )
    setSuggestions(generated)
    setDismissed(new Set())
  }, [activeProject?.id, profileTotalRuns, phase, tasks.length, gitFileCount])

  const handleAccept = async (suggestion: Suggestion) => {
    if (!activeProject || isProcessing) return
    setDismissed((prev) => new Set(prev).add(suggestion.id))

    // Self-improve uses dedicated handler
    if (suggestion.id === 'self-improve') {
      try {
        await triggerSelfImprovement()
      } catch (err) {
        addMessage({ id: crypto.randomUUID(), role: 'system', content: `Fehler: ${err}`, timestamp: new Date().toISOString() })
        setProcessing(false)
      }
      return
    }

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
              initial={{ opacity: 0, y: 15, scale: 0.95, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -15, scale: 0.9, filter: 'blur(4px)' }}
              className="hud-panel hud-brackets px-4 py-3 flex items-center justify-between gap-4 w-full"
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
