import { create } from 'zustand'
import type { AgentInstance, AgentRun } from '../types/agent'

interface AgentStore {
  currentRun: AgentRun | null
  runHistory: AgentRun[]

  startRun: (run: AgentRun) => void
  finishRun: (summary: string) => void
  addAgent: (agent: AgentInstance) => void
  updateAgent: (agentId: string, updates: Partial<AgentInstance>) => void
  appendAgentOutput: (agentId: string, line: string) => void
}

export const useAgentStore = create<AgentStore>((set) => ({
  currentRun: null,
  runHistory: [],

  startRun: (run) => set({ currentRun: run }),

  finishRun: (summary) =>
    set((s) => {
      if (!s.currentRun) return s
      const finished = {
        ...s.currentRun,
        status: 'completed' as const,
        summary,
        finishedAt: new Date().toISOString(),
      }
      return {
        currentRun: null,
        runHistory: [finished, ...s.runHistory],
      }
    }),

  addAgent: (agent) =>
    set((s) => {
      if (!s.currentRun) return s
      return {
        currentRun: {
          ...s.currentRun,
          agents: [...s.currentRun.agents, agent],
        },
      }
    }),

  updateAgent: (agentId, updates) =>
    set((s) => {
      if (!s.currentRun) return s
      return {
        currentRun: {
          ...s.currentRun,
          agents: s.currentRun.agents.map((a) =>
            a.id === agentId ? { ...a, ...updates } : a
          ),
        },
      }
    }),

  appendAgentOutput: (agentId, line) =>
    set((s) => {
      if (!s.currentRun) return s
      return {
        currentRun: {
          ...s.currentRun,
          agents: s.currentRun.agents.map((a) =>
            a.id === agentId ? { ...a, output: [...a.output, line] } : a
          ),
        },
      }
    }),
}))
