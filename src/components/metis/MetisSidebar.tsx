import { useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MessageCircle,
  BookOpen,
  Bot,
  LayoutDashboard,
  ScrollText,
  ScanLine,
  Map,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'
import { useUIStore } from '../../stores/uiStore'

const NAV_ITEMS = [
  { path: '/chat', label: 'Chat', icon: MessageCircle },
  { path: '/knowledge', label: 'Knowledge', icon: BookOpen },
  { path: '/agents', label: 'Agents', icon: Bot },
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/logs', label: 'Logs', icon: ScrollText },
  { path: '/deepscan', label: 'Deep Scan', icon: ScanLine },
  { path: '/roadmap', label: 'Roadmap', icon: Map },
]

export function MetisSidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const collapsed = useUIStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen)

  return (
    <motion.aside
      animate={{ width: collapsed ? 56 : 220 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className="h-full flex flex-col bg-bg-surface/50 border-r border-border shrink-0 overflow-hidden"
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-3 h-14 border-b border-border shrink-0">
        <div className="w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center shrink-0">
          <span className="text-accent font-bold text-sm">M</span>
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.15 }}
            >
              <span className="font-semibold text-sm text-text-primary tracking-wide">Metis</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-2 px-2 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = location.pathname === item.path
          const Icon = item.icon
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              title={collapsed ? item.label : undefined}
              className={`
                w-full flex items-center gap-3 rounded-lg transition-all duration-150
                ${collapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2'}
                ${isActive
                  ? 'bg-accent/10 text-accent shadow-subtle'
                  : 'text-text-muted hover:text-text-primary hover:bg-bg-hover'
                }
              `}
            >
              <Icon className="w-[18px] h-[18px] shrink-0" />
              <AnimatePresence>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-sm font-medium truncate"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          )
        })}
      </nav>

      {/* Bottom actions */}
      <div className="border-t border-border p-2 space-y-0.5">
        <button
          onClick={() => setSettingsOpen(true)}
          title={collapsed ? 'Einstellungen' : undefined}
          className={`
            w-full flex items-center gap-3 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-hover transition-all duration-150
            ${collapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2'}
          `}
        >
          <Settings className="w-[18px] h-[18px] shrink-0" />
          {!collapsed && <span className="text-sm font-medium">Einstellungen</span>}
        </button>
        <button
          onClick={toggleSidebar}
          title={collapsed ? 'Sidebar erweitern' : 'Sidebar einklappen'}
          className={`
            w-full flex items-center gap-3 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-hover transition-all duration-150
            ${collapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2'}
          `}
        >
          {collapsed
            ? <PanelLeftOpen className="w-[18px] h-[18px] shrink-0" />
            : <PanelLeftClose className="w-[18px] h-[18px] shrink-0" />
          }
          {!collapsed && <span className="text-sm font-medium">Einklappen</span>}
        </button>
      </div>
    </motion.aside>
  )
}
