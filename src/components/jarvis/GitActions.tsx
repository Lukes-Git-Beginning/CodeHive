import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GitCommitHorizontal, Upload, Download, GitBranch, Loader2 } from 'lucide-react'
import { gitCommit, gitPush, gitPull, gitCheckout } from '../../services/git'
import { useGitStore } from '../../stores/gitStore'
import { useNotificationStore } from '../../stores/notificationStore'

interface GitActionsProps {
  projectPath: string
}

type ActiveForm = 'commit' | 'branch' | null

export function GitActions({ projectPath }: GitActionsProps) {
  const gitStatus = useGitStore((s) => s.status)
  const refresh = useGitStore((s) => s.refresh)
  const notify = useNotificationStore((s) => s.addNotification)
  const [activeForm, setActiveForm] = useState<ActiveForm>(null)
  const [commitMsg, setCommitMsg] = useState('')
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [branchName, setBranchName] = useState('')
  const [loading, setLoading] = useState<string | null>(null)

  const handleCommit = async () => {
    if (!commitMsg.trim()) return
    setLoading('commit')
    try {
      const files = selectedFiles.size > 0 ? [...selectedFiles] : undefined
      const result = await gitCommit(projectPath, commitMsg.trim(), files)
      notify('success', `Commit erstellt: ${result.slice(0, 8)}`)
      setCommitMsg('')
      setSelectedFiles(new Set())
      setActiveForm(null)
      refresh(projectPath)
    } catch (err) {
      notify('error', `Commit fehlgeschlagen: ${err}`)
    }
    setLoading(null)
  }

  const handlePush = async () => {
    setLoading('push')
    try {
      await gitPush(projectPath)
      notify('success', 'Push erfolgreich')
      refresh(projectPath)
    } catch (err) {
      notify('error', `Push fehlgeschlagen: ${err}`)
    }
    setLoading(null)
  }

  const handlePull = async () => {
    setLoading('pull')
    try {
      await gitPull(projectPath)
      notify('success', 'Pull erfolgreich')
      refresh(projectPath)
    } catch (err) {
      notify('error', `Pull fehlgeschlagen: ${err}`)
    }
    setLoading(null)
  }

  const handleBranch = async () => {
    if (!branchName.trim()) return
    setLoading('branch')
    try {
      await gitCheckout(projectPath, branchName.trim(), true)
      notify('success', `Branch "${branchName.trim()}" erstellt`)
      setBranchName('')
      setActiveForm(null)
      refresh(projectPath)
    } catch (err) {
      notify('error', `Branch fehlgeschlagen: ${err}`)
    }
    setLoading(null)
  }

  const toggleFile = (path: string) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  return (
    <div className="mt-3">
      {/* Action Buttons */}
      <div className="flex gap-1.5 mb-2">
        <button
          onClick={() => setActiveForm(activeForm === 'commit' ? null : 'commit')}
          disabled={loading !== null}
          className="flex items-center gap-1 text-[9px] font-medium text-accent bg-accent/10 border border-accent/20 rounded px-2 py-1 hover:bg-accent/20 transition-colors disabled:opacity-30"
        >
          <GitCommitHorizontal className="w-3 h-3" />
          Commit
        </button>
        <button
          onClick={handlePush}
          disabled={loading !== null}
          className="flex items-center gap-1 text-[9px] font-medium text-accent bg-accent/10 border border-accent/20 rounded px-2 py-1 hover:bg-accent/20 transition-colors disabled:opacity-30"
        >
          {loading === 'push' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
          Push
        </button>
        <button
          onClick={handlePull}
          disabled={loading !== null}
          className="flex items-center gap-1 text-[9px] font-medium text-text-secondary bg-text-secondary/10 border border-text-secondary/20 rounded px-2 py-1 hover:bg-text-secondary/20 transition-colors disabled:opacity-30"
        >
          {loading === 'pull' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
          Pull
        </button>
        <button
          onClick={() => setActiveForm(activeForm === 'branch' ? null : 'branch')}
          disabled={loading !== null}
          className="flex items-center gap-1 text-[9px] font-medium text-warning bg-warning/10 border border-warning/20 rounded px-2 py-1 hover:bg-warning/20 transition-colors disabled:opacity-30"
        >
          <GitBranch className="w-3 h-3" />
          Branch
        </button>
      </div>

      {/* Commit Form */}
      <AnimatePresence>
        {activeForm === 'commit' && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="glass rounded-lg p-2.5 space-y-2">
              {gitStatus?.files && gitStatus.files.length > 0 && (
                <div className="max-h-24 overflow-y-auto space-y-0.5">
                  {gitStatus.files.map((f) => (
                    <label key={f.path} className="flex items-center gap-2 text-[9px] cursor-pointer hover:bg-bg-hover rounded px-1 py-0.5">
                      <input
                        type="checkbox"
                        checked={selectedFiles.has(f.path)}
                        onChange={() => toggleFile(f.path)}
                        className="w-3 h-3 accent-accent"
                      />
                      <span className="font-mono text-text-muted w-4">{f.status}</span>
                      <span className="font-mono text-text-secondary truncate">{f.path}</span>
                    </label>
                  ))}
                </div>
              )}
              <textarea
                value={commitMsg}
                onChange={(e) => setCommitMsg(e.target.value)}
                placeholder="Commit-Message..."
                rows={2}
                className="w-full bg-transparent text-[10px] text-text-primary font-mono placeholder:text-text-muted focus:outline-none resize-none"
              />
              <button
                onClick={handleCommit}
                disabled={!commitMsg.trim() || loading !== null}
                className="text-[9px] font-medium text-accent bg-accent/10 border border-accent/20 rounded px-3 py-1 hover:bg-accent/20 transition-colors disabled:opacity-30"
              >
                {loading === 'commit' ? 'Committing...' : 'Commit'}
              </button>
            </div>
          </motion.div>
        )}

        {activeForm === 'branch' && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="glass rounded-lg p-2.5 flex gap-2">
              <input
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
                placeholder="Branch-Name..."
                onKeyDown={(e) => { if (e.key === 'Enter') handleBranch() }}
                className="flex-1 bg-transparent text-[10px] text-text-primary font-mono placeholder:text-text-muted focus:outline-none"
              />
              <button
                onClick={handleBranch}
                disabled={!branchName.trim() || loading !== null}
                className="text-[9px] font-medium text-warning bg-warning/10 border border-warning/20 rounded px-3 py-1 hover:bg-warning/20 transition-colors disabled:opacity-30"
              >
                Erstellen
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
