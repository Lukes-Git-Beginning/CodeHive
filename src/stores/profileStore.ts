import { create } from 'zustand'
import { getSetting, setSetting } from '../services/persistence'

export interface UserProfile {
  // Arbeitsgewohnheiten
  preferredMode: 'orchestrator' | 'direct'
  totalRuns: number
  taskTypeFrequency: Record<string, number> // z.B. { 'security': 5, 'testing': 3 }
  frequentRoles: string[] // Meistgenutzte Agent-Rollen

  // Projekt-Patterns
  lastActiveFiles: string[]
  preferredTechStack: string[]

  // Feedback-Daten
  positiveRuns: number
  negativeRuns: number
  feedbackNotes: string[]

  // Meta
  firstSeen: string
  lastSeen: string
  runsSinceLastSelfImprove: number
}

const DEFAULT_PROFILE: UserProfile = {
  preferredMode: 'orchestrator',
  totalRuns: 0,
  taskTypeFrequency: {},
  frequentRoles: [],
  lastActiveFiles: [],
  preferredTechStack: [],
  positiveRuns: 0,
  negativeRuns: 0,
  feedbackNotes: [],
  firstSeen: new Date().toISOString(),
  lastSeen: new Date().toISOString(),
  runsSinceLastSelfImprove: 0,
}

interface ProfileStore {
  profile: UserProfile
  loaded: boolean

  loadProfile: () => Promise<void>
  saveProfile: () => Promise<void>

  // Learning methods
  recordRun: (prompt: string, roles: string[], success: boolean) => void
  recordFeedback: (positive: boolean, note?: string) => void
  recordMode: (mode: 'orchestrator' | 'direct') => void
  getContextSummary: () => string
}

export const useProfileStore = create<ProfileStore>((set, get) => ({
  profile: { ...DEFAULT_PROFILE },
  loaded: false,

  loadProfile: async () => {
    const saved = await getSetting('metis_user_profile')
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Partial<UserProfile>
        set({ profile: { ...DEFAULT_PROFILE, ...parsed }, loaded: true })
      } catch {
        set({ loaded: true })
      }
    } else {
      set({ loaded: true })
    }
  },

  saveProfile: async () => {
    const { profile } = get()
    await setSetting('metis_user_profile', JSON.stringify(profile))
  },

  recordRun: (prompt, roles, success) => {
    set((s) => {
      const p = { ...s.profile }
      p.totalRuns++
      p.lastSeen = new Date().toISOString()
      p.runsSinceLastSelfImprove++

      // Track task type frequency from prompt keywords
      const keywords = ['security', 'test', 'refactor', 'feature', 'bug', 'deploy', 'review', 'audit', 'docs']
      for (const kw of keywords) {
        if (prompt.toLowerCase().includes(kw)) {
          p.taskTypeFrequency[kw] = (p.taskTypeFrequency[kw] || 0) + 1
        }
      }

      // Track role frequency
      for (const role of roles) {
        if (!p.frequentRoles.includes(role)) {
          p.frequentRoles = [...p.frequentRoles, role].slice(-10)
        }
      }

      if (success) p.positiveRuns++
      else p.negativeRuns++

      return { profile: p }
    })

    // Auto-save after recording
    get().saveProfile()
  },

  recordFeedback: (positive, note) => {
    set((s) => {
      const p = { ...s.profile }
      if (positive) p.positiveRuns++
      else p.negativeRuns++
      if (note) p.feedbackNotes = [...p.feedbackNotes, note].slice(-20)
      return { profile: p }
    })
    get().saveProfile()
  },

  recordMode: (mode) => {
    set((s) => ({ profile: { ...s.profile, preferredMode: mode } }))
    get().saveProfile()
  },

  getContextSummary: () => {
    const { profile: p } = get()
    const lines: string[] = []

    if (p.totalRuns > 0) {
      lines.push(`User hat bisher ${p.totalRuns} Runs durchgeführt.`)
    }

    // Top task types
    const topTypes = Object.entries(p.taskTypeFrequency)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
    if (topTypes.length > 0) {
      lines.push(`Häufigste Aufgaben: ${topTypes.map(([k, v]) => `${k}(${v}x)`).join(', ')}`)
    }

    // Success rate
    const total = p.positiveRuns + p.negativeRuns
    if (total > 2) {
      const rate = Math.round((p.positiveRuns / total) * 100)
      lines.push(`Erfolgsrate: ${rate}%`)
    }

    // Preferred mode
    if (p.totalRuns > 5) {
      lines.push(`Bevorzugter Modus: ${p.preferredMode === 'direct' ? 'Direct (schnell)' : 'Pipeline (gründlich)'}`)
    }

    if (p.feedbackNotes.length > 0) {
      lines.push(`Letztes Feedback: "${p.feedbackNotes[p.feedbackNotes.length - 1]}"`)
    }

    return lines.length > 0 ? `\n--- User-Profil ---\n${lines.join('\n')}` : ''
  },
}))
