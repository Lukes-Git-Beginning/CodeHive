import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, X, Info, CheckCircle, AlertTriangle, AlertCircle, Trash2 } from 'lucide-react'
import { useNotificationStore, type NotificationType, type Notification } from '../../stores/notificationStore'

const ICON_MAP: Record<NotificationType, typeof Info> = {
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error: AlertCircle,
}

const COLOR_MAP: Record<NotificationType, string> = {
  info: 'text-accent',
  success: 'text-accent',
  warning: 'text-warning',
  error: 'text-danger',
}

const FILTER_LABELS: Record<string, string> = {
  all: 'Alle',
  info: 'Info',
  success: 'Erfolg',
  warning: 'Warnung',
  error: 'Fehler',
}

function timeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime()
  const min = Math.floor(diff / 60_000)
  if (min < 1) return 'Gerade eben'
  if (min < 60) return `Vor ${min}m`
  const hours = Math.floor(min / 60)
  if (hours < 24) return `Vor ${hours}h`
  const days = Math.floor(hours / 24)
  return `Vor ${days}d`
}

function groupByTime(notifications: Notification[]): Record<string, Notification[]> {
  const now = new Date()
  const today = now.toDateString()
  const yesterday = new Date(now.getTime() - 86_400_000).toDateString()
  const groups: Record<string, Notification[]> = {}

  for (const n of notifications) {
    const date = new Date(n.timestamp).toDateString()
    const key = date === today ? 'Heute' : date === yesterday ? 'Gestern' : 'Älter'
    if (!groups[key]) groups[key] = []
    groups[key].push(n)
  }
  return groups
}

interface NotificationCenterProps {
  isOpen: boolean
  onClose: () => void
}

export function NotificationCenter({ isOpen, onClose }: NotificationCenterProps) {
  const notifications = useNotificationStore((s) => s.notifications)
  const markAllRead = useNotificationStore((s) => s.markAllRead)
  const deleteNotification = useNotificationStore((s) => s.deleteNotification)
  const clearAll = useNotificationStore((s) => s.clearAll)
  const [filter, setFilter] = useState<string>('all')

  const filtered = filter === 'all'
    ? notifications
    : notifications.filter((n) => n.type === filter)

  const grouped = groupByTime(filtered)
  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-bg-deep/50 backdrop-blur-sm z-40"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            role="dialog"
            aria-modal="true"
            aria-label="Benachrichtigungen"
            className="fixed top-0 right-0 h-screen w-[380px] glass-elevated border-l border-border z-50 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-border shrink-0">
              <div className="flex items-center gap-3">
                <Bell className="w-5 h-5 text-accent" />
                <h2 className="font-semibold text-sm text-text-primary">Benachrichtigungen</h2>
                {unreadCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-accent/20 text-accent font-mono text-[9px]">{unreadCount}</span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {notifications.length > 0 && (
                  <>
                    <button onClick={markAllRead} className="p-1.5 rounded-md hover:bg-bg-surface text-text-muted hover:text-accent transition-colors text-[9px] font-medium">
                      Gelesen
                    </button>
                    <button onClick={clearAll} className="p-1.5 rounded-md hover:bg-danger/20 text-text-muted hover:text-danger transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
                <button onClick={onClose} className="p-2 hover:bg-bg-surface rounded-lg text-text-muted hover:text-text-primary transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Filter */}
            <div className="flex gap-1.5 px-5 py-3 border-b border-border shrink-0">
              {Object.entries(FILTER_LABELS).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  aria-current={filter === key ? 'true' : undefined}
                  className={`text-[9px] font-medium px-2.5 py-1 rounded-full transition-colors ${
                    filter === key ? 'bg-accent/20 text-accent' : 'bg-bg-surface text-text-muted hover:text-text-secondary'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-text-muted">
                  <Bell className="w-8 h-8 mb-3 opacity-20" />
                  <p className="text-xs font-mono">Keine Benachrichtigungen</p>
                </div>
              ) : (
                Object.entries(grouped).map(([group, items]) => (
                  <section key={group}>
                    <p className="font-medium text-[9px] text-text-muted mb-2">{group}</p>
                    <div className="space-y-1.5">
                      {items.map((n) => {
                        const Icon = ICON_MAP[n.type]
                        const color = COLOR_MAP[n.type]
                        return (
                          <div
                            key={n.id}
                            className={`glass rounded-lg px-3 py-2.5 flex items-start gap-2.5 group ${
                              n.dismissed ? 'opacity-50' : ''
                            }`}
                          >
                            <Icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${color}`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] text-text-primary">{n.message}</p>
                              <p className="text-[9px] text-text-muted font-mono mt-0.5">{timeAgo(n.timestamp)}</p>
                            </div>
                            <button
                              onClick={() => deleteNotification(n.id)}
                              aria-label="Löschen"
                              className="p-1 rounded opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 hover:bg-danger/20 text-text-muted hover:text-danger transition-all"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </section>
                ))
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
