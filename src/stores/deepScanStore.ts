import { create } from 'zustand'

export type DeepScanPhase =
  | 'idle'
  | 'inventory'
  | 'categorize'
  | 'graph'
  | 'quick_scan'
  | 'deep_analysis'
  | 'storing'
  | 'done'
  | 'error'

export interface DeepScanProgress {
  phase: DeepScanPhase
  phaseLabel: string
  progress: number // 0-100
  details?: string
  startedAt: string
  error?: string
}

export interface DeepScanResult {
  projectId: string
  projectName: string
  techStack: string[]
  fileStats: { total: number; byType: Record<string, number> }
  graphStats: { nodes: number; edges: number; topConnected: string[] }
  quickScanResults: Array<{ type: string; title: string; detail: string }>
  agentAnalysis: string
  storedEntries: number
  duration: number
  scannedAt: string
}

interface DeepScanStore {
  isScanning: boolean
  currentProjectId: string | null
  progress: DeepScanProgress | null
  lastResults: Record<string, DeepScanResult> // projectId -> result
  cancelled: boolean

  startScan: (projectId: string) => void
  updateProgress: (progress: DeepScanProgress) => void
  finishScan: (result: DeepScanResult) => void
  failScan: (error: string) => void
  cancelScan: () => void
  getLastResult: (projectId: string) => DeepScanResult | undefined
}

export const useDeepScanStore = create<DeepScanStore>((set, get) => ({
  isScanning: false,
  currentProjectId: null,
  progress: null,
  lastResults: {},
  cancelled: false,

  startScan: (projectId) =>
    set({
      isScanning: true,
      currentProjectId: projectId,
      cancelled: false,
      progress: {
        phase: 'inventory',
        phaseLabel: 'Inventar erstellen...',
        progress: 0,
        startedAt: new Date().toISOString(),
      },
    }),

  updateProgress: (progress) => set({ progress }),

  finishScan: (result) =>
    set((state) => ({
      isScanning: false,
      currentProjectId: null,
      progress: {
        phase: 'done',
        phaseLabel: 'Fertig!',
        progress: 100,
        startedAt: state.progress?.startedAt || new Date().toISOString(),
      },
      lastResults: { ...state.lastResults, [result.projectId]: result },
    })),

  failScan: (error) =>
    set((state) => ({
      isScanning: false,
      currentProjectId: null,
      progress: {
        phase: 'error',
        phaseLabel: 'Fehler',
        progress: 0,
        startedAt: state.progress?.startedAt || new Date().toISOString(),
        error,
      },
    })),

  cancelScan: () => set({ cancelled: true }),

  getLastResult: (projectId) => get().lastResults[projectId],
}))
