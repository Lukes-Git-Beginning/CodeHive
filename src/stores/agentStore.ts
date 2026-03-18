import { create } from 'zustand'
import type { AgentInstance, AgentRun } from '../types/agent'

type OrchestratorPhase = 'idle' | 'planning' | 'awaiting_approval' | 'executing' | 'verifying' | 'done'

export interface PendingPlan {
  goals: string[]
  tasks: Array<{
    id: string
    name: string
    complexity: number
    model: string
    role?: string
  }>
  waveCount: number
}

interface AgentStore {
  currentRun: AgentRun | null
  runHistory: AgentRun[]
  phase: OrchestratorPhase
  currentWave: number
  totalWaves: number
  pendingPlan: PendingPlan | null
  planApprovalResolver: (() => void) | null

  startRun: (run: AgentRun) => void
  finishRun: (summary: string) => void
  setPhase: (phase: OrchestratorPhase) => void
  setWaveInfo: (current: number, total: number) => void
  setPendingPlan: (plan: PendingPlan, resolver: () => void) => void
  approvePlan: () => void
  rejectPlan: () => void
  addAgent: (agent: AgentInstance) => void
  updateAgent: (agentId: string, updates: Partial<AgentInstance>) => void
  appendAgentOutput: (agentId: string, line: string) => void
}

export const useAgentStore = create<AgentStore>((set, get) => ({
  currentRun: null,
  runHistory: [],
  phase: 'idle',
  currentWave: 0,
  totalWaves: 0,
  pendingPlan: null,
  planApprovalResolver: null,

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
        pendingPlan: null,
        planApprovalResolver: null,
      }
    }),

  setPhase: (phase) => set({ phase }),
  setWaveInfo: (current, total) => set({ currentWave: current, totalWaves: total }),

  setPendingPlan: (plan, resolver) =>
    set({ pendingPlan: plan, planApprovalResolver: resolver, phase: 'awaiting_approval' }),

  approvePlan: () => {
    const { planApprovalResolver } = get()
    set({ pendingPlan: null, planApprovalResolver: null })
    if (planApprovalResolver) planApprovalResolver()
  },

  rejectPlan: () => {
    set((s) => {
      const rejected = s.currentRun
        ? { ...s.currentRun, status: 'rejected' as const, finishedAt: new Date().toISOString() }
        : null
      return {
        pendingPlan: null,
        planApprovalResolver: null,
        phase: 'idle',
        currentRun: null,
        runHistory: rejected
          ? [rejected, ...s.runHistory].slice(0, 20)
          : s.runHistory,
      }
    })
  },

  addAgent: (agent) =>
    set((s) => {
      if (!s.currentRun) return s
      return {
        currentRun: { ...s.currentRun, agents: [...s.currentRun.agents, agent] },
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
