import { useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useChatStore } from '../../stores/chatStore'
import { Zap } from 'lucide-react'

const ROLE_LABELS: Record<string, { prefix: string; color: string }> = {
  user: { prefix: 'User', color: 'text-cyan' },
  orchestrator: { prefix: 'METIS', color: 'text-violet' },
  agent: { prefix: 'METIS', color: 'text-accent' },
  system: { prefix: 'System', color: 'text-warning' },
}

export function ConversationStream() {
  const messages = useChatStore((s) => s.messages)
  const isProcessing = useChatStore((s) => s.isProcessing)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  if (messages.length === 0 && !isProcessing) return null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="w-full max-w-2xl mt-3"
    >
      <div
        ref={scrollRef}
        role="log"
        aria-live="polite"
        aria-label="Konversation"
        className="flex flex-col gap-1.5 max-h-[30vh] overflow-y-auto pr-2 py-2 rounded-lg"
        style={{
          background: 'rgba(0, 0, 0, 0.2)',
          border: '1px solid rgba(0, 212, 255, 0.05)',
        }}
      >
        {messages.map((msg) => {
          const config = ROLE_LABELS[msg.role] || ROLE_LABELS.system

          return (
            <div key={msg.id} className="flex gap-2 px-3 py-1 hover:bg-white/[0.02] transition-colors">
              <span className={`font-hud text-[9px] shrink-0 w-14 text-right ${config.color}`}>
                ({config.prefix})
              </span>
              <div className="flex-1 text-[11px] text-text-primary leading-relaxed font-mono prose prose-invert prose-sm max-w-none
                            prose-code:text-cyan prose-code:text-[10px] prose-pre:bg-bg-deep/50 prose-pre:rounded-lg
                            prose-p:my-0 prose-p:leading-relaxed">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
              </div>
            </div>
          )
        })}

        {isProcessing && (
          <div className="flex gap-2 px-3 py-1">
            <span className="font-hud text-[9px] shrink-0 w-14 text-right text-accent">
              (METIS)
            </span>
            <div className="flex items-center gap-2">
              <Zap className="w-3 h-3 text-accent animate-pulse" />
              <div className="h-px w-16 bg-gradient-to-r from-accent/60 via-accent to-accent/60 animate-pulse" />
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
}
