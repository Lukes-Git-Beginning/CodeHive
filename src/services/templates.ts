import type { AgentTemplate } from '../types/template'
import type { Project } from '../types/project'
import { orchestrate } from './orchestrator'
import { useChatStore } from '../stores/chatStore'
import { useNotificationStore } from '../stores/notificationStore'

export const BUILTIN_TEMPLATES: AgentTemplate[] = [
  {
    id: 'full-review',
    name: 'Full Code Review',
    description: 'Umfassende Analyse: Code-Qualität, Security, Performance',
    icon: 'Search',
    category: 'review',
    steps: [
      { prompt: 'Analysiere die Code-Qualität des Projekts. Prüfe auf Anti-Patterns, Code-Smells und Verbesserungspotenzial.', role: 'architect' },
      { prompt: 'Führe einen Security-Audit durch. Prüfe auf OWASP Top 10, Input-Validierung und Auth-Schwachstellen.', role: 'security' },
      { prompt: 'Analysiere die Performance. Finde Bottlenecks, unnötige Re-Renders und optimiere kritische Pfade.', role: 'backend' },
    ],
  },
  {
    id: 'test-suite',
    name: 'Test Suite Generator',
    description: 'Analysiert Coverage und generiert fehlende Tests',
    icon: 'TestTube',
    category: 'generation',
    steps: [
      { prompt: 'Analysiere die aktuelle Test-Coverage. Welche Dateien und Funktionen sind nicht getestet?', role: 'testing' },
      { prompt: 'Generiere Unit-Tests für die ungetesteten Bereiche. Nutze das bestehende Test-Framework.', role: 'testing' },
    ],
  },
  {
    id: 'security-audit',
    name: 'Security Audit',
    description: 'OWASP-Check + Dependency-Analyse',
    icon: 'Shield',
    category: 'analysis',
    steps: [
      { prompt: 'Führe einen OWASP Top 10 Scan durch. Prüfe auf XSS, Injection, Auth-Probleme.', role: 'security' },
      { prompt: 'Prüfe alle Dependencies auf bekannte Vulnerabilities und veraltete Pakete.', role: 'security' },
    ],
  },
  {
    id: 'performance',
    name: 'Performance Optimization',
    description: 'Profiling + Optimierungsvorschläge',
    icon: 'Zap',
    category: 'analysis',
    steps: [
      { prompt: 'Analysiere die Performance des Projekts. Finde langsame Pfade, große Bundles und Memory Leaks.', role: 'backend' },
      { prompt: 'Implementiere die Top-3 Performance-Optimierungen aus der Analyse.', role: 'architect' },
    ],
  },
  {
    id: 'docs',
    name: 'Dokumentation',
    description: 'API-Docs + README generieren',
    icon: 'FileText',
    category: 'generation',
    steps: [
      { prompt: 'Analysiere alle öffentlichen APIs, Interfaces und Exports des Projekts.', role: 'architect' },
      { prompt: 'Erstelle eine vollständige API-Dokumentation mit Beispielen für jedes Interface.', role: 'architect' },
    ],
  },
  {
    id: 'bug-hunt',
    name: 'Bug Hunt',
    description: 'Statische Analyse + Fix-Vorschläge',
    icon: 'Bug',
    category: 'analysis',
    steps: [
      { prompt: 'Führe eine statische Analyse durch. Finde potenzielle Bugs, Race Conditions und Edge Cases.', role: 'backend' },
      { prompt: 'Schlage Fixes für die gefundenen Probleme vor. Zeige Code-Diffs.', role: 'backend' },
    ],
  },
  {
    id: 'refactor',
    name: 'Refactoring Plan',
    description: 'Code-Smells identifizieren + Refactoring planen',
    icon: 'RefreshCw',
    category: 'review',
    steps: [
      { prompt: 'Identifiziere Code-Smells: Duplikation, lange Funktionen, komplexe Bedingungen, God Objects.', role: 'architect' },
      { prompt: 'Erstelle einen priorisierten Refactoring-Plan mit geschätztem Aufwand pro Punkt.', role: 'architect' },
    ],
  },
  {
    id: 'deploy-check',
    name: 'Deploy Checklist',
    description: 'Lint + Tests + Build vor dem Deploy',
    icon: 'Rocket',
    category: 'deployment',
    steps: [
      { prompt: 'Führe Linting und Type-Checks durch. Fixe alle Fehler.', role: 'devops' },
      { prompt: 'Führe alle Tests aus und stelle sicher, dass alles grün ist.', role: 'testing' },
      { prompt: 'Erstelle einen Production-Build und prüfe auf Warnungen oder Fehler.', role: 'devops' },
    ],
  },
]

export function getTemplatesByCategory(category: string): AgentTemplate[] {
  return BUILTIN_TEMPLATES.filter((t) => t.category === category)
}

export function getTemplateById(id: string): AgentTemplate | undefined {
  return BUILTIN_TEMPLATES.find((t) => t.id === id)
}

export async function executeTemplate(template: AgentTemplate, project: Project): Promise<void> {
  const notify = useNotificationStore.getState().addNotification
  const chat = useChatStore.getState()

  notify('info', `Template "${template.name}" gestartet (${template.steps.length} Schritte)`)

  chat.addMessage({
    id: crypto.randomUUID(),
    role: 'user',
    content: `[Template: ${template.name}] ${template.description}`,
    timestamp: new Date().toISOString(),
  })

  for (let i = 0; i < template.steps.length; i++) {
    const step = template.steps[i]
    const stepPrompt = `[Schritt ${i + 1}/${template.steps.length}] ${step.prompt}`

    try {
      await orchestrate(stepPrompt, project)
    } catch (err) {
      notify('error', `Template Schritt ${i + 1} fehlgeschlagen: ${err}`)
      return
    }
  }

  notify('success', `Template "${template.name}" abgeschlossen`)
}
