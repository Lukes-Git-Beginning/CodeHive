import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useChatStore } from '../../stores/chatStore'
import { useAgentStore } from '../../stores/agentStore'
import { MessageSquare, ChevronUp, ChevronDown, User, Cpu, AlertCircle, Zap, GitMerge } from 'lucide-react'

const ROLE_CONFIG: Record<string, { icon: typeof Cpu; color: string }> = {
  user: { icon: User, color: 'text-cyan' },
  orchestrator: { icon: GitMerge, color: 'text-violet' },
  agent: { icon: Cpu, color: 'text-accent' },
  system: { icon: AlertCircle, color: 'text-warning' },
}

export function ConversationStream() {
  const messages = useChatStore((s) => s.messages)
  const isProcessing = useChatStore((s) => s.isProcessing)
  const phase = useAgentStore((s) => s.phase)
  const [isExpanded, setIsExpanded] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-expand when agents start working
  useEffect(() => {
    if (phase !== 'idle' && phase !== 'done' && messages.length > 0) {
      setIsExpanded(true)
    }
  }, [phase, messages.length])

  // Auto-scroll to bottom
  useEffect(() => {
    if (isExpanded && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isExpanded])

  if (messages.length === 0 && !isProcessing) return null

  return (
    <div className="w-full max-w-3xl mt-4 flex flex-col items-center">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-[10px] font-hud text-text-muted hover:text-accent transition-colors py-2"
      >
        {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
        {isExpanded ? 'Historie ausblenden' : `Historie anzeigen (${messages.length})`}
        {isProcessing && (
          <span className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse" />
        )}
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="w-full overflow-hidden"
          >
            <div ref={scrollRef} className="flex flex-col gap-4 max-h-[25vh] overflow-y-auto pr-2 pb-4">
              {messages.map((msg) => {
                const config = ROLE_CONFIG[msg.role] || ROLE_CONFIG.system
                const Icon = config.icon
                const isUser = msg.role === 'user'

                return (
                  <div key={msg.id} className={`flex gap-2.5 ${isUser ? 'justify-end' : ''}`}>
                    {!isUser && (
                      <div className="w-6 h-6 rounded-md glass flex items-center justify-center shrink-0 mt-0.5">
                        <Icon className={`w-3 h-3 ${config.color}`} />
                      </div>
                    )}
                    <div className={`glass px-5 py-3.5 rounded-xl max-w-[80%] ${
                      isUser ? 'bg-cyan/5 border-cyan/20' : ''
                    }`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`font-hud text-[9px] ${config.color}`}>
                          {msg.role === 'user' ? 'You' : msg.role}
                        </span>
                        <span className="text-[9px] text-text-muted font-mono">
                          {new Date(msg.timestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="text-xs text-text-primary leading-relaxed prose prose-invert prose-sm max-w-none
                                    prose-code:text-cyan prose-code:text-[10px] prose-pre:bg-bg-deep/50 prose-pre:rounded-lg
                                    prose-p:my-0.5">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                      </div>
                    </div>
                    {isUser && (
                      <div className="w-6 h-6 rounded-md glass flex items-center justify-center shrink-0 mt-0.5">
                        <Icon className={`w-3 h-3 ${config.color}`} />
                      </div>
                    )}
                  </div>
                )
              })}

              {isProcessing && (
                <div className="flex gap-2.5">
                  <div className="w-6 h-6 rounded-md glass flex items-center justify-center shrink-0">
                    <Zap className="w-3 h-3 text-accent animate-pulse" />
                  </div>
                  <div className="glass px-3.5 py-2.5 rounded-xl">
                    <div className="h-px w-10 bg-gradient-to-r from-transparent via-accent to-transparent animate-pulse" />
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
