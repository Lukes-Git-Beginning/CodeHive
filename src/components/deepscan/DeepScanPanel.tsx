import { useState } from 'react'
import { ScanLine, Play, X, ChevronDown, ChevronRight, Loader2 } from 'lucide-react'
import { useDeepScanStore, type DeepScanPhase } from '../../stores/deepScanStore'
import { useProjectStore } from '../../stores/projectStore'
import { runDeepScan } from '../../services/deepScan'

const PHASES: Array<{ id: DeepScanPhase; label: string }> = [
  { id: 'inventory', label: 'Inventar erstellen' },
  { id: 'categorize', label: 'Dateien kategorisieren' },
  { id: 'graph', label: 'Knowledge Graph' },
  { id: 'quick_scan', label: 'Quick Scan' },
  { id: 'deep_analysis', label: 'KI-Analyse' },
  { id: 'storing', label: 'Ergebnisse speichern' },
]

function getPhaseIndex(phase: DeepScanPhase): number {
  const idx = PHASES.findIndex((p) => p.id === phase)
  return idx === -1 ? -1 : idx
}

export function DeepScanPanel() {
  const activeProject = useProjectStore((s) => s.getActiveProject())
  const { isScanning, progress } = useDeepScanStore()
  const lastResult = useDeepScanStore((s) => activeProject ? s.getLastResult(activeProject.id) : undefined)
  const cancelScan = useDeepScanStore((s) => s.cancelScan)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())

  if (!activeProject) {
    return (
      <div className="p-8 text-center text-text-muted font-medium text-sm">
        Kein Projekt ausgewählt
      </div>
    )
  }

  const handleStartScan = async () => {
    try {
      await runDeepScan(activeProject)
    } catch (err) {
      console.error('Deep Scan failed:', err)
    }
  }

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const currentPhaseIndex = progress ? getPhaseIndex(progress.phase) : -1

  return (
    <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ScanLine className="w-5 h-5 text-emerald-400" />
          <div>
            <h2 className="font-label text-base text-text-primary">Deep Scan</h2>
            <p className="text-[10px] text-text-muted font-mono">{activeProject.name} — {activeProject.path}</p>
          </div>
        </div>
        {!isScanning && (
          <button
            onClick={handleStartScan}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white hover:bg-accent/90 transition-all text-sm font-medium shadow-card"
          >
            <Play className="w-4 h-4" />
            Deep Scan starten
          </button>
        )}
        {isScanning && (
          <button
            onClick={cancelScan}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-danger/10 border border-danger/20 text-danger hover:bg-danger/20 transition-all text-sm font-medium"
          >
            <X className="w-4 h-4" />
            ABBRECHEN
          </button>
        )}
      </div>

      {/* Progress Stepper */}
      {isScanning && progress && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 text-accent animate-spin" />
            <span className="text-sm font-medium text-accent">{progress.phaseLabel}</span>
            <span className="text-[10px] text-text-muted font-mono">{progress.progress}%</span>
          </div>

          {/* Progress bar */}
          <div className="h-1 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-accent/80 to-accent transition-all duration-500 rounded-full"
              style={{ width: `${progress.progress}%` }}
            />
          </div>

          {/* Phase list */}
          <div className="space-y-1.5">
            {PHASES.map((phase, i) => {
              const isActive = phase.id === progress.phase
              const isDone = currentPhaseIndex > i
              return (
                <div
                  key={phase.id}
                  className={`flex items-center gap-3 px-3 py-1.5 rounded text-xs font-mono ${
                    isActive
                      ? 'bg-accent/10 text-accent'
                      : isDone
                        ? 'text-success'
                        : 'text-text-muted'
                  }`}
                >
                  <span className={`w-5 text-center ${isActive ? 'animate-pulse' : ''}`}>
                    {isDone ? '✓' : isActive ? '▸' : '○'}
                  </span>
                  <span>{phase.label}</span>
                  {isActive && progress.details && (
                    <span className="text-[10px] text-text-muted ml-auto">{progress.details}</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Error */}
      {progress?.phase === 'error' && (
        <div className="p-4 rounded bg-danger/10 border border-danger/20">
          <p className="text-danger text-sm font-mono">{progress.error || 'Unbekannter Fehler'}</p>
        </div>
      )}

      {/* Results */}
      {lastResult && !isScanning && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-4 gap-3">
            <StatCard label="Dateien" value={lastResult.fileStats.total} />
            <StatCard label="Graph Nodes" value={lastResult.graphStats.nodes} />
            <StatCard label="KB Einträge" value={lastResult.storedEntries} />
            <StatCard label="Dauer" value={`${(lastResult.duration / 1000).toFixed(0)}s`} />
          </div>

          {/* Tech Stack */}
          {lastResult.techStack.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {lastResult.techStack.map((t) => (
                <span key={t} className="px-2 py-0.5 rounded bg-accent/10 text-accent text-[10px] font-mono">
                  {t}
                </span>
              ))}
            </div>
          )}

          {/* Agent Analysis Sections */}
          {lastResult.agentAnalysis && (
            <AnalysisSections
              raw={lastResult.agentAnalysis}
              expandedSections={expandedSections}
              toggleSection={toggleSection}
            />
          )}

          {/* Quick Scan Findings */}
          {lastResult.quickScanResults.length > 0 && (
            <CollapsibleSection
              title="Quick Scan Findings"

              expanded={expandedSections.has('quickscan')}
              onToggle={() => toggleSection('quickscan')}
            >
              <div className="space-y-2">
                {lastResult.quickScanResults.map((r, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                      r.type === 'warning' ? 'bg-warning/15 text-warning' :
                      r.type === 'suggestion' ? 'bg-accent/15 text-accent' :
                      'bg-white/5 text-text-muted'
                    }`}>{r.type}</span>
                    <div>
                      <span className="text-text-primary">{r.title}</span>
                      <p className="text-text-muted text-[10px] mt-0.5">{r.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* Scan timestamp */}
          <p className="text-[9px] text-text-muted font-mono text-right">
            Gescannt: {new Date(lastResult.scannedAt).toLocaleString('de-DE')}
          </p>
        </div>
      )}

      {/* No results yet */}
      {!lastResult && !isScanning && progress?.phase !== 'error' && (
        <div className="text-center py-12 text-text-muted">
          <ScanLine className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="font-label text-sm">Noch kein Scan durchgeführt</p>
          <p className="text-xs mt-1">Starte einen Deep Scan um {activeProject.name} zu analysieren</p>
        </div>
      )}
    </div>
  )
}

// ── Sub-Components ──

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="p-3 rounded bg-white/[0.03] border border-white/5">
      <p className="text-lg font-mono text-text-primary">{value}</p>
      <p className="text-[10px] text-text-muted font-medium">{label}</p>
    </div>
  )
}

function CollapsibleSection({
  title, expanded, onToggle, children
}: {
  title: string
  expanded: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-bg-hover transition-colors"
      >
        {expanded ? <ChevronDown className="w-3.5 h-3.5 text-text-muted" /> : <ChevronRight className="w-3.5 h-3.5 text-text-muted" />}
        <span className="text-sm font-medium text-text-secondary">{title}</span>
      </button>
      {expanded && (
        <div className="px-4 pb-3 text-xs text-text-secondary leading-relaxed">
          {children}
        </div>
      )}
    </div>
  )
}

function AnalysisSections({
  raw, expandedSections, toggleSection
}: {
  raw: string
  expandedSections: Set<string>
  toggleSection: (key: string) => void
}) {
  // Try to parse JSON sections
  let parsed: Record<string, string> | null = null
  try {
    const trimmed = raw.trim()
    if (trimmed.startsWith('{')) {
      parsed = JSON.parse(trimmed)
    }
  } catch { /* not JSON */ }

  if (!parsed) {
    const codeBlockMatch = raw.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
    if (codeBlockMatch) {
      try { parsed = JSON.parse(codeBlockMatch[1]) } catch { /* invalid */ }
    }
  }

  if (!parsed) {
    const firstBrace = raw.indexOf('{')
    const lastBrace = raw.lastIndexOf('}')
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try { parsed = JSON.parse(raw.slice(firstBrace, lastBrace + 1)) } catch { /* invalid */ }
    }
  }

  const sectionLabels: Record<string, string> = {
    architecture: 'Architektur',
    entry_points: 'Entry Points',
    dependencies: 'Abhängigkeiten',
    code_quality: 'Code-Qualität',
    features: 'Features',
    improvements: 'Verbesserungen',
  }

  if (parsed) {
    return (
      <div className="space-y-2">
        {Object.entries(sectionLabels).map(([key, label]) => {
          const value = parsed[key]
          if (!value) return null
          return (
            <CollapsibleSection
              key={key}
              title={label}

              expanded={expandedSections.has(key)}
              onToggle={() => toggleSection(key)}
            >
              <p className="whitespace-pre-wrap">{value}</p>
            </CollapsibleSection>
          )
        })}
      </div>
    )
  }

  // Fallback: show raw output
  return (
    <CollapsibleSection
      title="KI-Analyse (Raw)"
      expanded={expandedSections.has('raw')}
      onToggle={() => toggleSection('raw')}
    >
      <pre className="whitespace-pre-wrap text-[10px] font-mono max-h-96 overflow-y-auto">
        {raw.slice(0, 5000)}
      </pre>
    </CollapsibleSection>
  )
}
