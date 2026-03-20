import { useState } from 'react'
import { Layers, Search, TestTube, Shield, Zap, FileText, Bug, RefreshCw, Rocket, Loader2 } from 'lucide-react'
import { BUILTIN_TEMPLATES, executeTemplate } from '../../services/templates'
import { useProjectStore } from '../../stores/projectStore'
import { useNotificationStore } from '../../stores/notificationStore'
import type { AgentTemplate, TemplateCategory } from '../../types/template'

const ICON_MAP: Record<string, typeof Search> = {
  Search, TestTube, Shield, Zap, FileText, Bug, RefreshCw, Rocket,
}

const CATEGORY_LABELS: Record<TemplateCategory, string> = {
  analysis: 'Analyse',
  generation: 'Generierung',
  review: 'Review',
  deployment: 'Deployment',
  custom: 'Benutzerdefiniert',
}

const CATEGORY_COLORS: Record<TemplateCategory, string> = {
  analysis: 'text-accent',
  generation: 'text-accent',
  review: 'text-text-secondary',
  deployment: 'text-warning',
  custom: 'text-text-secondary',
}

export function TemplateSelector() {
  const project = useProjectStore((s) => s.getActiveProject())
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const handleSelect = async (template: AgentTemplate) => {
    if (!project || loadingId) return
    setLoadingId(template.id)
    try {
      await executeTemplate(template, project)
    } catch (err) {
      useNotificationStore.getState().addNotification('error', `Template fehlgeschlagen: ${err}`)
    } finally {
      setLoadingId(null)
    }
  }

  // Group by category
  const categories = [...new Set(BUILTIN_TEMPLATES.map((t) => t.category))]

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="flex items-center gap-3 mb-6">
        <Layers className="w-5 h-5 text-accent" />
        <h2 className="font-semibold text-sm text-accent">Agent Templates</h2>
      </div>

      {!project ? (
        <p className="text-sm text-text-muted font-mono text-center mt-12">Projekt auswählen.</p>
      ) : (
        <div className="space-y-6">
          {categories.map((cat) => {
            const templates = BUILTIN_TEMPLATES.filter((t) => t.category === cat)
            return (
              <section key={cat}>
                <h3 className={`font-medium text-[10px] mb-3 ${CATEGORY_COLORS[cat]}`}>
                  {CATEGORY_LABELS[cat]}
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {templates.map((template) => {
                    const Icon = ICON_MAP[template.icon] || Layers
                    return (
                      <button
                        key={template.id}
                        onClick={() => handleSelect(template)}
                        disabled={loadingId === template.id}
                        className="glass hover-lift rounded-xl p-4 text-left group transition-all disabled:opacity-50"
                      >
                        <div className="flex items-center gap-2.5 mb-2">
                          {loadingId === template.id ? (
                            <Loader2 className="w-4 h-4 text-accent animate-spin" />
                          ) : (
                            <Icon className={`w-4 h-4 ${CATEGORY_COLORS[template.category]}`} />
                          )}
                          <span className="text-sm text-text-primary font-medium">{template.name}</span>
                        </div>
                        <p className="text-[10px] text-text-muted mb-2">{template.description}</p>
                        <span className="text-[9px] font-mono text-text-muted bg-bg-surface px-2 py-0.5 rounded">
                          {template.steps.length} {template.steps.length === 1 ? 'Schritt' : 'Schritte'}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
