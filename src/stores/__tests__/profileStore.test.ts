import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(null),
}))

import { useProfileStore } from '../profileStore'

describe('profileStore', () => {
  beforeEach(() => {
    // Reset store state
    useProfileStore.setState({
      profile: {
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
      },
      loaded: true,
    })
  })

  it('records a run and updates frequency', () => {
    const store = useProfileStore.getState()
    store.recordRun('Run a security audit', ['security', 'backend'], true)

    const profile = useProfileStore.getState().profile
    expect(profile.totalRuns).toBe(1)
    expect(profile.taskTypeFrequency['security']).toBe(1)
    expect(profile.taskTypeFrequency['audit']).toBe(1)
    expect(profile.positiveRuns).toBe(1)
    expect(profile.frequentRoles).toContain('security')
    expect(profile.frequentRoles).toContain('backend')
  })

  it('tracks failed runs', () => {
    const store = useProfileStore.getState()
    store.recordRun('Deploy to production', ['devops'], false)

    const profile = useProfileStore.getState().profile
    expect(profile.totalRuns).toBe(1)
    expect(profile.negativeRuns).toBe(1)
    expect(profile.taskTypeFrequency['deploy']).toBe(1)
  })

  it('records feedback', () => {
    const store = useProfileStore.getState()
    store.recordFeedback(true, 'Great result')
    store.recordFeedback(false, 'Too slow')

    const profile = useProfileStore.getState().profile
    expect(profile.positiveRuns).toBe(1)
    expect(profile.negativeRuns).toBe(1)
    expect(profile.feedbackNotes).toContain('Great result')
    expect(profile.feedbackNotes).toContain('Too slow')
  })

  it('generates context summary', () => {
    const store = useProfileStore.getState()
    store.recordRun('Security audit', ['security'], true)
    store.recordRun('Write tests', ['testing'], true)
    store.recordRun('Security check 2', ['security'], true)

    const summary = useProfileStore.getState().getContextSummary()
    expect(summary).toContain('3 Runs')
    expect(summary).toContain('security')
  })

  it('returns empty context for fresh profile', () => {
    const summary = useProfileStore.getState().getContextSummary()
    expect(summary).toBe('')
  })

  it('uses word boundaries for keyword matching', () => {
    const store = useProfileStore.getState()
    store.recordRun('Contest for attestation', [], true)

    const profile = useProfileStore.getState().profile
    // "contest" and "attestation" should NOT match "test"
    expect(profile.taskTypeFrequency['test']).toBeUndefined()
  })
})
