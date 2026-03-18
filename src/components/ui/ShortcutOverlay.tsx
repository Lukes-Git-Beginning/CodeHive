import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Keyboard } from 'lucide-react'

interface ShortcutOverlayProps {
  isOpen: boolean
  onClose: () => void
}

const SHORTCUT_GROUPS = [
  {
    title: 'Navigation',
    shortcuts: [
      { keys: 'Ctrl+R', desc: 'Roadmap' },
      { keys: 'Ctrl+K', desc: 'Knowledge Base' },
      { keys: 'Ctrl+D', desc: 'Dashboard' },
      { keys: 'Ctrl+M', desc: 'Mind Palace' },
      { keys: 'Ctrl+N', desc: 'Benachrichtigungen' },
      { keys: 'Ctrl+T', desc: 'Agent Templates' },
      { keys: 'Ctrl+,', desc: 'Einstellungen' },
    ],
  },
  {
    title: 'Aktionen',
    shortcuts: [
      { keys: 'Ctrl+P', desc: 'Command Palette' },
      { keys: 'Ctrl+Shift+S', desc: 'Screenshot' },
      { keys: 'Ctrl+Shift+T', desc: 'Theme wechseln' },
      { keys: '?', desc: 'Diese Übersicht' },
      { keys: 'Esc', desc: 'Panel schließen' },
    ],
  },
  {
    title: 'Listen-Navigation',
    shortcuts: [
      { keys: 'j / ↓', desc: 'Nächster Eintrag' },
      { keys: 'k / ↑', desc: 'Vorheriger Eintrag' },
      { keys: 'Enter', desc: 'Auswählen' },
      { keys: 'G', desc: 'Zum Ende' },
    ],
  },
]

function KeyBadge({ keys }: { keys: string }) {
  const parts = keys.split('+')
  return (
    <div className="flex items-center gap-1">
      {parts.map((part, i) => (
        <span key={i}>
          {i > 0 && <span className="text-text-muted mx-0.5">+</span>}
          <kbd className="px-1.5 py-0.5 rounded bg-bg-surface border border-border text-[10px] font-mono text-text-secondary">
            {part.trim()}
          </kbd>
        </span>
      ))}
    </div>
  )
}

export function ShortcutOverlay({ isOpen, onClose }: ShortcutOverlayProps) {
  const previousFocus = useRef<HTMLElement | null>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (isOpen) {
      previousFocus.current = document.activeElement as HTMLElement
      setTimeout(() => closeRef.current?.focus(), 100)
    } else if (previousFocus.current) {
      previousFocus.current.focus()
      previousFocus.current = null
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none"
          >
            <div role="dialog" aria-modal="true" aria-label="Tastenkürzel" className="glass-elevated rounded-2xl w-full max-w-2xl pointer-events-auto">
              {/* Header */}
              <div className="flex items-center justify-between p-5 border-b border-border">
                <div className="flex items-center gap-3">
                  <Keyboard className="w-5 h-5 text-accent" />
                  <h2 className="font-hud text-sm text-text-primary">Tastenkürzel</h2>
                </div>
                <button
                  ref={closeRef}
                  onClick={onClose}
                  aria-label="Schließen"
                  className="p-2 hover:bg-bg-surface rounded-lg text-text-muted hover:text-text-primary transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Grid */}
              <div className="p-5 grid grid-cols-3 gap-6">
                {SHORTCUT_GROUPS.map((group) => (
                  <div key={group.title}>
                    <h3 className="font-hud text-[9px] text-text-muted mb-3">{group.title}</h3>
                    <div className="space-y-2.5">
                      {group.shortcuts.map((s) => (
                        <div key={s.keys} className="flex items-center justify-between gap-3">
                          <span className="text-[11px] text-text-secondary">{s.desc}</span>
                          <KeyBadge keys={s.keys} />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
