import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Folder, FolderOpen, FileText, ChevronRight } from 'lucide-react'

interface FileEntry {
  name: string
  path: string
  is_dir: boolean
  size: number
  children: FileEntry[]
}

function formatSize(bytes: number): string {
  if (bytes === 0) return ''
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

function FileTreeNode({ entry, depth = 0 }: { entry: FileEntry; depth?: number }) {
  const [expanded, setExpanded] = useState(depth < 1)

  const ext = entry.name.split('.').pop()?.toLowerCase() || ''
  const extColors: Record<string, string> = {
    ts: 'text-cyan', tsx: 'text-cyan',
    js: 'text-warning', jsx: 'text-warning',
    py: 'text-accent', rs: 'text-danger',
    css: 'text-violet', html: 'text-danger',
    json: 'text-warning', md: 'text-text-secondary',
    toml: 'text-warning', yaml: 'text-accent', yml: 'text-accent',
  }
  const fileColor = extColors[ext] || 'text-text-muted'

  if (entry.is_dir) {
    return (
      <div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center gap-1.5 py-1 px-1 rounded hover:bg-bg-hover transition-colors group"
          style={{ paddingLeft: `${depth * 16 + 4}px` }}
        >
          <ChevronRight
            className={`w-3 h-3 text-text-muted transition-transform ${expanded ? 'rotate-90' : ''}`}
          />
          {expanded ? (
            <FolderOpen className="w-3.5 h-3.5 text-accent/70" />
          ) : (
            <Folder className="w-3.5 h-3.5 text-accent/50" />
          )}
          <span className="text-[11px] text-text-primary truncate">{entry.name}</span>
          <span className="text-[9px] text-text-muted ml-auto font-mono">{entry.children.length}</span>
        </button>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden"
            >
              {entry.children.map((child) => (
                <FileTreeNode key={child.path} entry={child} depth={depth + 1} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }

  return (
    <div
      className="flex items-center gap-1.5 py-0.5 px-1 rounded hover:bg-bg-hover transition-colors"
      style={{ paddingLeft: `${depth * 16 + 20}px` }}
    >
      <FileText className={`w-3 h-3 ${fileColor} shrink-0`} />
      <span className={`text-[11px] ${fileColor} truncate`}>{entry.name}</span>
      {entry.size > 0 && (
        <span className="text-[9px] text-text-muted ml-auto font-mono shrink-0">
          {formatSize(entry.size)}
        </span>
      )}
    </div>
  )
}

interface FileExplorerProps {
  files: FileEntry[]
  loading: boolean
}

export function FileExplorer({ files, loading }: FileExplorerProps) {
  if (loading) {
    return (
      <div className="glass rounded-xl p-4 h-full">
        <div className="font-hud text-[10px] text-cyan mb-3">File Explorer</div>
        <div className="flex items-center gap-2 text-text-muted text-xs">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="w-3 h-3 border border-accent border-t-transparent rounded-full" />
          Scanning project...
        </div>
      </div>
    )
  }

  const totalFiles = files.reduce(function countFiles(acc: number, f: FileEntry): number {
    return acc + (f.is_dir ? f.children.reduce(countFiles, 0) : 1)
  }, 0)

  return (
    <div className="glass rounded-xl p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <span className="font-hud text-[10px] text-cyan">File Explorer</span>
        <span className="text-[10px] text-text-muted font-mono">{totalFiles} files</span>
      </div>
      <div className="flex-1 overflow-y-auto space-y-0.5">
        {files.length === 0 ? (
          <p className="text-xs text-text-muted font-mono">No files found.</p>
        ) : (
          files.map((entry) => <FileTreeNode key={entry.path} entry={entry} />)
        )}
      </div>
    </div>
  )
}
