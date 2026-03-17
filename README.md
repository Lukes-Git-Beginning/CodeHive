# METIS — Self-Learning AI Desktop Assistant

> Griechische Göttin der klugen Planung. Ein selbstlernender AI-Assistent als Tauri 2.x Desktop-App.

## Tech Stack

- **Frontend:** React 19 + TypeScript 5.9 + Tailwind CSS 4
- **Backend:** Tauri 2.x (Rust) + SQLite (mit Migrations-System v5)
- **State:** Zustand 5
- **AI:** Claude Agent SDK (spawnt `claude` CLI als Child-Prozesse)
- **Animationen:** Framer Motion 12
- **Icons:** Lucide React
- **Tests:** Vitest (24 Tests), GitHub Actions CI/CD

## Features

### Jarvis-Style UI
- Animierter Orb mit phasenabhängigen Farben + 3 Ringen
- Omnibox mit Pipeline/Direct Toggle + Screenshot-Button
- Floating ThoughtNodes im Orbit um den Orb
- MindPalace (Slide-in Panel) mit Agent-Output, Git-Status, Run-History
- Command Palette (Ctrl+P) mit 14+ Commands
- Dark/Light Theme mit CSS-Variable-Swap

### Multi-Agent Orchestrator
- 3-Phasen Pipeline: Plan → Execute → Verify
- Direct Mode für einfache Aufgaben
- 8 spezialisierte Agent-Rollen (Frontend, Backend, Testing, Security, DevOps, UIX, Architect, Orchestrator)
- Modell-Routing nach Komplexität (Haiku/Sonnet/Opus)
- Wave-basierte parallele Ausführung mit Dependency-Graph
- Plan-Approval UI mit Accept/Reject

### Git Intelligence
- Branch-Anzeige + uncommitted Count im ProjectBar
- Datei-Liste + Commit-History im MindPalace
- Git Actions: Commit, Push, Pull, Branch erstellen
- ProactiveSuggestions: "N ungespeicherte Änderungen — committen?"

### Dashboard + Metriken
- Health Score (gewichteter Composite aus Erfolgsrate, Aktualität, Volumen, Git-Sauberkeit)
- Erfolgsrate, Avg. Dauer, Token-Schätzung
- CSS-only Charts: MiniDonut, MiniBar, Sparkline (SVG)
- 14-Tage Aktivitäts-Übersicht
- FileExplorer + ActivityTimeline

### Agent Templates
- 8 vordefinierte Workflows (Full Code Review, Test Suite, Security Audit, Performance, Docs, Bug Hunt, Refactoring, Deploy Checklist)
- Multi-Step Ausführung via Orchestrator
- Auswahl über Ctrl+T oder Command Palette

### Zeitbasierte Automatisierung
- Scheduler mit 5 Intervallen (15min, 1h, 6h, täglich, wöchentlich)
- Vorlagen für häufige Tasks
- Settings UI zum Erstellen/Verwalten

### Team-Vorbereitung
- Mitglieder-Management mit Rollen + Avatar-Farben
- Task-Zuweisung in der Roadmap
- Vorbereitet für kollaboratives Arbeiten

### Weitere Features
- FTS5 Knowledge Base + CLAUDE.md Integration
- MCP Server Integration (Filesystem, Git, Memory, Fetch)
- System Tray (Metis bleibt im Hintergrund)
- Screenshot Vision (Capture → Claude Analysis)
- Persistent Chat Memory (SQLite)
- Local LLM (Ollama) Integration
- Clipboard Monitor + AutoScan bei Projekt-Wechsel
- User Profile Self-Learning (Task-Frequenz, Patterns, Erfolgsrate)
- Notification Center mit History + Filter
- Keyboard-first UX mit Vim-Navigation (j/k) + Shortcut-Overlay (?)

## Keyboard Shortcuts

| Shortcut | Aktion |
|---|---|
| `Ctrl+P` | Command Palette |
| `Ctrl+R` | Roadmap |
| `Ctrl+K` | Knowledge Base |
| `Ctrl+D` | Dashboard |
| `Ctrl+M` | Mind Palace |
| `Ctrl+N` | Notification Center |
| `Ctrl+T` | Agent Templates |
| `Ctrl+,` | Einstellungen |
| `Ctrl+Shift+S` | Screenshot analysieren |
| `Ctrl+Shift+T` | Theme wechseln |
| `?` | Shortcut-Übersicht |
| `j/k` | Vim-Navigation in Listen |
| `Esc` | Panel schließen |

## Entwicklung

```bash
# Frontend only
npm run dev

# Full Tauri Dev (Frontend + Rust Backend)
npx tauri dev

# Production Build
npx tauri build

# Tests
npx vitest run
```

## Architektur

```
src/
  components/
    jarvis/          # Jarvis-Style UI (Orb, Omnibox, MindPalace, etc.)
    dashboard/       # MetricsDashboard + Charts
    roadmap/         # Kanban-Board
    settings/        # SettingsPanel (Scheduler, Team, Theme)
    ui/              # Shared UI (Toast, NotificationCenter, ShortcutOverlay, etc.)
  services/
    orchestrator.ts  # 3-Phasen Pipeline + Direct Mode
    git.ts           # Git Read/Write Operations
    templates.ts     # Agent Templates (8 Workflows)
    scheduler.ts     # Zeitbasierte Automatisierung
    knowledge.ts     # FTS5 RAG
  stores/
    agentStore.ts    # Agent Runs, Phases, Pending Plans
    chatStore.ts     # Persistent Chat Messages
    gitStore.ts      # Git Status + Polling
    metricsStore.ts  # Dashboard Metriken
    schedulerStore.ts # Scheduled Tasks
    teamStore.ts     # Team Members + Assignments
    themeStore.ts    # Dark/Light Theme
    profileStore.ts  # Self-Learning User Profile
  types/             # TypeScript Interfaces
  hooks/             # Custom Hooks (useKeyboardNav)
src-tauri/
  src/lib.rs         # Tauri Commands (41 total)
  src/db.rs          # SQLite + Migrations v1-v5
```

## Design-Sprache

- **Dark Theme:** `#0a0e27` (bg), `#00ff88` (accent), `#00d4ff` (cyan), `#7b61ff` (violet)
- **Light Theme:** `#f0f2f5` (bg), `#00b85e` (accent), `#0094cc` (cyan), `#5b45cc` (violet)
- **Glass-Morphism:** `.glass`, `.glass-elevated`, `.glass-accent`
- **Fonts:** Inter (Body), Space Mono (HUD), JetBrains Mono (Code)

## Lizenz

Private — Luke + Partner
