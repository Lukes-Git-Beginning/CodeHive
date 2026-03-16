import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Cpu, AlertCircle } from 'lucide-react'
import { useChatStore } from '../../stores/chatStore'
import { useProjectStore } from '../../stores/projectStore'
import type { ChatMessage } from '../../types/agent'

export function ChatPanel() {
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { messages, isProcessing, addMessage, setProcessing } = useChatStore()
  const activeProject = useProjectStore((s) => s.getActiveProject())

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isProcessing) return

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString(),
    }

    addMessage(userMessage)
    setInput('')
    setProcessing(true)

    // TODO: Send to orchestrator agent via Tauri IPC
    // For now, simulate a response
    setTimeout(() => {
      const systemMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'orchestrator',
        content: `Ich analysiere deine Anfrage "${userMessage.content}" im Kontext von ${activeProject?.name || 'keinem Projekt'}...\n\n🔍 Agent-Integration wird in Phase 2 implementiert. Aktuell siehst du die UI-Vorschau.`,
        timestamp: new Date().toISOString(),
      }
      addMessage(systemMessage)
      setProcessing(false)
    }, 1500)
  }

  const getMessageIcon = (msg: ChatMessage) => {
    switch (msg.role) {
      case 'user':
        return <User className="w-5 h-5 text-accent" />
      case 'orchestrator':
        return <Bot className="w-5 h-5 text-success" />
      case 'agent':
        return <Cpu className="w-5 h-5 text-blue-400" />
      case 'system':
        return <AlertCircle className="w-5 h-5 text-warning" />
    }
  }

  const getMessageLabel = (msg: ChatMessage) => {
    switch (msg.role) {
      case 'user':
        return 'Du'
      case 'orchestrator':
        return 'Orchestrator'
      case 'agent':
        return msg.agentRole || 'Agent'
      case 'system':
        return 'System'
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-text-muted">
            <Bot className="w-16 h-16 mb-4 opacity-30" />
            <h3 className="text-lg font-medium mb-1">
              {activeProject ? `Projekt: ${activeProject.name}` : 'Kein Projekt ausgewählt'}
            </h3>
            <p className="text-sm text-center max-w-md">
              {activeProject
                ? 'Beschreibe was du bauen oder ändern möchtest. Der Orchestrator analysiert die Aufgabe und spawnt die passenden Agenten.'
                : 'Wähle zuerst ein Projekt in der Sidebar aus oder füge ein neues hinzu.'}
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}
            >
              {msg.role !== 'user' && (
                <div className="shrink-0 mt-1">{getMessageIcon(msg)}</div>
              )}
              <div
                className={`max-w-[80%] rounded-lg px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-accent/20 border border-accent/30'
                    : 'bg-bg-card border border-border'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold text-text-muted">
                    {getMessageLabel(msg)}
                  </span>
                  <span className="text-xs text-text-muted">
                    {new Date(msg.timestamp).toLocaleTimeString('de-DE')}
                  </span>
                </div>
                <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
              </div>
              {msg.role === 'user' && (
                <div className="shrink-0 mt-1">{getMessageIcon(msg)}</div>
              )}
            </div>
          ))
        )}
        {isProcessing && (
          <div className="flex gap-3">
            <Bot className="w-5 h-5 text-success shrink-0 mt-1" />
            <div className="bg-bg-card border border-border rounded-lg px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-xs text-text-muted">Orchestrator denkt nach...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t border-border p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              activeProject
                ? 'Beschreibe deine Aufgabe...'
                : 'Wähle zuerst ein Projekt aus'
            }
            disabled={!activeProject || isProcessing}
            className="flex-1 bg-bg-card border border-border rounded-lg px-4 py-3 text-sm
                       text-text-primary placeholder-text-muted
                       focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/50
                       disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={!input.trim() || !activeProject || isProcessing}
            className="bg-accent hover:bg-accent-hover text-bg-primary font-medium px-4 py-3
                       rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </form>
    </div>
  )
}
