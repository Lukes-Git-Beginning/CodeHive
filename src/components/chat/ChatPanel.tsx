import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Send, User, Cpu, AlertCircle, Zap, CheckCircle, X, FileCode } from 'lucide-react'
import { useChatStore } from '../../stores/chatStore'
import { useProjectStore } from '../../stores/projectStore'
import { useAgentStore } from '../../stores/agentStore'
import { orchestrate } from '../../services/orchestrator'
import type { ChatMessage } from '../../types/agent'

function PlanApprovalCard() {
  const { pendingPlan, approvePlan, rejectPlan } = useAgentStore()
  if (!pendingPlan) return null

  const modelColors: Record<string, string> = {
    opus: 'text-violet',
    sonnet: 'text-cyan',
    haiku: 'text-accent',
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className="mx-4 mb-4 glass-accent rounded-xl p-5"
    >
      <div className="flex items-center gap-2 mb-4">
        <Zap className="w-4 h-4 text-accent" />
        <span className="font-hud text-xs text-accent">Execution Plan</span>
        <span className="text-[11px] text-text-muted ml-auto font-mono">
          {pendingPlan.tasks.length} tasks · {pendingPlan.waveCount} waves
        </span>
      </div>

      {pendingPlan.goals.length > 0 && (
        <div className="mb-4">
          {pendingPlan.goals.map((g, i) => (
            <p key={i} className="text-xs text-text-secondary">
              <span className="text-accent mr-2">{'>'}</span>{g}
            </p>
          ))}
        </div>
      )}

      <div className="space-y-1.5 mb-5">
        {pendingPlan.tasks.map((task, i) => (
          <motion.div
            key={task.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08 }}
            className="flex items-center gap-2 text-xs glass rounded-lg px-3 py-2"
          >
            <FileCode className="w-3 h-3 text-text-muted shrink-0" />
            <span className="text-text-primary flex-1 truncate">{task.name}</span>
            <span className={`font-mono text-[10px] ${modelColors[task.model] || 'text-text-muted'}`}>
              {task.model}
            </span>
            <div className="flex gap-0.5">
              {Array.from({ length: 10 }, (_, j) => (
                <div
                  key={j}
                  className={`w-1 h-2.5 rounded-full ${
                    j < task.complexity ? 'bg-accent/60' : 'bg-white/5'
                  }`}
                />
              ))}
            </div>
          </motion.div>
        ))}
      </div>

      <div className="flex gap-3">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={approvePlan}
          className="flex-1 flex items-center justify-center gap-2 bg-accent/15 border border-accent/30
                     text-accent rounded-lg py-2.5 text-xs font-hud tracking-wider
                     hover:bg-accent/25 hover:shadow-[0_0_20px_rgba(0,255,136,0.3)] transition-all"
        >
          <CheckCircle className="w-4 h-4" />
          Execute
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={rejectPlan}
          className="flex-1 flex items-center justify-center gap-2 bg-danger-dim border border-danger/30
                     text-danger rounded-lg py-2.5 text-xs font-hud tracking-wider
                     hover:bg-danger/25 hover:shadow-[0_0_20px_rgba(255,51,102,0.3)] transition-all"
        >
          <X className="w-4 h-4" />
          Abort
        </motion.button>
      </div>
    </motion.div>
  )
}

export function ChatPanel() {
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const pendingPlan = useAgentStore((s) => s.pendingPlan)
  const { messages, isProcessing, addMessage, setProcessing } = useChatStore()
  const activeProject = useProjectStore((s) => s.getActiveProject())

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
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
      await orchestrate(prompt, activeProject)
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

  const roleStyles: Record<string, { bg: string; border: string; icon: typeof Cpu; iconColor: string }> = {
    user: { bg: 'bg-accent/8', border: 'border-accent/20', icon: User, iconColor: 'text-accent' },
    orchestrator: { bg: 'bg-cyan/8', border: 'border-cyan/20', icon: Zap, iconColor: 'text-cyan' },
    agent: { bg: 'bg-violet/8', border: 'border-violet/20', icon: Cpu, iconColor: 'text-violet' },
    system: { bg: 'bg-white/3', border: 'border-white/5', icon: AlertCircle, iconColor: 'text-warning' },
  }

  const getLabel = (msg: ChatMessage) => {
    if (msg.role === 'user') return 'You'
    if (msg.role === 'orchestrator') return 'Orchestrator'
    if (msg.role === 'agent') return msg.agentRole || 'Agent'
    return 'System'
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center"
            >
              <div className="w-16 h-16 rounded-full glass-accent flex items-center justify-center mx-auto mb-4">
                <Zap className="w-7 h-7 text-accent" />
              </div>
              <h3 className="font-hud text-sm text-accent text-glow-green mb-2">
                {activeProject ? activeProject.name : 'No Project Selected'}
              </h3>
              <p className="text-xs text-text-muted max-w-sm mb-6">
                {activeProject
                  ? 'Beschreibe deine Aufgabe. Der Orchestrator analysiert, plant und delegiert an spezialisierte Agenten.'
                  : 'Wähle ein Projekt in der Sidebar.'}
              </p>
              {activeProject && (
                <div className="flex flex-wrap gap-2 justify-center max-w-md">
                  {[
                    'Neues Feature hinzufügen',
                    'Bug finden und fixen',
                    'Tests schreiben',
                    'Code refactoren',
                  ].map((s) => (
                    <motion.button
                      key={s}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => setInput(s)}
                      className="glass neon-hover rounded-lg px-3 py-1.5 text-[11px] text-text-secondary"
                    >
                      {s}
                    </motion.button>
                  ))}
                </div>
              )}
            </motion.div>
          </div>
        ) : (
          <AnimatePresence>
            {messages.map((msg) => {
              const style = roleStyles[msg.role] || roleStyles.system
              const Icon = style.icon
              const isUser = msg.role === 'user'

              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-3 ${isUser ? 'justify-end' : ''}`}
                >
                  {!isUser && (
                    <div className={`w-7 h-7 rounded-lg ${style.bg} border ${style.border} flex items-center justify-center shrink-0 mt-0.5`}>
                      <Icon className={`w-3.5 h-3.5 ${style.iconColor}`} />
                    </div>
                  )}
                  <div className={`max-w-[75%] rounded-xl px-4 py-3 ${style.bg} border ${style.border}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`font-hud text-[10px] ${style.iconColor}`}>{getLabel(msg)}</span>
                      <span className="text-[10px] text-text-muted font-mono">
                        {new Date(msg.timestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="text-[13px] text-text-primary leading-relaxed prose prose-invert prose-sm max-w-none
                                  prose-headings:text-accent prose-headings:font-hud prose-headings:text-xs prose-headings:mt-3 prose-headings:mb-1
                                  prose-strong:text-text-primary prose-code:text-cyan prose-code:text-[11px]
                                  prose-table:text-[11px] prose-th:text-accent prose-th:font-hud prose-th:text-[10px]
                                  prose-td:py-1 prose-th:py-1 prose-td:px-2 prose-th:px-2
                                  prose-td:border-border prose-th:border-border
                                  prose-pre:bg-bg-deep/50 prose-pre:border prose-pre:border-border prose-pre:rounded-lg
                                  prose-a:text-cyan prose-a:no-underline hover:prose-a:underline
                                  prose-li:text-text-secondary prose-p:my-1">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                    </div>
                  </div>
                  {isUser && (
                    <div className={`w-7 h-7 rounded-lg ${style.bg} border ${style.border} flex items-center justify-center shrink-0 mt-0.5`}>
                      <Icon className={`w-3.5 h-3.5 ${style.iconColor}`} />
                    </div>
                  )}
                </motion.div>
              )
            })}
          </AnimatePresence>
        )}
        {pendingPlan && <PlanApprovalCard />}
        {isProcessing && !pendingPlan && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex gap-3"
          >
            <div className="w-7 h-7 rounded-lg bg-cyan/8 border border-cyan/20 flex items-center justify-center shrink-0">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              >
                <Zap className="w-3.5 h-3.5 text-cyan" />
              </motion.div>
            </div>
            <div className="glass rounded-xl px-4 py-3 flex items-center gap-2">
              <div className="h-px w-12 bg-gradient-to-r from-transparent via-accent to-transparent animate-pulse" />
              <span className="text-[11px] text-text-muted font-mono">Processing...</span>
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t border-border p-4">
        <div className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={activeProject ? 'Enter command...' : 'Select a project first'}
            disabled={!activeProject || isProcessing}
            className="flex-1 glass rounded-xl px-4 py-3 text-sm text-text-primary placeholder-text-muted
                       focus:outline-none focus:border-accent/40 focus:shadow-[0_0_15px_rgba(0,255,136,0.15)]
                       disabled:opacity-30 transition-all font-mono"
          />
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            type="submit"
            disabled={!input.trim() || !activeProject || isProcessing}
            className="bg-accent/15 border border-accent/30 text-accent px-4 py-3 rounded-xl
                       hover:bg-accent/25 hover:shadow-[0_0_20px_rgba(0,255,136,0.3)]
                       disabled:opacity-30 disabled:hover:shadow-none transition-all"
          >
            <Send className="w-5 h-5" />
          </motion.button>
        </div>
      </form>
    </div>
  )
}
