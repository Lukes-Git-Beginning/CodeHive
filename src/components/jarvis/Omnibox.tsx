import { useState, useRef, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Send, Zap, GitMerge, Camera, Terminal } from 'lucide-react'
import { orchestrate, directChat } from '../../services/orchestrator'
import { captureAndAnalyze } from '../../services/vision'
import { useProjectStore } from '../../stores/projectStore'
import { useChatStore } from '../../stores/chatStore'
import { useNotificationStore } from '../../stores/notificationStore'
import type { ChatMessage } from '../../types/agent'

export function Omnibox() {
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
      className={`w-full max-w-2xl mx-auto mt-4 transition-all duration-300 rounded-lg ${
        isFocused ? 'ring-1 ring-accent/40 shadow-[0_0_20px_rgba(0,212,255,0.1)]' : ''
      }`}
      style={{
        background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.04), rgba(26, 143, 255, 0.02))',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(0, 212, 255, 0.1)',
      }}
    >
      {/* Single-row input with prompt icon */}
      <div className="flex items-center gap-2 px-4 py-2.5">
        {/* Terminal prompt icon */}
        <Terminal className="w-4 h-4 text-accent/50 shrink-0" />
        <span className="text-accent/40 font-mono text-sm shrink-0">&gt;_</span>

        {/* Input */}
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={
            !activeProject
              ? 'Select a project first...'
              : mode === 'orchestrator'
                ? 'Analyze latest pipeline logs and suggest optimizations...'
                : 'Direct chat with Metis...'
          }
          disabled={!activeProject || isProcessing}
          className="flex-1 bg-transparent text-text-primary placeholder:text-text-muted/50 outline-none resize-none font-mono text-sm min-h-[24px] max-h-[200px] overflow-hidden disabled:opacity-30 py-0.5"
          rows={1}
        />

        {/* Right-side controls */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Mode toggle — compact */}
          <button
            onClick={() => setMode(mode === 'orchestrator' ? 'direct' : 'orchestrator')}
            className={`p-1.5 rounded transition-colors ${
              mode === 'orchestrator' ? 'text-accent' : 'text-cyan'
            } hover:bg-white/5`}
            title={mode === 'orchestrator' ? 'Pipeline Mode' : 'Direct Mode'}
          >
            {mode === 'orchestrator' ? <GitMerge className="w-3.5 h-3.5" /> : <Zap className="w-3.5 h-3.5" />}
          </button>

          {/* Screenshot */}
          <button
            onClick={() => captureAndAnalyze(input.trim() || undefined)}
            disabled={!activeProject || isProcessing}
            className="p-1.5 rounded text-text-muted hover:text-warning hover:bg-white/5 transition-colors disabled:opacity-30"
            title="Screenshot (Ctrl+Shift+S)"
          >
            <Camera className="w-3.5 h-3.5" />
          </button>

          {/* Shortcut hint */}
          <span className="text-[8px] font-mono text-text-muted/40 px-1">⌘K</span>

          {/* Send */}
          <button
            onClick={handleSubmit}
            disabled={!input.trim() || !activeProject || isProcessing}
            className="p-1.5 rounded transition-all disabled:opacity-20 text-accent hover:bg-accent/10 hover:shadow-[0_0_10px_rgba(0,212,255,0.15)]"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  )
}
