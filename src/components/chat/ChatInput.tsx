import { useState, useRef, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ArrowUp, GitMerge, Zap, Camera } from 'lucide-react'
import { orchestrate, directChat } from '../../services/orchestrator'
import { captureAndAnalyze } from '../../services/vision'
import { useProjectStore } from '../../stores/projectStore'
import { useChatStore } from '../../stores/chatStore'
import { useNotificationStore } from '../../stores/notificationStore'
import type { ChatMessage } from '../../types/agent'

export function ChatInput() {
  const [input, setInput] = useState('')
  const [mode, setMode] = useState<'orchestrator' | 'direct'>('orchestrator')
  const [isFocused, setIsFocused] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const activeProject = useProjectStore((s) => s.getActiveProject())
  const isProcessing = useChatStore((s) => s.isProcessing)
  const addMessage = useChatStore((s) => s.addMessage)
  const setProcessing = useChatStore((s) => s.setProcessing)

  useEffect(() => {
    const ta = textareaRef.current
    if (ta) {
      ta.style.height = 'auto'
      ta.style.height = Math.min(ta.scrollHeight, 200) + 'px'
    }
  }, [input])

  const handleSubmit = useCallback(async () => {
    if (!input.trim() || isProcessing || !activeProject) return

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString(),
    }
    addMessage(userMessage)

    const prompt = input.trim()
    setInput('')
    setProcessing(true)

    try {
      if (mode === 'direct') {
        await directChat(prompt, activeProject)
      } else {
        await orchestrate(prompt, activeProject)
      }
    } catch (err) {
      addMessage({
        id: crypto.randomUUID(),
        role: 'system',
        content: `Fehler: ${String(err)}`,
        timestamp: new Date().toISOString(),
      })
      useNotificationStore.getState().addNotification('error', `Metis: ${String(err)}`)
    } finally {
      setProcessing(false)
    }
  }, [input, mode, isProcessing, activeProject, addMessage, setProcessing])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="px-4 pb-4 pt-2">
      <div
        className={`
          max-w-3xl mx-auto rounded-xl border transition-all duration-200
          ${isFocused ? 'border-accent/40 shadow-elevated' : 'border-border shadow-card'}
          bg-bg-surface
        `}
      >
        {/* Mode indicator */}
        <div className="flex items-center gap-2 px-4 pt-3 pb-1">
          <button
            onClick={() => setMode(mode === 'orchestrator' ? 'direct' : 'orchestrator')}
            className={`
              flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors
              ${mode === 'orchestrator'
                ? 'bg-accent/10 text-accent'
                : 'bg-bg-elevated text-text-secondary'
              }
            `}
            title={mode === 'orchestrator' ? 'Pipeline Mode — Multi-Agent' : 'Direct Mode — Single Agent'}
          >
            {mode === 'orchestrator' ? <GitMerge className="w-3 h-3" /> : <Zap className="w-3 h-3" />}
            {mode === 'orchestrator' ? 'Pipeline' : 'Direkt'}
          </button>
        </div>

        {/* Input area */}
        <div className="flex items-end gap-2 px-4 pb-3">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={
              !activeProject
                ? 'Wähle zuerst ein Projekt aus...'
                : mode === 'orchestrator'
                  ? 'Wie kann ich dir helfen?'
                  : 'Direkte Nachricht an Metis...'
            }
            disabled={!activeProject || isProcessing}
            aria-label="Nachricht an Metis"
            className="flex-1 bg-transparent text-text-primary placeholder:text-text-muted/50 outline-none resize-none text-sm min-h-[24px] max-h-[200px] overflow-hidden disabled:opacity-30 py-1"
            rows={1}
          />

          <div className="flex items-center gap-1 shrink-0 pb-0.5">
            <button
              onClick={() => captureAndAnalyze(input.trim() || undefined)}
              disabled={!activeProject || isProcessing}
              className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors disabled:opacity-30"
              title="Screenshot (Ctrl+Shift+S)"
            >
              <Camera className="w-4 h-4" />
            </button>

            <button
              onClick={handleSubmit}
              disabled={!input.trim() || !activeProject || isProcessing}
              className="p-2 rounded-lg bg-accent text-white hover:bg-accent/90 transition-all disabled:opacity-30 disabled:hover:bg-accent shadow-subtle"
              title="Senden"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
