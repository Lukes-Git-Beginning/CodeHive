import { motion } from 'framer-motion'

interface Tab {
  id: string
  label: string
  icon?: React.ReactNode
  count?: number
}

interface TabsProps {
  tabs: Tab[]
  activeTab: string
  onTabChange: (id: string) => void
  className?: string
}

export function Tabs({ tabs, activeTab, onTabChange, className = '' }: TabsProps) {
  return (
    <div className={`flex gap-1 p-1 rounded-lg bg-bg-surface border border-border ${className}`}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`
            relative flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md
            transition-colors duration-200
            ${activeTab === tab.id
              ? 'text-text-primary'
              : 'text-text-muted hover:text-text-secondary hover:bg-bg-hover'
            }
          `}
        >
          {activeTab === tab.id && (
            <motion.div
              layoutId="active-tab"
              className="absolute inset-0 bg-bg-elevated border border-border-accent rounded-md shadow-subtle"
              transition={{ type: 'spring', duration: 0.3, bounce: 0.15 }}
            />
          )}
          <span className="relative z-10 flex items-center gap-2">
            {tab.icon}
            {tab.label}
            {tab.count !== undefined && (
              <span className="text-xs text-text-muted bg-bg-surface px-1.5 rounded-full">
                {tab.count}
              </span>
            )}
          </span>
        </button>
      ))}
    </div>
  )
}
