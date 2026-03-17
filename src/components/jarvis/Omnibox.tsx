import { useState, useRef, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Send, Zap, GitMerge } from 'lucide-react'
import { orchestrate, directChat } from '../../services/orchestrator'
import { useProjectStore } from '../../stores/projectStore'
import { useChatStore } from '../../stores/chatStore'
import type { ChatMessage } from '../../types/agent'

export function Omnibox() {
  const [input, setInput] = useState('')
  const [mode, setMode] = useState<'orchestrator' | 'direct'>('orchestrator')
  const [isFocused, setIsFocused] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const activeProject = useProjectStore((s) => s.getActiveProject())
  const { isProcessing, addMessage, setProcessing } = useChatStore()

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
        content: `Fehler: ${err}`,
        timestamp: new Date().toISOString(),
      })
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
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`w-full max-w-3xl glass transition-all duration-300 rounded-2xl p-2 ${
        isFocused ? 'ring-1 ring-accent shadow-[0_0_15px_rgba(0,255,136,0.15)]' : ''
      }`}
    >
      <div className="flex flex-col gap-2">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={
            !activeProject
              ? 'Wähle zuerst ein Projekt...'
              : mode === 'orchestrator'
                ? 'Was soll ich für dich tun? (Plan → Execute → Verify)'
                : 'Sprich direkt mit einem Agenten...'
          }
          disabled={!activeProject || isProcessing}
          className="w-full bg-transparent text-text-primary placeholder:text-text-muted outline-none resize-none font-mono p-3 min-h-[56px] overflow-hidden disabled:opacity-30"
          rows={1}
        />

        <div className="flex items-center justify-between px-2 pb-2">
          <div className="flex items-center gap-1 bg-bg-surface rounded-lg p-1">
            <button
              onClick={() => setMode('orchestrator')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-[10px] font-hud transition-colors ${
                mode === 'orchestrator'
                  ? 'bg-bg-elevated text-accent'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <GitMerge className="w-3 h-3" />
              Pipeline
            </button>
            <button
              onClick={() => setMode('direct')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-[10px] font-hud transition-colors ${
                mode === 'direct'
                  ? 'bg-bg-elevated text-cyan'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <Zap className="w-3 h-3" />
              Direct
            </button>
          </div>

          <div className="flex items-center gap-2">
            {isProcessing && (
              <span className="text-[10px] font-hud text-accent animate-pulse">Processing...</span>
            )}
            <button
              onClick={handleSubmit}
              disabled={!input.trim() || !activeProject || isProcessing}
              className={`p-2 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
                mode === 'direct'
                  ? 'bg-bg-surface text-cyan hover:bg-bg-elevated hover:shadow-[0_0_15px_rgba(0,212,255,0.2)]'
                  : 'bg-bg-surface text-accent hover:bg-bg-elevated hover:shadow-[0_0_15px_rgba(0,255,136,0.2)]'
              }`}
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
