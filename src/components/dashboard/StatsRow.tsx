import { motion } from 'framer-motion'
import { Code2, FileText, Zap, Clock } from 'lucide-react'
import type { Project } from '../../types/project'

interface StatsRowProps {
  project: Project
  fileCount: number
  runCount: number
}

export function StatsRow({ project, fileCount, runCount }: StatsRowProps) {
  const stats = [
    {
      icon: Code2,
      label: 'Tech Stack',
      value: project.techStack.length > 0 ? project.techStack.slice(0, 4).join(', ') : 'Unknown',
      color: 'text-accent',
    },
    {
      icon: FileText,
      label: 'Files',
      value: fileCount > 0 ? fileCount.toLocaleString() : '...',
      color: 'text-cyan',
    },
    {
      icon: Zap,
      label: 'Agent Runs',
      value: runCount.toString(),
      color: 'text-violet',
    },
    {
      icon: Clock,
      label: 'Last Modified',
      value: new Date(project.updatedAt).toLocaleDateString('de-DE'),
      color: 'text-warning',
    },
  ]

  return (
    <div className="grid grid-cols-4 gap-3 mb-4">
      {stats.map((stat, i) => {
        const Icon = stat.icon
        return (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="glass neon-hover rounded-xl p-3.5"
          >
            <div className="flex items-center gap-2 mb-2">
              <Icon className={`w-3.5 h-3.5 ${stat.color}`} />
              <span className="font-hud text-[9px] text-text-muted">{stat.label}</span>
            </div>
            <p className={`text-sm font-medium ${stat.color} truncate`}>{stat.value}</p>
          </motion.div>
        )
      })}
    </div>
  )
}
