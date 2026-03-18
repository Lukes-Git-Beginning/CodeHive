import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Settings, Key, Bot, Palette, ClipboardCheck, Zap, HardDrive, Clock, Users, Plus, Trash2, Download, Upload, Database, Monitor } from 'lucide-react'
import { getSetting, setSetting, getMachineId, exportProjectBundle, importProjectBundle } from '../../services/persistence'
import { open } from '@tauri-apps/plugin-dialog'
import { checkClaudeCli } from '../../services/orchestrator'
import { checkOllamaStatus } from '../../services/localLlm'
import { useSchedulerStore } from '../../stores/schedulerStore'
import { useTeamStore } from '../../stores/teamStore'
import { useProjectStore } from '../../stores/projectStore'
import { useThemeStore } from '../../stores/themeStore'
import { INTERVAL_LABELS } from '../../services/scheduler'
import type { ScheduleInterval } from '../../types/scheduler'
import { StatusDot } from '../ui/StatusDot'
import { MCPSettings } from './MCPSettings'
import { useNotificationStore } from '../../stores/notificationStore'

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
  const [ollamaStatus, setOllamaStatus] = useState<{ running: boolean; models: string[] }>({ running: false, models: [] })
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
      checkOllamaStatus().then(setOllamaStatus)
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
    <div className="h-full overflow-y-auto p-8 max-w-2xl mx-auto space-y-0">
      <h2 className="font-hud text-sm text-accent holo-text mb-8 flex items-center gap-2">
        <Settings className="w-4 h-4" />
        System Configuration
      </h2>

      {/* Orchestrator */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-elevated rounded-xl p-6 mb-6"
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
        className="glass-elevated rounded-xl p-6 mb-6"
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
        className="glass-elevated rounded-xl p-6 mb-6"
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

      {/* Local LLM */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12 }}
        className="glass-elevated rounded-xl p-6 mb-6"
      >
        <h3 className="font-hud text-[11px] text-warning mb-4 flex items-center gap-2">
          <HardDrive className="w-3.5 h-3.5" />
          Local LLM (Ollama)
        </h3>
        <div className="flex items-center gap-3 mb-3">
          <StatusDot status={ollamaStatus.running ? 'online' : 'error'} size={8} />
          <span className="text-sm text-text-primary font-mono">
            {ollamaStatus.running
              ? `Ollama aktiv — ${ollamaStatus.models.length} Modelle`
              : 'Ollama nicht erreichbar'}
          </span>
          <button
            onClick={() => checkOllamaStatus().then(setOllamaStatus)}
            className="ml-auto text-[11px] font-hud text-warning bg-warning/10 border border-warning/20
                       rounded-lg px-3 py-1 hover:bg-warning/20 transition-colors"
          >
            Prüfen
          </button>
        </div>
        {ollamaStatus.running && ollamaStatus.models.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {ollamaStatus.models.slice(0, 6).map((m) => (
              <span key={m} className="text-[10px] font-mono bg-bg-surface px-2 py-0.5 rounded text-text-secondary">
                {m}
              </span>
            ))}
          </div>
        )}
        {!ollamaStatus.running && (
          <p className="text-[10px] text-text-muted">
            Installiere Ollama für Offline-Nutzung: ollama.com
          </p>
        )}
      </motion.section>

      {/* MCP Servers */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="glass-elevated rounded-xl p-6 mb-6"
      >
        <MCPSettings />
      </motion.section>

      {/* Scheduler */}
      <SchedulerSection />

      {/* Team */}
      <TeamSection />

      {/* Data & Sync */}
      <DataSyncSection />

      {/* Theme */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass-elevated rounded-xl p-6 mb-6"
      >
        <h3 className="font-hud text-[11px] text-warning mb-4 flex items-center gap-2">
          <Palette className="w-3.5 h-3.5" />
          Appearance
        </h3>
        <ThemeCards />
      </motion.section>
    </div>
  )
}

// ── Scheduler Section ──

const TEMPLATES: { name: string; prompt: string; interval: ScheduleInterval }[] = [
  { name: 'Tests ausführen', prompt: 'Führe alle Tests aus und berichte über Ergebnisse.', interval: 'daily' },
  { name: 'Security-Audit', prompt: 'Führe einen Security-Audit des Codes durch. Prüfe auf OWASP Top 10.', interval: 'weekly' },
  { name: 'Code-Qualität', prompt: 'Analysiere die Code-Qualität und schlage Verbesserungen vor.', interval: 'weekly' },
]

function SchedulerSection() {
  const project = useProjectStore((s) => s.getActiveProject())
  const tasks = useSchedulerStore((s) => s.tasks)
  const loadTasks = useSchedulerStore((s) => s.loadTasks)
  const addTask = useSchedulerStore((s) => s.addTask)
  const removeTask = useSchedulerStore((s) => s.removeTask)
  const toggleTask = useSchedulerStore((s) => s.toggleTask)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [prompt, setPrompt] = useState('')
  const [interval, setInterval] = useState<ScheduleInterval>('daily')

  useEffect(() => {
    if (project) loadTasks(project.id)
  }, [project?.id])

  const handleAdd = async () => {
    if (!project || !name.trim() || !prompt.trim()) return
    await addTask(project.id, name.trim(), prompt.trim(), interval)
    setName('')
    setPrompt('')
    setShowForm(false)
  }

  const handleTemplate = async (t: typeof TEMPLATES[number]) => {
    if (!project) return
    await addTask(project.id, t.name, t.prompt, t.interval)
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.17 }}
      className="glass-elevated rounded-xl p-6 mb-6"
    >
      <h3 className="font-hud text-[11px] text-cyan text-glow-cyan mb-4 flex items-center gap-2">
        <Clock className="w-3.5 h-3.5" />
        Zeitpläne
      </h3>

      {/* Existing tasks */}
      {tasks.length > 0 && (
        <div className="space-y-2 mb-4">
          {tasks.map((task) => (
            <div key={task.id} className="flex items-center gap-3 glass rounded-lg px-3 py-2">
              <Toggle enabled={task.enabled} onChange={() => toggleTask(task.id)} />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-text-primary truncate">{task.name}</p>
                <p className="text-[10px] text-text-muted font-mono">
                  {INTERVAL_LABELS[task.schedule_interval]}
                  {task.next_run && ` — Nächster Lauf: ${new Date(task.next_run).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`}
                </p>
              </div>
              <button
                onClick={() => removeTask(task.id)}
                className="p-1.5 rounded-md hover:bg-danger/20 text-text-muted hover:text-danger transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add form */}
      {showForm ? (
        <div className="glass rounded-lg p-3 space-y-3 mb-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name des Zeitplans"
            className="w-full glass rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent/40 font-mono placeholder:text-text-muted"
          />
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Prompt für Metis..."
            rows={2}
            className="w-full glass rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent/40 font-mono resize-none placeholder:text-text-muted"
          />
          <div className="flex gap-2">
            <select
              value={interval}
              onChange={(e) => setInterval(e.target.value as ScheduleInterval)}
              className="flex-1 glass rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none font-mono"
            >
              {Object.entries(INTERVAL_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
            <button onClick={handleAdd} className="text-[11px] font-hud text-accent bg-accent/10 border border-accent/20 rounded-lg px-4 py-2 hover:bg-accent/20 transition-colors">
              Erstellen
            </button>
            <button onClick={() => setShowForm(false)} className="text-[11px] font-hud text-text-muted hover:text-text-primary transition-colors px-2">
              Abbrechen
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 text-[11px] font-hud text-cyan bg-cyan/10 border border-cyan/20 rounded-lg px-3 py-2 hover:bg-cyan/20 transition-colors mb-3"
        >
          <Plus className="w-3.5 h-3.5" />
          Neuer Zeitplan
        </button>
      )}

      {/* Templates */}
      {project && (
        <div>
          <p className="text-[9px] font-hud text-text-muted mb-2">Vorlagen</p>
          <div className="flex flex-wrap gap-1.5">
            {TEMPLATES.map((t) => (
              <button
                key={t.name}
                onClick={() => handleTemplate(t)}
                className="text-[10px] font-mono bg-bg-surface px-2.5 py-1 rounded-md text-text-secondary hover:text-accent hover:bg-accent/10 transition-colors"
              >
                {t.name} ({INTERVAL_LABELS[t.interval].toLowerCase()})
              </button>
            ))}
          </div>
        </div>
      )}
    </motion.section>
  )
}

// ── Team Section ──

const ROLE_OPTIONS = ['developer', 'designer', 'devops', 'lead'] as const

function TeamSection() {
  const members = useTeamStore((s) => s.members)
  const loadMembers = useTeamStore((s) => s.loadMembers)
  const addMember = useTeamStore((s) => s.addMember)
  const removeMember = useTeamStore((s) => s.removeMember)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [role, setRole] = useState('developer')
  const [email, setEmail] = useState('')

  useEffect(() => {
    loadMembers()
  }, [])

  const handleAdd = async () => {
    if (!name.trim()) return
    await addMember(name.trim(), role, email.trim() || undefined)
    setName('')
    setEmail('')
    setShowForm(false)
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.19 }}
      className="glass-elevated rounded-xl p-6 mb-6"
    >
      <h3 className="font-hud text-[11px] text-violet mb-4 flex items-center gap-2">
        <Users className="w-3.5 h-3.5" />
        Team
      </h3>

      {/* Members list */}
      {members.length > 0 && (
        <div className="space-y-2 mb-4">
          {members.map((member) => (
            <div key={member.id} className="flex items-center gap-3 glass rounded-lg px-3 py-2">
              <div
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: member.avatar_color }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-text-primary">{member.name}</p>
                <p className="text-[10px] text-text-muted font-mono">
                  {member.role}
                  {member.email && ` · ${member.email}`}
                </p>
              </div>
              <button
                onClick={() => removeMember(member.id)}
                className="p-1.5 rounded-md hover:bg-danger/20 text-text-muted hover:text-danger transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add form */}
      {showForm ? (
        <div className="glass rounded-lg p-3 space-y-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            className="w-full glass rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent/40 font-mono placeholder:text-text-muted"
          />
          <div className="flex gap-2">
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="flex-1 glass rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none font-mono"
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="E-Mail (optional)"
              className="flex-1 glass rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent/40 font-mono placeholder:text-text-muted"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} className="text-[11px] font-hud text-violet bg-violet/10 border border-violet/20 rounded-lg px-4 py-2 hover:bg-violet/20 transition-colors">
              Hinzufügen
            </button>
            <button onClick={() => setShowForm(false)} className="text-[11px] font-hud text-text-muted hover:text-text-primary transition-colors px-2">
              Abbrechen
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 text-[11px] font-hud text-violet bg-violet/10 border border-violet/20 rounded-lg px-3 py-2 hover:bg-violet/20 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Mitglied hinzufügen
        </button>
      )}
    </motion.section>
  )
}

// ── Data & Sync Section ──

function DataSyncSection() {
  const [machineId, setMachineId] = useState<string>('')
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const projects = useProjectStore((s) => s.projects)
  const notify = useNotificationStore.getState().addNotification

  useEffect(() => {
    getMachineId().then(setMachineId).catch(() => {})
  }, [])

  const handleExportAll = async () => {
    setExporting(true)
    try {
      const paths: string[] = []
      for (const p of projects) {
        const path = await exportProjectBundle(p.id)
        paths.push(path)
      }
      notify('success', `${paths.length} Projekte exportiert`)
    } catch (err) {
      notify('error', `Export fehlgeschlagen: ${err}`)
    } finally {
      setExporting(false)
    }
  }

  const handleImport = async () => {
    setImporting(true)
    try {
      const file = await open({
        filters: [{ name: 'CodeHive Bundle', extensions: ['json'] }],
        multiple: false,
      })
      if (file) {
        await importProjectBundle(file)
        await useProjectStore.getState().initialize()
        notify('success', 'Daten importiert!')
      }
    } catch (err) {
      notify('error', `Import fehlgeschlagen: ${err}`)
    } finally {
      setImporting(false)
    }
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.22 }}
      className="glass-elevated rounded-xl p-6 mb-6"
    >
      <h3 className="font-hud text-[11px] text-cyan text-glow-cyan mb-4 flex items-center gap-2">
        <Database className="w-3.5 h-3.5" />
        Daten & Sync
      </h3>

      {/* Machine ID */}
      <div className="flex items-center gap-3 glass rounded-lg px-3 py-2 mb-4">
        <Monitor className="w-3.5 h-3.5 text-text-muted" />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-hud text-text-muted">Machine ID</p>
          <p className="text-xs font-mono text-text-secondary truncate">{machineId || '...'}</p>
        </div>
      </div>

      {/* Export/Import */}
      <div className="flex gap-3">
        <button
          onClick={handleExportAll}
          disabled={exporting || projects.length === 0}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg
                     bg-accent/10 border border-accent/20 text-accent text-[11px] font-hud
                     hover:bg-accent/20 transition-colors disabled:opacity-30"
        >
          <Download className="w-3.5 h-3.5" />
          {exporting ? 'Exportiere...' : 'Alle exportieren'}
        </button>
        <button
          onClick={handleImport}
          disabled={importing}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg
                     bg-cyan/10 border border-cyan/20 text-cyan text-[11px] font-hud
                     hover:bg-cyan/20 transition-colors disabled:opacity-30"
        >
          <Upload className="w-3.5 h-3.5" />
          {importing ? 'Importiere...' : 'Daten importieren'}
        </button>
      </div>

      <p className="text-[9px] text-text-muted mt-3">
        Exportiere Projekte als .json Bundles um sie auf anderen PCs zu importieren.
      </p>
    </motion.section>
  )
}

// ── Theme Cards ──

function ThemeCards() {
  const theme = useThemeStore((s) => s.theme)
  const setTheme = useThemeStore((s) => s.setTheme)

  return (
    <div className="flex gap-3">
      <button
        onClick={() => setTheme('dark')}
        className={`flex-1 rounded-lg p-3 text-center transition-all ${theme === 'dark' ? 'glass-accent' : 'glass'}`}
      >
        <div className="w-full h-8 rounded mb-2" style={{ backgroundColor: '#0a0e27', border: '1px solid rgba(0,255,136,0.2)' }} />
        <span className={`text-[11px] font-hud ${theme === 'dark' ? 'text-accent' : 'text-text-muted'}`}>
          Dark{theme === 'dark' ? ' (Aktiv)' : ''}
        </span>
      </button>
      <button
        onClick={() => setTheme('light')}
        className={`flex-1 rounded-lg p-3 text-center transition-all ${theme === 'light' ? 'glass-accent' : 'glass'}`}
      >
        <div className="w-full h-8 rounded mb-2" style={{ backgroundColor: '#f0f2f5', border: '1px solid rgba(0,0,0,0.1)' }} />
        <span className={`text-[11px] font-hud ${theme === 'light' ? 'text-accent' : 'text-text-muted'}`}>
          Light{theme === 'light' ? ' (Aktiv)' : ''}
        </span>
      </button>
    </div>
  )
}
