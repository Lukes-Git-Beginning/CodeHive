import { create } from 'zustand'
import { getSetting, setSetting } from '../services/persistence'

export type Theme = 'dark' | 'light'

interface ThemeStore {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
  loadTheme: () => Promise<void>
}

export const useThemeStore = create<ThemeStore>((set, get) => ({
  theme: 'dark',

  setTheme: (theme: Theme) => {
    document.documentElement.setAttribute('data-theme', theme)
    set({ theme })
    setSetting('theme', theme)
  },

  toggleTheme: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark'
    get().setTheme(next)
  },

  loadTheme: async () => {
    const saved = await getSetting('theme')
    const theme: Theme = saved === 'light' ? 'light' : 'dark'
    document.documentElement.setAttribute('data-theme', theme)
    set({ theme })
  },
}))
