import { useAgentStore } from '../../stores/agentStore'
import { CheckCircle, XCircle, Clock, Cpu } from 'lucide-react'

export function LogsPanel() {
  const runHistory = useAgentStore((s) => s.runHistory)

  return (
    <div className="p-4">
      <h3 className="font-label text-sm text-text-primary mb-3">Run History ({runHistory.length})</h3>

      {runHistory.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-text-muted">
          <Clock className="w-8 h-8 mb-3 opacity-30" />
          <p className="text-xs">Noch keine Runs. Starte eine Aufgabe um Logs zu sehen.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {runHistory.map((run) => {
            const isSuccess = run.status === 'completed'
            const StatusIcon = isSuccess ? CheckCircle : XCircle
            const duration = run.finishedAt && run.startedAt
              ? Math.round((new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()) / 1000)
              : null

            return (
              <div key={run.id} className="glass rounded-lg p-3 flex items-center gap-3">
                <StatusIcon className={`w-4 h-4 shrink-0 ${isSuccess ? 'text-success' : 'text-danger'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-text-primary truncate">{run.prompt}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="flex items-center gap-1 text-[9px] text-text-muted font-mono">
                      <Cpu className="w-3 h-3" />
                      {run.agents.length} agents
                    </span>
                    {duration !== null && (
                      <span className="text-[9px] text-text-muted font-mono">
                        {duration}s
                      </span>
                    )}
                    <span className="text-[9px] text-text-muted font-mono">
                      {new Date(run.startedAt).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${isSuccess ? 'bg-success-dim text-success' : 'bg-danger-dim text-danger'}`}>
                  {isSuccess ? 'Erfolg' : 'Fehler'}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
