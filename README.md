# METIS — Self-Evolving AI Desktop Assistant

> Griechische Gottin der klugen Planung. Ein selbstlernender, sich selbst verbessernder KI-Assistent als Tauri 2.x Desktop-App.

## Tech Stack

- **Frontend:** React 19 + TypeScript 5.9 + Tailwind CSS 4
- **Backend:** Tauri 2.x (Rust) + SQLite (mit Migrations-System v5)
- **State:** Zustand 5
- **AI:** Claude Agent SDK (spawnt `claude` CLI als Child-Prozesse)
- **Animationen:** Framer Motion 12
- **Icons:** Lucide React
- **Tests:** Vitest (24 Tests), GitHub Actions CI/CD

## Was Metis besonders macht

Metis ist kein gewoehnlicher Coding-Assistent. Waehrend andere Tools auf einzelne Prompts reagieren, arbeitet Metis als **autonomes Multi-Agent-System** mit Faehigkeiten die kein anderer Coding-Agent hat:

| Faehigkeit | Beschreibung |
|-----------|-------------|
| **Inter-Agent Communication** | Agents teilen Findings in Echtzeit via Blackboard Pattern |
| **Tiered Memory** | 3-stufige Memory-Pipeline: CLAUDE.md → Reflections → Knowledge Graph |
| **Codebase Knowledge Graph** | Versteht Code-Beziehungen strukturell (wer ruft wen, wer nutzt welchen Store) |
| **Recursive Self-Improvement** | Meta-Agent analysiert Performance und optimiert Agent-Genome |
| **Predictive Intent** | Sagt vorher was der User braucht bevor er fragt |
| **Consensus Voting** | Mehrere Agents stimmen unabhaengig ueber kritische Entscheidungen ab |
| **Competing Hypotheses** | Parallel-Debugging: N Agents untersuchen verschiedene Theorien |
| **DB Safety Rules** | Destructive Operationen werden automatisch blockiert |

## Features

### Jarvis-Style UI
- Animierter Orb mit phasenabhaengigen Farben + 3 Ringen
- Omnibox mit Pipeline/Direct Toggle + Screenshot-Button
- Floating ThoughtNodes im Orbit um den Orb (keyboard-accessible)
- MindPalace (Slide-in Panel) mit Agent-Output, Git-Status, Run-History
- Command Palette (Ctrl+P) mit 14+ Commands
- Dark/Light Theme mit CSS-Variable-Swap

### Multi-Agent Orchestrator
- 3-Phasen Pipeline: Plan → Execute → Verify
- Direct Mode fuer einfache Aufgaben
- 8 spezialisierte Agent-Rollen (Frontend, Backend, Testing, Security, DevOps, UIX, Architect, Orchestrator)
- Modell-Routing nach Komplexitaet (Haiku/Sonnet/Opus)
- Wave-basierte parallele Ausfuehrung mit Dependency-Graph
- Plan-Approval UI mit Accept/Reject
- **Blackboard:** Agents kommunizieren ueber Shared State (Findings, Warnings, Requests)
- **File Conflict Detection:** Automatische Erkennung wenn mehrere Agents dieselbe Datei aendern

### Evolution Engine
- **Context Engine:** Budget-aware Memory Pipeline (max 8k Tokens fuer Memory-Context)
  - Tier 1: CLAUDE.md Projektanweisungen
  - Tier 2: Reflections aus vergangenen Runs (gelernte Patterns + Anti-Patterns)
  - Tier 3: Code Graph Dependencies + User-Profil
- **Reflective Memory:** Automatische Post-Mortems nach jedem Run (Erfolg + Fehler)
- **Agent Genome:** Evolvierbare Config pro Rolle (Prompt, Model, Timeout, Budget)
- **Meta-Agent:** Analysiert Performance-Trends, schlaegt Verbesserungen vor (alle 20 Runs)
- **Utility Function:** U = 0.5 x successRate + 0.25 x (1-cost) + 0.25 x (1-time)

### Codebase Knowledge Graph
- Regex-basierter Graph-Builder (imports, functions, components, stores, hooks, types, JSX)
- **Query API:** findDependents(), findDependencies(), findStoreUsers(), findDeadCode()
- **Impact Analysis:** "Wenn ich diese Funktion aendere, was bricht?"
- Graph-Context wird automatisch in Agent-Prompts injiziert
- Lazy-Init beim ersten Orchestrate-Run

### Predictive Intent Engine
- 5 Prediction Types: test_needed, security_scan, refactor_needed, review_needed, complexity_spike
- **Temporal Reasoning:** File-Churn Hotspot Detection (14-Tage-Fenster)
- Confidence-Scoring: Nur Vorschlaege > 65% werden angezeigt
- Integration mit ProactiveSuggestions-UI

### Swarm Intelligence
- **Specialist Router:** Score-basiertes Task-Routing ueber 7 Rollen (File-Extensions + Keywords)
- **Competing Hypotheses:** Parallel-Debugging mit gegenseitiger Hypothesen-Widerlegung
- **Consensus Voting:** 3 unabhaengige Agents mit Confidence-gewichtetem Majority Vote

### Git Intelligence
- Branch-Anzeige + uncommitted Count im ProjectBar
- Datei-Liste + Commit-History im MindPalace
- Git Actions: Commit, Push, Pull, Branch erstellen
- ProactiveSuggestions: "N ungespeicherte Aenderungen — committen?"

### Dashboard + Metriken
- Health Score (gewichteter Composite aus Erfolgsrate, Aktualitaet, Volumen, Git-Sauberkeit)
- Erfolgsrate, Avg. Dauer, Token-Schaetzung
- CSS-only Charts: MiniDonut, MiniBar, Sparkline (SVG)
- 14-Tage Aktivitaets-Uebersicht

### Agent Templates
- 8 vordefinierte Workflows (Full Code Review, Test Suite, Security Audit, Performance, Docs, Bug Hunt, Refactoring, Deploy Checklist)
- Loading-States + Error-Handling pro Template
- Auswahl ueber Ctrl+T oder Command Palette

### Sicherheit
- **AGENT_SAFETY_RULES** in jedem Agent-Prompt:
  - Keine destructive DB-Operationen (DROP, DELETE FROM, TRUNCATE)
  - Backup-Pflicht vor Datenbank-Aenderungen
  - Keine Secrets/API-Keys im Output
  - Kein git push --force / git reset --hard
  - Dateizugriff auf Projektverzeichnis beschraenkt
- **MCP Config:** Command-Whitelist (npx, node, uvx, docker, python)
- **Path Traversal Protection:** project.path + project.id sanitized
- **FTS5 Sanitization:** SQL-Injection ueber Suchoperatoren verhindert

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
- Zeitbasierter Scheduler (15min bis woechentlich)
- Team-Management mit Rollen + Task-Zuweisung
- Accessibility: prefers-reduced-motion, ARIA roles/labels, focus-visible, role=dialog

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
| `?` | Shortcut-Uebersicht |
| `j/k` | Vim-Navigation in Listen |
| `Esc` | Panel schliessen |

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
    chat/            # ChatPanel (alternative Chat-Ansicht)
    layout/          # Sidebar, StatusBar
  services/
    orchestrator.ts  # 3-Phasen Pipeline + Direct Mode + Blackboard + Safety
    blackboard.ts    # Inter-Agent Communication (Shared Findings, Conflicts)
    contextEngine.ts # Budget-aware 3-Tier Memory Pipeline
    codeGraph.ts     # Codebase Knowledge Graph (Nodes, Edges, Queries)
    consensus.ts     # Multi-Agent Consensus Voting
    swarm.ts         # Specialist Router + Competing Hypotheses
    metaAgent.ts     # Recursive Self-Improvement + Agent Genome
    intentPredictor.ts # Predictive Intent Engine + Temporal Reasoning
    git.ts           # Git Read/Write Operations
    templates.ts     # Agent Templates (8 Workflows)
    scheduler.ts     # Zeitbasierte Automatisierung
    knowledge.ts     # FTS5 RAG + Learning Extraction
    rag.ts           # Full-Text Search + CLAUDE.md Context
    agentRoles.ts    # Role-specific Prompts + Safety Rules
    mcpConfig.ts     # MCP Server Config (secured)
    persistence.ts   # SQLite CRUD + Settings + Error Handling
  stores/
    agentStore.ts    # Agent Runs, Phases, Pending Plans, Run History
    chatStore.ts     # Persistent Chat Messages (stale-check)
    gitStore.ts      # Git Status + Polling (try/catch)
    metricsStore.ts  # Dashboard Metriken (stable cutoff)
    schedulerStore.ts # Scheduled Tasks (updater functions)
    teamStore.ts     # Team Members + Assignments (optimistic rollback)
    themeStore.ts    # Dark/Light Theme
    profileStore.ts  # Self-Learning User Profile (deep clone)
    projectStore.ts  # Projects + Tasks (optimistic rollback)
    notificationStore.ts # Notifications (read/dismissed split)
  types/             # TypeScript Interfaces (inkl. BlackboardEntry, FileConflict)
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

## Audit-History

| Runde | Fixes | Fokus |
|-------|-------|-------|
| Runde 1 | 22 | Bugs, Stores, Accessibility, UX |
| Runde 2 | 27 | Race Conditions, ARIA, Forms, UX |
| Runde 3 (Metis Self-Audit) | 30 | Security, State-Leaks, A11y, Keyboard |
| **Gesamt** | **~80** | 54 Dateien, +2358 / -228 Zeilen |

## Lizenz

Private — Luke + Partner
