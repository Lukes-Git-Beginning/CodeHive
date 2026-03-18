import { useEffect, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, AlertTriangle, CheckCircle, Info, AlertCircle } from 'lucide-react'
import { useNotificationStore, type NotificationType } from '../../stores/notificationStore'

const ICON_MAP: Record<NotificationType, typeof Info> = {
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error: AlertCircle,
}

const COLOR_MAP: Record<NotificationType, string> = {
  info: 'text-cyan border-cyan/30',
  success: 'text-accent border-accent/30',
  warning: 'text-warning border-warning/30',
  error: 'text-danger border-danger/30',
}

export function ToastContainer() {
  const notifications = useNotificationStore((s) => s.notifications)
  const dismiss = useNotificationStore((s) => s.dismissNotification)

  const visible = useMemo(
    () => notifications.filter((n) => !n.dismissed).slice(0, 3),
    [notifications]
  )
  const timerMap = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  // Auto-dismiss after 6 seconds — per-notification independent timers
  useEffect(() => {
    const currentIds = new Set(visible.map((n) => n.id))

    // Start timers for new notifications only
    for (const n of visible) {
      if (!timerMap.current.has(n.id)) {
        timerMap.current.set(
          n.id,
          setTimeout(() => {
            dismiss(n.id)
            timerMap.current.delete(n.id)
          }, 6000)
        )
      }
    }

    // Clean up timers for notifications no longer visible
    for (const [id, timer] of timerMap.current) {
      if (!currentIds.has(id)) {
        clearTimeout(timer)
        timerMap.current.delete(id)
      }
    }
  }, [visible, dismiss])

  return (
    <div role="status" aria-live="polite" className="fixed bottom-16 right-4 z-[60] flex flex-col gap-2 max-w-sm">
      <AnimatePresence>
        {visible.map((n) => {
          const Icon = ICON_MAP[n.type]
          return (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, x: 50, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 50, scale: 0.95 }}
              className={`glass-elevated rounded-lg border px-3 py-2.5 flex items-start gap-2 ${COLOR_MAP[n.type]}`}
            >
              <Icon className="w-4 h-4 shrink-0 mt-0.5" />
              <p className="text-xs text-text-primary flex-1">{n.message}</p>
              <button
                onClick={() => dismiss(n.id)}
                className="text-text-muted hover:text-text-secondary shrink-0"
              >
                <X className="w-3 h-3" />
              </button>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
