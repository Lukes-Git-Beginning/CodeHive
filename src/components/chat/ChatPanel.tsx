import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Cpu, AlertCircle, Zap, CheckCircle, X, FileCode } from 'lucide-react'
import { useChatStore } from '../../stores/chatStore'
import { useProjectStore } from '../../stores/projectStore'
import { useAgentStore } from '../../stores/agentStore'
import { orchestrate } from '../../services/orchestrator'
import type { ChatMessage } from '../../types/agent'

function PlanApprovalCard() {
  const { pendingPlan, approvePlan, rejectPlan } = useAgentStore()
  if (!pendingPlan) return null

  const modelColors: Record<string, string> = {
    opus: 'text-amber-400',
    sonnet: 'text-blue-400',
    haiku: 'text-green-400',
  }

  return (
    <div className="bg-bg-card border border-accent/30 rounded-lg p-4 mx-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <Zap className="w-4 h-4 text-accent" />
        <span className="text-sm font-semibold text-accent">Execution Plan</span>
        <span className="text-xs text-text-muted">
          {pendingPlan.tasks.length} Tasks in {pendingPlan.waveCount} Wellen
        </span>
      </div>

      {pendingPlan.goals.length > 0 && (
        <div className="mb-3">
          <span className="text-xs text-text-muted font-semibold">Ziele:</span>
          {pendingPlan.goals.map((g, i) => (
            <p key={i} className="text-xs text-text-secondary ml-2">- {g}</p>
          ))}
        </div>
      )}

      <div className="space-y-1.5 mb-4">
        {pendingPlan.tasks.map((task) => (
          <div key={task.id} className="flex items-center gap-2 text-xs">
            <FileCode className="w-3 h-3 text-text-muted shrink-0" />
            <span className="text-text-primary flex-1">{task.name}</span>
            <span className={`${modelColors[task.model] || 'text-text-muted'} font-mono`}>
              {task.model}
            </span>
            <span className="text-text-muted w-8 text-right">{task.complexity}/10</span>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <button
          onClick={approvePlan}
          className="flex-1 flex items-center justify-center gap-1.5 bg-success/20 text-success
                     border border-success/30 rounded-lg py-2 text-sm font-medium
                     hover:bg-success/30 transition-colors"
        >
          <CheckCircle className="w-4 h-4" />
          Ausführen
        </button>
        <button
          onClick={rejectPlan}
          className="flex-1 flex items-center justify-center gap-1.5 bg-error/20 text-error
                     border border-error/30 rounded-lg py-2 text-sm font-medium
                     hover:bg-error/30 transition-colors"
        >
          <X className="w-4 h-4" />
          Abbrechen
        </button>
      </div>
    </div>
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
        content: `Fehler beim Starten der Agenten: ${err}`,
        timestamp: new Date().toISOString(),
      })
      setProcessing(false)
    }
  }

  const getMessageIcon = (msg: ChatMessage) => {
    switch (msg.role) {
      case 'user':
        return <User className="w-5 h-5 text-accent" />
      case 'orchestrator':
        return <Zap className="w-5 h-5 text-success" />
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
        return msg.agentRole
          ? msg.agentRole.charAt(0).toUpperCase() + msg.agentRole.slice(1)
          : 'Agent'
      case 'system':
        return 'System'
    }
  }

  const getRoleBadgeColor = (msg: ChatMessage) => {
    if (msg.role === 'agent') {
      const colors: Record<string, string> = {
        frontend: 'bg-blue-500/20 text-blue-400',
        backend: 'bg-green-500/20 text-green-400',
        testing: 'bg-purple-500/20 text-purple-400',
        architect: 'bg-orange-500/20 text-orange-400',
        devops: 'bg-cyan-500/20 text-cyan-400',
        security: 'bg-red-500/20 text-red-400',
        uiux: 'bg-pink-500/20 text-pink-400',
      }
      return colors[msg.agentRole || ''] || 'bg-gray-500/20 text-gray-400'
    }
    return ''
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
            <p className="text-sm text-center max-w-md mb-6">
              {activeProject
                ? 'Beschreibe was du bauen oder ändern möchtest. Der Orchestrator analysiert die Aufgabe und spawnt die passenden Agenten.'
                : 'Wähle zuerst ein Projekt in der Sidebar aus oder füge ein neues hinzu.'}
            </p>
            {activeProject && (
              <div className="grid grid-cols-2 gap-2 max-w-sm">
                {[
                  'Füge ein neues Feature hinzu',
                  'Finde und behebe den Bug in...',
                  'Schreibe Tests für...',
                  'Refactore die...',
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => setInput(suggestion)}
                    className="text-xs bg-bg-card border border-border rounded-lg px-3 py-2
                               hover:border-accent/50 hover:text-accent transition-colors text-left"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
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
                  {msg.role === 'agent' && msg.agentRole && (
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${getRoleBadgeColor(msg)}`}>
                      {getMessageLabel(msg)}
                    </span>
                  )}
                  {msg.role !== 'agent' && (
                    <span className="text-xs font-semibold text-text-muted">
                      {getMessageLabel(msg)}
                    </span>
                  )}
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
        {pendingPlan && <PlanApprovalCard />}
        {isProcessing && !pendingPlan && (
          <div className="flex gap-3">
            <Zap className="w-5 h-5 text-success shrink-0 mt-1" />
            <div className="bg-bg-card border border-border rounded-lg px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-xs text-text-muted">Agenten arbeiten...</span>
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
