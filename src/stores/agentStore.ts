import { create } from 'zustand'
import type { AgentInstance, AgentRun } from '../types/agent'

type OrchestratorPhase = 'idle' | 'planning' | 'executing' | 'verifying' | 'done'

interface AgentStore {
  currentRun: AgentRun | null
  runHistory: AgentRun[]
  phase: OrchestratorPhase
  currentWave: number
  totalWaves: number

  startRun: (run: AgentRun) => void
  finishRun: (summary: string) => void
  setPhase: (phase: OrchestratorPhase) => void
  setWaveInfo: (current: number, total: number) => void
  addAgent: (agent: AgentInstance) => void
  updateAgent: (agentId: string, updates: Partial<AgentInstance>) => void
  appendAgentOutput: (agentId: string, line: string) => void
}

export const useAgentStore = create<AgentStore>((set) => ({
  currentRun: null,
  runHistory: [],
  phase: 'idle',
  currentWave: 0,
  totalWaves: 0,

  startRun: (run) => set({ currentRun: run, phase: 'planning' }),

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
        runHistory: [finished, ...s.runHistory].slice(0, 20),
        phase: 'done',
        currentWave: 0,
        totalWaves: 0,
      }
    }),

  setPhase: (phase) => set({ phase }),
  setWaveInfo: (current, total) => set({ currentWave: current, totalWaves: total }),

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
