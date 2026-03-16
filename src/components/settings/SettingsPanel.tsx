import { useState, useEffect } from 'react'
import { Settings, Key, Bot, Palette, ClipboardCheck } from 'lucide-react'
import { getSetting, setSetting } from '../../services/persistence'

function Toggle({
  enabled,
  onChange,
}: {
  enabled: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className={`relative w-10 h-5 rounded-full transition-colors ${
        enabled ? 'bg-accent' : 'bg-border'
      }`}
    >
      <div
        className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
          enabled ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}

export function SettingsPanel() {
  const [defaultModel, setDefaultModel] = useState('sonnet')
  const [planMode, setPlanMode] = useState(true)
  const [autoAccept, setAutoAccept] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    async function load() {
      const model = await getSetting('default_model')
      const plan = await getSetting('plan_mode')
      const accept = await getSetting('auto_accept')

      if (model) setDefaultModel(model)
      if (plan !== null) setPlanMode(plan !== 'false')
      if (accept !== null) setAutoAccept(accept === 'true')
      setLoaded(true)
    }
    load()
  }, [])

  const handleModelChange = (v: string) => {
    setDefaultModel(v)
    setSetting('default_model', v)
  }

  const handlePlanMode = (v: boolean) => {
    setPlanMode(v)
    setSetting('plan_mode', v.toString())
  }

  const handleAutoAccept = (v: boolean) => {
    setAutoAccept(v)
    setSetting('auto_accept', v.toString())
  }

  if (!loaded) return null

  return (
    <div className="h-full overflow-y-auto p-6 max-w-2xl mx-auto">
      <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
        <Settings className="w-5 h-5 text-accent" />
        Einstellungen
      </h2>

      {/* Orchestrator Mode */}
      <section className="bg-bg-card border border-border rounded-xl p-5 mb-4">
        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <ClipboardCheck className="w-4 h-4 text-accent" />
          Orchestrator
        </h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-primary">Plan Mode</p>
              <p className="text-xs text-text-muted">
                Zeigt den Plan vor der Ausführung und wartet auf deine Bestätigung.
              </p>
            </div>
            <Toggle enabled={planMode} onChange={handlePlanMode} />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-primary">Auto Accept</p>
              <p className="text-xs text-text-muted">
                Agenten dürfen Dateien ohne Nachfrage ändern.
              </p>
              {autoAccept && (
                <p className="text-xs text-warning mt-1">
                  Agenten können ohne Bestätigung Dateien ändern!
                </p>
              )}
            </div>
            <Toggle enabled={autoAccept} onChange={handleAutoAccept} />
          </div>
        </div>
      </section>

      {/* Agent Configuration */}
      <section className="bg-bg-card border border-border rounded-xl p-5 mb-4">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Bot className="w-4 h-4 text-accent" />
          Agent-Konfiguration
        </h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-text-muted mb-1 block">Standard-Modell</label>
            <select
              value={defaultModel}
              onChange={(e) => handleModelChange(e.target.value)}
              className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm
                         text-text-primary focus:outline-none focus:border-accent"
            >
              <option value="opus">Claude Opus 1M (Komplex)</option>
              <option value="sonnet">Claude Sonnet (Schnell)</option>
              <option value="haiku">Claude Haiku (Günstig)</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-text-muted mb-1 block">Max. parallele Agenten</label>
            <input
              type="number"
              defaultValue={5}
              min={1}
              max={10}
              className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm
                         text-text-primary focus:outline-none focus:border-accent"
            />
          </div>
        </div>
      </section>

      {/* Claude CLI */}
      <section className="bg-bg-card border border-border rounded-xl p-5 mb-4">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Key className="w-4 h-4 text-accent" />
          Claude CLI
        </h3>
        <div>
          <label className="text-xs text-text-muted mb-1 block">Claude Code Pfad</label>
          <input
            type="text"
            defaultValue="claude"
            className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm
                       text-text-primary focus:outline-none focus:border-accent"
          />
          <p className="text-xs text-text-muted mt-1">
            Pfad zur Claude Code CLI (Standard: "claude" im PATH)
          </p>
        </div>
      </section>

      {/* Theme */}
      <section className="bg-bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Palette className="w-4 h-4 text-accent" />
          Erscheinungsbild
        </h3>
        <div className="flex gap-3">
          <button className="flex-1 bg-bg-primary border-2 border-accent rounded-lg p-3 text-center">
            <div className="w-full h-8 bg-[#0f0f23] rounded mb-2" />
            <span className="text-xs text-accent">Dark (Aktiv)</span>
          </button>
          <button className="flex-1 bg-bg-primary border border-border rounded-lg p-3 text-center opacity-50 cursor-not-allowed">
            <div className="w-full h-8 bg-gray-200 rounded mb-2" />
            <span className="text-xs text-text-muted">Light (Bald)</span>
          </button>
        </div>
      </section>
    </div>
  )
}
