import { create } from 'zustand'
import { invoke } from '@tauri-apps/api/core'
import type { ChatMessage } from '../types/agent'

interface DbMessage {
  id: string
  project_id: string
  role: string
  agent_role: string | null
  content: string
  timestamp: string
}

interface ChatStore {
  messages: ChatMessage[]
  isProcessing: boolean
  activeProjectId: string | null

  addMessage: (message: ChatMessage) => void
  setProcessing: (processing: boolean) => void
  clearMessages: () => void
  loadMessages: (projectId: string) => Promise<void>
  setActiveProjectId: (id: string | null) => void
}

export const useChatStore = create<ChatStore>((set, get) => ({
  messages: [],
  isProcessing: false,
  activeProjectId: null,

  addMessage: (message) => {
    set((s) => ({ messages: [...s.messages, message] }))

    // Persist to DB
    const projectId = get().activeProjectId
    if (projectId) {
      invoke('db_save_message', {
        msg: {
          id: message.id,
          project_id: projectId,
          role: message.role,
          agent_role: message.agentRole || null,
          content: message.content,
          timestamp: message.timestamp,
        },
      }).catch(() => { /* silent — DB persistence is best-effort */ })
    }
  },

  setProcessing: (processing) => set({ isProcessing: processing }),

  clearMessages: () => {
    set({ messages: [] })
    const projectId = get().activeProjectId
    if (projectId) {
      invoke('db_clear_messages', { projectId }).catch(() => {})
    }
  },

  loadMessages: async (projectId) => {
    set({ activeProjectId: projectId })
    try {
      const dbMessages = await invoke<DbMessage[]>('db_load_messages', { projectId, limit: 100 })
      // Stale check: only update if projectId is still active
      if (get().activeProjectId !== projectId) return
      const messages: ChatMessage[] = dbMessages.map((m) => ({
        id: m.id,
        role: m.role as ChatMessage['role'],
        agentRole: m.agent_role as ChatMessage['agentRole'],
        content: m.content,
        timestamp: m.timestamp,
      }))
      set({ messages })
    } catch {
      if (get().activeProjectId !== projectId) return
      set({ messages: [] })
    }
  },

  setActiveProjectId: (id) => set({ activeProjectId: id }),
}))
