import { create } from 'zustand'
import { invoke } from '@tauri-apps/api/core'
import type { TeamMember, TaskAssignment } from '../types/team'
import { useNotificationStore } from './notificationStore'

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
      useNotificationStore.getState().addNotification('error', 'Teammitglied konnte nicht gespeichert werden.')
    }
  },

  removeMember: async (id) => {
    const prevMembers = get().members
    const prevAssignments = get().assignments
    set({
      members: prevMembers.filter((m) => m.id !== id),
      assignments: prevAssignments.filter((a) => a.member_id !== id),
    })
    try {
      await invoke('db_delete_member', { id })
    } catch {
      set({ members: prevMembers, assignments: prevAssignments })
      useNotificationStore.getState().addNotification('error', 'Teammitglied konnte nicht entfernt werden.')
    }
  },

  assignTask: async (taskId, memberId) => {
    const assignment: TaskAssignment = {
      id: crypto.randomUUID(),
      task_id: taskId,
      member_id: memberId,
      assigned_at: new Date().toISOString(),
    }
    const prevAssignments = get().assignments
    set({ assignments: [...prevAssignments, assignment] })
    try {
      await invoke('db_save_assignment', { assignment })
    } catch {
      set({ assignments: prevAssignments })
      useNotificationStore.getState().addNotification('error', 'Zuweisung konnte nicht gespeichert werden.')
    }
  },

  unassignTask: async (assignmentId) => {
    const prevAssignments = get().assignments
    set({ assignments: prevAssignments.filter((a) => a.id !== assignmentId) })
    try {
      await invoke('db_delete_assignment', { id: assignmentId })
    } catch {
      set({ assignments: prevAssignments })
      useNotificationStore.getState().addNotification('error', 'Zuweisung konnte nicht entfernt werden.')
    }
  },
}))
