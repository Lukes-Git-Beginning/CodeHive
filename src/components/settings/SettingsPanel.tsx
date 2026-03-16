import { useState } from 'react'
import { Settings, Key, Bot, Palette } from 'lucide-react'

export function SettingsPanel() {
  const [apiKey, setApiKey] = useState('')
  const [defaultModel, setDefaultModel] = useState('sonnet')

  return (
    <div className="h-full overflow-y-auto p-6 max-w-2xl mx-auto">
      <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
        <Settings className="w-5 h-5 text-accent" />
        Einstellungen
      </h2>

      {/* API Configuration */}
      <section className="bg-bg-card border border-border rounded-xl p-5 mb-4">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Key className="w-4 h-4 text-accent" />
          Claude Agent SDK
        </h3>
        <div className="space-y-3">
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
              onChange={(e) => setDefaultModel(e.target.value)}
              className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm
                         text-text-primary focus:outline-none focus:border-accent"
            >
              <option value="opus">Claude Opus (Komplex)</option>
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
