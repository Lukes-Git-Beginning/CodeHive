import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Bot, User, Cog } from 'lucide-react'
import { Avatar } from '../ui/Avatar'
import type { ChatMessage as ChatMessageType } from '../../types/agent'

const ROLE_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  user: { label: 'Du', icon: <User className="w-4 h-4" />, color: 'text-text-primary' },
  orchestrator: { label: 'Metis', icon: <Bot className="w-4 h-4" />, color: 'text-accent' },
  agent: { label: 'Agent', icon: <Bot className="w-4 h-4" />, color: 'text-accent' },
  system: { label: 'System', icon: <Cog className="w-4 h-4" />, color: 'text-text-muted' },
}

interface ChatMessageProps {
  message: ChatMessageType
}

export function ChatMessage({ message }: ChatMessageProps) {
  const config = ROLE_CONFIG[message.role] || ROLE_CONFIG.system
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'

  if (isSystem) {
    return (
      <div className="flex justify-center py-2">
        <div className="px-3 py-1.5 rounded-lg bg-bg-surface border border-border text-xs text-text-muted max-w-lg text-center">
          {message.content}
        </div>
      </div>
    )
  }

  return (
    <div className={`flex gap-3 py-3 px-4 ${isUser ? '' : 'bg-bg-surface/30'}`}>
      <Avatar
        icon={config.icon}
        size="sm"
        status={isUser ? 'none' : 'active'}
        className="mt-0.5 shrink-0"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-sm font-semibold ${config.color}`}>{config.label}</span>
          <span className="text-[10px] text-text-muted">
            {new Date(message.timestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        <div className="text-sm text-text-primary leading-relaxed prose prose-sm max-w-none
                        prose-p:my-1 prose-p:leading-relaxed
                        prose-code:text-accent prose-code:text-xs prose-code:bg-bg-elevated prose-code:px-1 prose-code:py-0.5 prose-code:rounded
                        prose-pre:bg-bg-deep prose-pre:border prose-pre:border-border prose-pre:rounded-lg
                        prose-headings:text-text-primary prose-strong:text-text-primary
                        prose-a:text-accent prose-a:no-underline hover:prose-a:underline">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
        </div>
      </div>
    </div>
  )
}
