import { create } from 'zustand'
import type { ChatMessage } from '../types/agent'

interface ChatStore {
  messages: ChatMessage[]
  isProcessing: boolean

  addMessage: (message: ChatMessage) => void
  setProcessing: (processing: boolean) => void
  clearMessages: () => void
}

export const useChatStore = create<ChatStore>((set) => ({
  messages: [],
  isProcessing: false,

  addMessage: (message) =>
    set((s) => ({ messages: [...s.messages, message] })),
  setProcessing: (processing) => set({ isProcessing: processing }),
  clearMessages: () => set({ messages: [] }),
}))
