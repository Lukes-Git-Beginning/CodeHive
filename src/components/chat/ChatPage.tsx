import { useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bot, Loader2 } from 'lucide-react'
import { useChatStore } from '../../stores/chatStore'
import { useAgentStore } from '../../stores/agentStore'
import { useProjectStore } from '../../stores/projectStore'
import { ChatMessage } from './ChatMessage'
import { ChatInput } from './ChatInput'
import { invoke } from '@tauri-apps/api/core'
import { useState } from 'react'

export function ChatPage() {
  const messages = useChatStore((s) => s.messages)
  const isProcessing = useChatStore((s) => s.isProcessing)
  const pendingPlan = useAgentStore((s) => s.pendingPlan)
  const approvePlan = useAgentStore((s) => s.approvePlan)
  const rejectPlan = useAgentStore((s) => s.rejectPlan)
  const activeProject = useProjectStore((s) => s.getActiveProject())
  const scrollRef = useRef<HTMLDivElement>(null)

  // Model & settings state
  const [planMode, setPlanMode] = useState(true)
  const [autoAccept, setAutoAccept] = useState(false)
  const [model, setModel] = useState('sonnet')

  // Load settings
  useEffect(() => {
    invoke('get_setting', { key: 'plan_mode' }).then((v) => { if (v === 'false') setPlanMode(false) }).catch(() => {})
    invoke('get_setting', { key: 'auto_accept' }).then((v) => { if (v === 'true') setAutoAccept(true) }).catch(() => {})
    invoke('get_setting', { key: 'model' }).then((v) => { if (v) setModel(v as string) }).catch(() => {})
  }, [])

  const togglePlanMode = () => {
    const next = !planMode
    setPlanMode(next)
    invoke('set_setting', { key: 'plan_mode', value: String(next) }).catch(() => {})
  }

  const toggleAutoAccept = () => {
    const next = !autoAccept
    setAutoAccept(next)
    invoke('set_setting', { key: 'auto_accept', value: String(next) }).catch(() => {})
  }

  const changeModel = (m: string) => {
    setModel(m)
    invoke('set_setting', { key: 'model', value: m }).catch(() => {})
  }

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, pendingPlan])

  const isEmpty = messages.length === 0 && !isProcessing

  return (
    <div className="flex flex-col h-full">
      {/* Chat header controls */}
      <div className="flex items-center gap-3 px-5 py-2 border-b border-border bg-bg-deep/50">
        {/* Plan Mode */}
        <button
          onClick={togglePlanMode}
          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
            planMode ? 'bg-accent/10 text-accent' : 'bg-bg-surface text-text-muted'
          }`}
        >
          Plan-Modus {planMode ? 'An' : 'Aus'}
        </button>

        {/* Auto Accept */}
        <button
          onClick={toggleAutoAccept}
          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
            autoAccept ? 'bg-success/10 text-success' : 'bg-bg-surface text-text-muted'
          }`}
        >
          Auto-Accept {autoAccept ? 'An' : 'Aus'}
        </button>

        {/* Model selector */}
        <select
          value={model}
          onChange={(e) => changeModel(e.target.value)}
          className="px-2.5 py-1 rounded-md text-xs font-medium bg-bg-surface border border-border text-text-secondary outline-none cursor-pointer hover:border-border-accent transition-colors"
        >
          <option value="sonnet">Claude Sonnet</option>
          <option value="haiku">Claude Haiku</option>
          <option value="opus">Claude Opus</option>
          <option value="ollama">Ollama (Lokal)</option>
        </select>
      </div>

      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mb-6">
              <Bot className="w-8 h-8 text-accent" />
            </div>
            <h2 className="text-xl font-semibold text-text-primary mb-2">Willkommen bei Metis</h2>
            <p className="text-sm text-text-muted max-w-md mb-8">
              {activeProject
                ? `Arbeite an "${activeProject.name}". Stelle eine Frage oder gib einen Auftrag.`
                : 'Wähle zuerst ein Projekt aus, um zu starten.'
              }
            </p>
            {activeProject && (
              <div className="flex flex-wrap gap-2 justify-center max-w-lg">
                {[
                  'Analysiere die Codebase-Struktur',
                  'Zeige offene TODOs',
                  'Erkläre die Architektur',
                  'Prüfe auf Sicherheitsprobleme',
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => {
                      const chatStore = useChatStore.getState()
                      chatStore.addMessage({
                        id: crypto.randomUUID(),
                        role: 'user',
                        content: suggestion,
                        timestamp: new Date().toISOString(),
                      })
                    }}
                    className="px-3 py-2 rounded-lg border border-border text-sm text-text-secondary
                               hover:bg-bg-hover hover:text-text-primary hover:border-border-accent
                               transition-all"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="max-w-3xl mx-auto">
            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} />
            ))}

            {/* Plan Approval */}
            <AnimatePresence>
              {pendingPlan && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="mx-4 my-3 p-4 rounded-xl bg-bg-surface border border-accent/20 shadow-card"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold text-text-primary">
                      Plan bereit
                    </span>
                    <span className="text-xs text-text-muted">
                      {pendingPlan.tasks.length} Tasks &middot; {pendingPlan.waveCount} Wellen
                    </span>
                  </div>
                  <div className="space-y-1.5 mb-4 max-h-40 overflow-y-auto">
                    {pendingPlan.tasks.map((task) => (
                      <div key={task.id} className="flex items-center gap-2 text-xs bg-bg-elevated rounded-lg px-3 py-2">
                        <span className="text-text-primary flex-1 truncate">{task.name}</span>
                        {task.role && (
                          <span className="font-mono text-[10px] text-text-muted bg-bg-surface px-1.5 rounded">{task.role}</span>
                        )}
                        <span className="font-mono text-[10px] text-accent">{task.model}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={approvePlan}
                      className="flex-1 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-all shadow-subtle"
                    >
                      Ausführen
                    </button>
                    <button
                      onClick={rejectPlan}
                      className="flex-1 py-2 rounded-lg bg-danger/10 border border-danger/20 text-danger text-sm font-medium hover:bg-danger/20 transition-all"
                    >
                      Abbrechen
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Processing indicator */}
            {isProcessing && (
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center">
                  <Loader2 className="w-4 h-4 text-accent animate-spin" />
                </div>
                <span className="text-sm text-text-muted">Metis denkt nach...</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input */}
      <ChatInput />
    </div>
  )
}
