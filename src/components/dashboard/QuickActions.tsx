import { motion } from 'framer-motion'
import { Play, TestTube, Bug, RefreshCw, FileSearch, Rocket } from 'lucide-react'

interface QuickActionsProps {
  onAction: (prompt: string) => void
}

const actions = [
  { icon: FileSearch, label: 'Analyze', prompt: 'Analysiere die Projektstruktur und erstelle eine Zusammenfassung', color: 'text-accent' },
  { icon: Bug, label: 'Fix Bugs', prompt: 'Finde und behebe Bugs im Code', color: 'text-danger' },
  { icon: TestTube, label: 'Tests', prompt: 'Schreibe Tests für die wichtigsten Funktionen', color: 'text-text-secondary' },
  { icon: RefreshCw, label: 'Refactor', prompt: 'Refactore den Code für bessere Lesbarkeit', color: 'text-warning' },
  { icon: Play, label: 'New Feature', prompt: 'Implementiere ein neues Feature: ', color: 'text-accent' },
  { icon: Rocket, label: 'Deploy', prompt: 'Bereite das Projekt für Deployment vor', color: 'text-accent' },
]

export function QuickActions({ onAction }: QuickActionsProps) {
  return (
    <div className="glass rounded-xl p-4">
      <div className="text-sm font-medium text-accent mb-3">Quick Actions</div>
      <div className="grid grid-cols-3 gap-2">
        {actions.map(({ icon: Icon, label, prompt, color }, i) => (
          <motion.button
            key={label}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => onAction(prompt)}
            className="glass neon-hover rounded-lg p-2.5 flex items-center gap-2 text-left"
          >
            <Icon className={`w-3.5 h-3.5 ${color} shrink-0`} />
            <span className="text-[11px] text-text-secondary">{label}</span>
          </motion.button>
        ))}
      </div>
    </div>
  )
}
