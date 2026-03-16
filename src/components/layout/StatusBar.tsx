import { useEffect, useState } from 'react'
import { CheckCircle, AlertTriangle, Terminal } from 'lucide-react'
import { checkClaudeCli } from '../../services/orchestrator'

export function StatusBar() {
  const [claudeVersion, setClaudeVersion] = useState<string | null>(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    checkClaudeCli().then((v) => {
      setClaudeVersion(v)
      setChecking(false)
    })
  }, [])

  if (checking) return null

  return (
    <div className="h-6 bg-bg-secondary border-t border-border flex items-center px-3 text-[10px] text-text-muted gap-4 shrink-0">
      {claudeVersion ? (
        <span className="flex items-center gap-1">
          <CheckCircle className="w-3 h-3 text-success" />
          Claude CLI: {claudeVersion.split('\n')[0]}
        </span>
      ) : (
        <span className="flex items-center gap-1 text-error">
          <AlertTriangle className="w-3 h-3" />
          Claude CLI nicht gefunden — installiere claude code
        </span>
      )}
      <span className="flex items-center gap-1">
        <Terminal className="w-3 h-3" />
        CodeHive v0.1.0
      </span>
    </div>
  )
}
