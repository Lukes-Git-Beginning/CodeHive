import { create } from 'zustand'
import { invoke } from '@tauri-apps/api/core'
import type { TeamMember, TaskAssignment } from '../types/team'

const AVATAR_COLORS = ['var(--color-accent)', 'var(--color-cyan)', 'var(--color-violet)', 'var(--color-warning)']

interface TeamStore {
  members: TeamMember[]
  assignments: TaskAssignment[]

  loadMembers: () => Promise<void>
  loadAssignments: () => Promise<void>
  addMember: (name: string, role: string, email?: string) => Promise<void>
  removeMember: (id: string) => Promise<void>
  assignTask: (taskId: string, memberId: string) => Promise<void>
  unassignTask: (assignmentId: string) => Promise<void>
}

export const useTeamStore = create<TeamStore>((set, get) => ({
  members: [],
  assignments: [],

  loadMembers: async () => {
    try {
      const members = await invoke<TeamMember[]>('db_list_members')
      set({ members })
    } catch {
      set({ members: [] })
    }
  },

  loadAssignments: async () => {
    try {
      const assignments = await invoke<TaskAssignment[]>('db_list_assignments')
      set({ assignments })
    } catch {
      set({ assignments: [] })
    }
  },

  addMember: async (name, role, email?) => {
    const memberCount = get().members.length
    const member: TeamMember = {
      id: crypto.randomUUID(),
      name,
      role,
      email,
      avatar_color: AVATAR_COLORS[memberCount % AVATAR_COLORS.length],
      created_at: new Date().toISOString(),
    }
    try {
      await invoke('db_save_member', { member })
      set({ members: [...get().members, member] })
    } catch (err) {
      console.error('Failed to save team member:', err)
    }
  },

  removeMember: async (id) => {
    try {
      await invoke('db_delete_member', { id })
      set({
        members: get().members.filter((m) => m.id !== id),
        assignments: get().assignments.filter((a) => a.member_id !== id),
      })
    } catch (err) {
      console.error('Failed to delete team member:', err)
    }
  },

  assignTask: async (taskId, memberId) => {
    const assignment: TaskAssignment = {
      id: crypto.randomUUID(),
      task_id: taskId,
      member_id: memberId,
      assigned_at: new Date().toISOString(),
    }
    try {
      await invoke('db_save_assignment', { assignment })
      set({ assignments: [...get().assignments, assignment] })
    } catch (err) {
      console.error('Failed to save assignment:', err)
    }
  },

  unassignTask: async (assignmentId) => {
    try {
      await invoke('db_delete_assignment', { id: assignmentId })
      set({ assignments: get().assignments.filter((a) => a.id !== assignmentId) })
    } catch (err) {
      console.error('Failed to delete assignment:', err)
    }
  },
}))
