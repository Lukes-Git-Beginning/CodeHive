import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import { Sparkles, Upload, Terminal, FolderPlus, ChevronRight, Check, Loader2 } from 'lucide-react'
import { importProjectBundle } from '../../services/persistence'
import { useProjectStore } from '../../stores/projectStore'
import { useNotificationStore } from '../../stores/notificationStore'

interface FirstRunWizardProps {
  onComplete: () => void
}

export function FirstRunWizard({ onComplete }: FirstRunWizardProps) {
  const [step, setStep] = useState(0)
  const [claudeOk, setClaudeOk] = useState<boolean | null>(null)
  const [checking, setChecking] = useState(false)
  const [importing, setImporting] = useState(false)
  const notify = useNotificationStore((s) => s.addNotification)

  const checkClaude = async () => {
    setChecking(true)
    try {
      const version: string = await invoke('check_claude_cli')
      setClaudeOk(version.length > 0)
    } catch {
      setClaudeOk(false)
    } finally {
      setChecking(false)
    }
  }

  const handleImport = async () => {
    try {
      setImporting(true)
      const file = await open({
        filters: [{ name: 'CodeHive Bundle', extensions: ['json'] }],
        multiple: false,
      })
      if (file) {
        await importProjectBundle(file)
        await useProjectStore.getState().initialize()
        notify('success', 'Projekt erfolgreich importiert!')
        onComplete()
      }
    } catch (err) {
      notify('error', `Import fehlgeschlagen: ${err}`)
    } finally {
      setImporting(false)
    }
  }

  const steps = [
    // Step 0: Welcome
    <div key="welcome" className="flex flex-col items-center gap-6 text-center">
      <motion.div
        animate={{ scale: [1, 1.1, 1], opacity: [0.8, 1, 0.8] }}
        transition={{ duration: 3, repeat: Infinity }}
        className="w-20 h-20 rounded-full flex items-center justify-center"
        style={{
          background: 'radial-gradient(circle, rgba(0,212,255,0.3), rgba(0,212,255,0.05))',
          boxShadow: '0 0 40px rgba(0,212,255,0.2)',
        }}
      >
        <Sparkles className="w-10 h-10 text-accent" />
      </motion.div>
      <div>
        <h1 className="font-semibold text-lg text-accent mb-2">Welcome to METIS</h1>
        <p className="text-text-secondary text-sm max-w-md">
          Dein persönlicher AI-Orchestrator. Metis plant, delegiert und verifiziert deine Aufgaben mit mehreren spezialisierten Agenten.
        </p>
      </div>
    </div>,

    // Step 1: Import existing data
    <div key="import" className="flex flex-col items-center gap-6 text-center">
      <Upload className="w-12 h-12 text-accent" />
      <div>
        <h2 className="font-semibold text-sm text-accent mb-2">Bestehende Daten?</h2>
        <p className="text-text-secondary text-xs max-w-md mb-4">
          Wenn du Metis bereits auf einem anderen PC nutzt, kannst du deine Projekte und Einstellungen importieren.
        </p>
      </div>
      <div className="flex gap-3">
        <button
          onClick={handleImport}
          disabled={importing}
          className="px-4 py-2 hud-panel text-accent text-xs font-medium hover:shadow-[0_0_15px_rgba(0,212,255,0.2)] transition-all disabled:opacity-50"
        >
          {importing ? 'Importiere...' : '.codehive Datei importieren'}
        </button>
        <button
          onClick={() => setStep(2)}
          className="px-4 py-2 glass text-text-muted text-xs font-medium hover:text-text-primary transition-all"
        >
          Überspringen
        </button>
      </div>
    </div>,

    // Step 2: Claude CLI Check
    <div key="claude" className="flex flex-col items-center gap-6 text-center">
      <Terminal className="w-12 h-12 text-text-secondary" />
      <div>
        <h2 className="font-semibold text-sm text-accent mb-2">Claude CLI</h2>
        <p className="text-text-secondary text-xs max-w-md mb-4">
          Metis benötigt die Claude CLI um Agenten zu starten. Prüfe ob sie installiert ist.
        </p>
      </div>
      {claudeOk === null ? (
        <button
          onClick={checkClaude}
          disabled={checking}
          className="px-4 py-2 hud-panel text-accent text-xs font-medium hover:shadow-[0_0_15px_rgba(0,212,255,0.2)] transition-all disabled:opacity-50 flex items-center gap-2"
        >
          {checking && <Loader2 className="w-3 h-3 animate-spin" />}
          {checking ? 'Prüfe...' : 'Prüfen'}
        </button>
      ) : claudeOk ? (
        <div className="flex items-center gap-2 text-success text-xs font-medium">
          <Check className="w-4 h-4" />
          Claude CLI gefunden
        </div>
      ) : (
        <div className="text-center">
          <p className="text-warning text-xs mb-2">Claude CLI nicht gefunden</p>
          <p className="text-text-muted text-[10px]">Installiere sie mit: npm install -g @anthropic-ai/claude-code</p>
        </div>
      )}
    </div>,

    // Step 3: Done
    <div key="done" className="flex flex-col items-center gap-6 text-center">
      <FolderPlus className="w-12 h-12 text-accent" />
      <div>
        <h2 className="font-semibold text-sm text-accent mb-2">Bereit!</h2>
        <p className="text-text-secondary text-xs max-w-md">
          Füge dein erstes Projekt hinzu und lass Metis für dich arbeiten.
        </p>
      </div>
    </div>,
  ]

  return (
    <div className="flex items-center justify-center h-full">
      <div className="w-full max-w-lg">
        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-all ${
                i === step ? 'bg-accent w-6' : i < step ? 'bg-accent/40' : 'bg-bg-elevated'
              }`}
            />
          ))}
        </div>

        {/* Step content */}
        <div className="hud-panel hud-brackets p-8 min-h-[300px] flex items-center justify-center relative overflow-hidden"
          style={{
            background: `
              radial-gradient(1px 1px at 20% 30%, rgba(255,255,255,0.4), transparent),
              radial-gradient(1px 1px at 60% 70%, rgba(255,255,255,0.3), transparent),
              radial-gradient(1px 1px at 80% 20%, rgba(255,255,255,0.5), transparent),
              radial-gradient(1px 1px at 10% 80%, rgba(255,255,255,0.3), transparent),
              radial-gradient(1px 1px at 40% 50%, rgba(255,255,255,0.4), transparent),
              radial-gradient(1px 1px at 90% 60%, rgba(255,255,255,0.2), transparent),
              radial-gradient(1px 1px at 30% 10%, rgba(255,255,255,0.3), transparent),
              radial-gradient(1px 1px at 70% 90%, rgba(255,255,255,0.4), transparent),
              radial-gradient(1px 1px at 50% 40%, rgba(0,212,255,0.3), transparent),
              radial-gradient(1px 1px at 15% 55%, rgba(0,212,255,0.2), transparent),
              linear-gradient(135deg, rgba(0, 212, 255, 0.04), rgba(26, 143, 255, 0.02))
            `,
          }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20, filter: 'blur(4px)' }}
              animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, x: -20, filter: 'blur(4px)' }}
              transition={{ duration: 0.3 }}
              className="w-full"
            >
              {steps[step]}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <div className="flex justify-between mt-6">
          <button
            onClick={() => setStep(Math.max(0, step - 1))}
            className={`px-4 py-2 text-xs font-medium text-text-muted hover:text-text-primary transition-colors ${step === 0 ? 'invisible' : ''}`}
          >
            Zurück
          </button>
          <button
            onClick={() => {
              if (step < steps.length - 1) {
                setStep(step + 1)
              } else {
                invoke('set_setting', { key: 'onboarding_completed', value: 'true' }).catch(() => {})
                onComplete()
              }
            }}
            className="flex items-center gap-1.5 px-4 py-2 hud-panel text-accent text-xs font-medium hover:shadow-[0_0_15px_rgba(0,212,255,0.2)] transition-all"
          >
            {step < steps.length - 1 ? 'Weiter' : 'Los geht\'s'}
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
