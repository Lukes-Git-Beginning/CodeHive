import { create } from 'zustand'
import { getSetting, setSetting } from '../services/persistence'

interface UIStore {
  sidebarCollapsed: boolean
  commandPaletteOpen: boolean
  notificationCenterOpen: boolean
  settingsOpen: boolean
  shortcutOverlayOpen: boolean

  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
  setCommandPaletteOpen: (open: boolean) => void
  setNotificationCenterOpen: (open: boolean) => void
  setSettingsOpen: (open: boolean) => void
  setShortcutOverlayOpen: (open: boolean) => void
  loadUI: () => Promise<void>
}

export const useUIStore = create<UIStore>((set, get) => ({
  sidebarCollapsed: false,
  commandPaletteOpen: false,
  notificationCenterOpen: false,
  settingsOpen: false,
  shortcutOverlayOpen: false,

  toggleSidebar: () => {
    const next = !get().sidebarCollapsed
    set({ sidebarCollapsed: next })
    setSetting('sidebar_collapsed', next ? 'true' : 'false')
  },

  setSidebarCollapsed: (collapsed) => {
    set({ sidebarCollapsed: collapsed })
    setSetting('sidebar_collapsed', collapsed ? 'true' : 'false')
  },

  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  setNotificationCenterOpen: (open) => set({ notificationCenterOpen: open }),
  setSettingsOpen: (open) => set({ settingsOpen: open }),
  setShortcutOverlayOpen: (open) => set({ shortcutOverlayOpen: open }),

  loadUI: async () => {
    const collapsed = await getSetting('sidebar_collapsed')
    if (collapsed === 'true') set({ sidebarCollapsed: true })
  },
}))
