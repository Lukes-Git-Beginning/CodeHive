import { create } from 'zustand'

export type NotificationType = 'info' | 'success' | 'warning' | 'error'

export interface Notification {
  id: string
  type: NotificationType
  message: string
  timestamp: string
  dismissed: boolean
}

interface NotificationStore {
  notifications: Notification[]
  addNotification: (type: NotificationType, message: string) => void
  dismissNotification: (id: string) => void
  markAllRead: () => void
  deleteNotification: (id: string) => void
  clearAll: () => void
}

export const useNotificationStore = create<NotificationStore>((set) => ({
  notifications: [],

  addNotification: (type, message) =>
    set((s) => ({
      notifications: [
        {
          id: crypto.randomUUID(),
          type,
          message,
          timestamp: new Date().toISOString(),
          dismissed: false,
        },
        ...s.notifications,
      ].slice(0, 50), // Keep max 50
    })),

  dismissNotification: (id) =>
    set((s) => ({
      notifications: s.notifications.map((n) =>
        n.id === id ? { ...n, dismissed: true } : n
      ),
    })),

  markAllRead: () =>
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, dismissed: true })),
    })),

  deleteNotification: (id) =>
    set((s) => ({
      notifications: s.notifications.filter((n) => n.id !== id),
    })),

  clearAll: () => set({ notifications: [] }),
}))
