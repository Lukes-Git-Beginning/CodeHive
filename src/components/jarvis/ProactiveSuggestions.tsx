import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, Check, X } from 'lucide-react'
import { orchestrate } from '../../services/orchestrator'
import { useProjectStore } from '../../stores/projectStore'
import { useChatStore } from '../../stores/chatStore'
import type { ChatMessage } from '../../types/agent'

interface Suggestion {
  id: string
  text: string
  actionPayload: string
}

export function ProactiveSuggestions() {
  const activeProject = useProjectStore((s) => s.getActiveProject())
  const { isProcessing, addMessage, setProcessing } = useChatStore()

  const [suggestions, setSuggestions] = useState<Suggestion[]>([
    { id: '1', text: 'Tests für die letzten Änderungen generieren?', actionPayload: 'Generiere Unit-Tests für die zuletzt geänderten Dateien.' },
    { id: '2', text: 'Code auf Sicherheitslücken prüfen?', actionPayload: 'Führe einen Security-Audit des Codes durch.' },
  ])

  const handleAccept = async (suggestion: Suggestion) => {
    if (!activeProject || isProcessing) return
    setSuggestions((prev) => prev.filter((s) => s.id !== suggestion.id))

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
    setSuggestions((prev) => prev.filter((s) => s.id !== id))
  }

  if (suggestions.length === 0 || isProcessing) return null

  return (
    <div className="w-full max-w-lg flex flex-col gap-3 items-center mb-4">
      <AnimatePresence>
        {suggestions.slice(0, 2).map((suggestion) => (
          <motion.div
            key={suggestion.id}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className="glass-elevated px-4 py-3 rounded-xl flex items-center justify-between gap-4 w-full neon-hover border border-border"
          >
            <div className="flex items-center gap-3">
              <Sparkles className="w-4 h-4 text-accent shrink-0" />
              <span className="text-xs text-text-primary">{suggestion.text}</span>
            </div>
            <div className="flex gap-1.5 shrink-0">
              <button
                onClick={() => handleAccept(suggestion)}
                className="p-1.5 rounded-md hover:bg-accent/20 text-text-secondary hover:text-accent transition-colors"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleDismiss(suggestion.id)}
                className="p-1.5 rounded-md hover:bg-danger/20 text-text-secondary hover:text-danger transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
