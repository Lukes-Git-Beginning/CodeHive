import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Settings, Key, Bot, Palette, ClipboardCheck, Zap } from 'lucide-react'
import { getSetting, setSetting } from '../../services/persistence'
import { checkClaudeCli } from '../../services/orchestrator'
import { StatusDot } from '../ui/StatusDot'
import { MCPSettings } from './MCPSettings'

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className={`relative w-11 h-6 rounded-full transition-all duration-300 ${
        enabled
          ? 'bg-accent/25 border border-accent/40 shadow-[0_0_10px_rgba(0,255,136,0.2)]'
          : 'bg-white/5 border border-white/10'
      }`}
    >
      <motion.div
        className={`absolute top-0.5 w-5 h-5 rounded-full ${enabled ? 'bg-accent' : 'bg-white/30'}`}
        animate={{ x: enabled ? 20 : 2 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      />
    </button>
  )
}

export function SettingsPanel() {
  const [defaultModel, setDefaultModel] = useState('sonnet')
  const [planMode, setPlanMode] = useState(true)
  const [autoAccept, setAutoAccept] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [claudeStatus, setClaudeStatus] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    async function load() {
      const [model, plan, accept] = await Promise.all([
        getSetting('default_model'),
        getSetting('plan_mode'),
        getSetting('auto_accept'),
      ])
      if (model) setDefaultModel(model)
      if (plan !== null) setPlanMode(plan !== 'false')
      if (accept !== null) setAutoAccept(accept === 'true')
      setLoaded(true)

      checkClaudeCli().then(setClaudeStatus)
    }
    load()
  }, [])

  const save = (key: string, value: string) => setSetting(key, value)

  const testConnection = async () => {
    setTesting(true)
    const result = await checkClaudeCli()
    setClaudeStatus(result)
    setTesting(false)
  }

  if (!loaded) return null

  return (
    <div className="h-full overflow-y-auto p-6 max-w-2xl mx-auto">
      <h2 className="font-hud text-sm text-accent text-glow-green mb-6 flex items-center gap-2">
        <Settings className="w-4 h-4" />
        System Configuration
      </h2>

      {/* Orchestrator */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-elevated rounded-xl p-5 mb-4"
      >
        <h3 className="font-hud text-[11px] text-cyan text-glow-cyan mb-4 flex items-center gap-2">
          <ClipboardCheck className="w-3.5 h-3.5" />
          Orchestrator
        </h3>

        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-primary">Plan Mode</p>
              <p className="text-[11px] text-text-muted mt-0.5">Review execution plan before agents start working.</p>
            </div>
            <Toggle
              enabled={planMode}
              onChange={(v) => { setPlanMode(v); save('plan_mode', v.toString()) }}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-primary">Auto Accept</p>
              <p className="text-[11px] text-text-muted mt-0.5">Agents can modify files without permission prompts.</p>
              {autoAccept && (
                <p className="text-[11px] text-danger mt-1 flex items-center gap-1">
                  <Zap className="w-3 h-3" />
                  Agents have unrestricted file access!
                </p>
              )}
            </div>
            <Toggle
              enabled={autoAccept}
              onChange={(v) => { setAutoAccept(v); save('auto_accept', v.toString()) }}
            />
          </div>
        </div>
      </motion.section>

      {/* Agent Config */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="glass-elevated rounded-xl p-5 mb-4"
      >
        <h3 className="font-hud text-[11px] text-violet mb-4 flex items-center gap-2">
          <Bot className="w-3.5 h-3.5" />
          Agents
        </h3>

        <div className="space-y-4">
          <div>
            <label className="font-hud text-[10px] text-text-muted mb-1.5 block">Default Model</label>
            <select
              value={defaultModel}
              onChange={(e) => { setDefaultModel(e.target.value); save('default_model', e.target.value) }}
              className="w-full glass rounded-lg px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent/40 font-mono"
            >
              <option value="opus">Claude Opus 1M (Complex)</option>
              <option value="sonnet">Claude Sonnet (Fast)</option>
              <option value="haiku">Claude Haiku (Budget)</option>
            </select>
          </div>
        </div>
      </motion.section>

      {/* Claude CLI */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-elevated rounded-xl p-5 mb-4"
      >
        <h3 className="font-hud text-[11px] text-accent mb-4 flex items-center gap-2">
          <Key className="w-3.5 h-3.5" />
          Claude CLI
        </h3>

        <div className="flex items-center gap-3 mb-4">
          <StatusDot status={claudeStatus ? 'online' : 'error'} size={8} />
          <span className="text-sm text-text-primary font-mono">
            {claudeStatus ? claudeStatus.split('\n')[0].trim() : 'Not connected'}
          </span>
          <button
            onClick={testConnection}
            disabled={testing}
            className="ml-auto text-[11px] font-hud text-accent bg-accent/10 border border-accent/20
                       rounded-lg px-3 py-1 hover:bg-accent/20 transition-colors disabled:opacity-50"
          >
            {testing ? 'Testing...' : 'Test Connection'}
          </button>
        </div>
      </motion.section>

      {/* MCP Servers */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="glass-elevated rounded-xl p-5 mb-4"
      >
        <MCPSettings />
      </motion.section>

      {/* Theme */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass-elevated rounded-xl p-5"
      >
        <h3 className="font-hud text-[11px] text-warning mb-4 flex items-center gap-2">
          <Palette className="w-3.5 h-3.5" />
          Appearance
        </h3>
        <div className="flex gap-3">
          <div className="flex-1 glass-accent rounded-lg p-3 text-center">
            <div className="w-full h-8 bg-bg-deep rounded mb-2 border border-accent/20" />
            <span className="text-[11px] text-accent font-hud">Dark (Active)</span>
          </div>
          <div className="flex-1 glass rounded-lg p-3 text-center opacity-30 cursor-not-allowed">
            <div className="w-full h-8 bg-gray-200 rounded mb-2" />
            <span className="text-[11px] text-text-muted font-hud">Light (Soon)</span>
          </div>
        </div>
      </motion.section>
    </div>
  )
}
