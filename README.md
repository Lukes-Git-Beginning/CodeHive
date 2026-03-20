# METIS — Self-Evolving AI Desktop Assistant

> Griechische Göttin der klugen Planung. Ein selbstlernender, sich selbst verbessernder KI-Assistent als Tauri 2.x Desktop-App.

## Tech Stack

- **Frontend:** React 19 + TypeScript 5.9 + Tailwind CSS 4
- **Backend:** Tauri 2.x (Rust) + SQLite (mit Migrations-System v5)
- **State:** Zustand 5
- **Routing:** react-router-dom v7 (Memory Router)
- **AI:** Claude Agent SDK (spawnt `claude` CLI als Child-Prozesse)
- **Animationen:** Framer Motion 12
- **Icons:** Lucide React
- **Tests:** Vitest (24 Tests), GitHub Actions CI/CD

## Was Metis besonders macht

Metis ist kein gewöhnlicher Coding-Assistent. Während andere Tools auf einzelne Prompts reagieren, arbeitet Metis als **autonomes Multi-Agent-System** mit Fähigkeiten die kein anderer Coding-Agent hat:

| Fähigkeit | Beschreibung |
|-----------|-------------|
| **Inter-Agent Communication** | Agents teilen Findings in Echtzeit via Blackboard Pattern |
| **Tiered Memory** | 3-stufige Memory-Pipeline: CLAUDE.md → Reflections → Knowledge Graph |
| **Codebase Knowledge Graph** | Versteht Code-Beziehungen strukturell (wer ruft wen, wer nutzt welchen Store) |
| **Recursive Self-Improvement** | Meta-Agent analysiert Performance und optimiert Agent-Genome |
| **Predictive Intent** | Sagt vorher was der User braucht bevor er fragt |
| **Consensus Voting** | Mehrere Agents stimmen unabhängig über kritische Entscheidungen ab |
| **Competing Hypotheses** | Parallel-Debugging: N Agents untersuchen verschiedene Theorien |
| **DB Safety Rules** | Destructive Operationen werden automatisch blockiert |

## Features

### UI/UX — Warmes Premium-Design
- **Chat-first Interface** im Stil von ChatGPT/Claude mit Plan-Modus, Auto-Accept und Model-Selector
- **Sidebar-Navigation** (einklappbar) mit allen Bereichen: Chat, Knowledge, Agents, Dashboard, Logs, Deep Scan, Roadmap
- **TopBar** mit Breadcrumb, Git-Branch-Anzeige, Benachrichtigungen und Theme-Toggle
- **Warme Farbpalette:** Tiefbraun, Beige, Burnt-Orange Akzente — Premium-Ästhetik inspiriert von griechischer Mythologie
- **Design-System Primitives:** Button, Card, Input, Badge, Avatar, Tabs, Skeleton
- **Dark/Light Theme** mit CSS-Variable-Swap
- Command Palette (Ctrl+P) mit 14+ Commands

### Multi-Agent Orchestrator
- 3-Phasen Pipeline: Plan → Execute → Verify
- Direct Mode für einfache Aufgaben
- 8 spezialisierte Agent-Rollen (Frontend, Backend, Testing, Security, DevOps, UIX, Architect, Orchestrator)
- Modell-Routing nach Komplexität (Haiku/Sonnet/Opus)
- Wave-basierte parallele Ausführung mit Dependency-Graph
- Plan-Approval UI mit Accept/Reject
- **Blackboard:** Agents kommunizieren über Shared State (Findings, Warnings, Requests)
- **File Conflict Detection:** Automatische Erkennung wenn mehrere Agents dieselbe Datei ändern

### Evolution Engine
- **Context Engine:** Budget-aware Memory Pipeline (max 8k Tokens für Memory-Context)
  - Tier 1: CLAUDE.md Projektanweisungen
  - Tier 2: Reflections aus vergangenen Runs (gelernte Patterns + Anti-Patterns)
  - Tier 3: Code Graph Dependencies + User-Profil
- **Reflective Memory:** Automatische Post-Mortems nach jedem Run (Erfolg + Fehler)
- **Agent Genome:** Evolvierbare Config pro Rolle (Prompt, Model, Timeout, Budget)
- **Meta-Agent:** Analysiert Performance-Trends, schlägt Verbesserungen vor (alle 20 Runs)
- **Utility Function:** U = 0.5 × successRate + 0.25 × (1-cost) + 0.25 × (1-time)

### Codebase Knowledge Graph
- Regex-basierter Graph-Builder (imports, functions, components, stores, hooks, types, JSX)
- **Query API:** findDependents(), findDependencies(), findStoreUsers(), findDeadCode()
- **Impact Analysis:** "Wenn ich diese Funktion ändere, was bricht?"
- Graph-Context wird automatisch in Agent-Prompts injiziert
- Lazy-Init beim ersten Orchestrate-Run

### Predictive Intent Engine
- 5 Prediction Types: test_needed, security_scan, refactor_needed, review_needed, complexity_spike
- **Temporal Reasoning:** File-Churn Hotspot Detection (14-Tage-Fenster)
- Confidence-Scoring: Nur Vorschläge > 65% werden angezeigt
- Integration mit ProactiveSuggestions-UI

### Swarm Intelligence
- **Specialist Router:** Score-basiertes Task-Routing über 7 Rollen (File-Extensions + Keywords)
- **Competing Hypotheses:** Parallel-Debugging mit gegenseitiger Hypothesen-Widerlegung
- **Consensus Voting:** 3 unabhängige Agents mit Confidence-gewichtetem Majority Vote

### Git Intelligence
- Branch-Anzeige + uncommitted Count in der TopBar
- Git Actions: Commit, Push, Pull, Branch erstellen
- ProactiveSuggestions: "N ungespeicherte Änderungen — committen?"

### Dashboard + Metriken
- Health Score (gewichteter Composite aus Erfolgsrate, Aktualität, Volumen, Git-Sauberkeit)
- Erfolgsrate, Avg. Dauer, Token-Schätzung
- CSS-only Charts: MiniDonut, MiniBar, Sparkline (SVG)
- 14-Tage Aktivitäts-Übersicht

### Agent Templates
- 8 vordefinierte Workflows (Full Code Review, Test Suite, Security Audit, Performance, Docs, Bug Hunt, Refactoring, Deploy Checklist)
- Loading-States + Error-Handling pro Template
- Auswahl über Ctrl+T oder Command Palette

### Sicherheit
- **AGENT_SAFETY_RULES** in jedem Agent-Prompt:
  - Keine destructive DB-Operationen (DROP, DELETE FROM, TRUNCATE)
  - Backup-Pflicht vor Datenbank-Änderungen
  - Keine Secrets/API-Keys im Output
  - Kein git push --force / git reset --hard
  - Dateizugriff auf Projektverzeichnis beschränkt
- **MCP Config:** Command-Whitelist (npx, node, uvx, docker, python)
- **Path Traversal Protection:** project.path + project.id sanitized
- **FTS5 Sanitization:** SQL-Injection über Suchoperatoren verhindert

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
- Keyboard-first UX mit Shortcut-Overlay (?)
- Zeitbasierter Scheduler (15min bis wöchentlich)
- Team-Management mit Rollen + Task-Zuweisung
- Accessibility: prefers-reduced-motion, ARIA roles/labels, focus-visible, role=dialog

## Keyboard Shortcuts

| Shortcut | Aktion |
|---|---|
| `Ctrl+P` | Command Palette |
| `Ctrl+N` | Notification Center |
| `Ctrl+,` | Einstellungen |
| `Ctrl+Shift+S` | Screenshot analysieren |
| `Ctrl+Shift+T` | Theme wechseln |
| `?` | Shortcut-Übersicht |
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
    metis/           # Layout-Shell (AppShell, Sidebar, TopBar)
    chat/            # Chat-Experience (ChatPage, ChatMessage, ChatInput)
    ui/              # Design-System Primitives (Button, Card, Input, Badge, Avatar, Tabs, Skeleton)
    dashboard/       # MetricsDashboard + Charts
    knowledge/       # Knowledge Base Panel
    agents/          # Agent-Übersicht + Monitor
    roadmap/         # Kanban-Board
    deepscan/        # Deep Codebase Analysis
    logs/            # Run History
    settings/        # SettingsPanel (Scheduler, Team, Theme, MCP)
    projects/        # Projekt-Auswahl + Import/Export
    onboarding/      # Ersteinrichtung
    jarvis/          # Legacy (CommandPalette aktiv, Rest deprecated)
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
    chatStore.ts     # Persistent Chat Messages
    gitStore.ts      # Git Status + Polling
    metricsStore.ts  # Dashboard Metriken
    uiStore.ts       # Sidebar, Command Palette, Notification Center State
    schedulerStore.ts # Scheduled Tasks
    teamStore.ts     # Team Members + Assignments
    themeStore.ts    # Dark/Light Theme
    profileStore.ts  # Self-Learning User Profile
    projectStore.ts  # Projects + Tasks
    notificationStore.ts # Notifications
  types/             # TypeScript Interfaces
src-tauri/
  src/lib.rs         # Tauri Commands (41 total)
  src/db.rs          # SQLite + Migrations v1-v5
```

## Design-System

- **Dark Theme:** `#0f0b08` (bg), `#c4702a` (accent/burnt orange), `#e8dcc8` (text/beige)
- **Light Theme:** `#f5f0ea` (bg), `#a85d1f` (accent), `#2a2018` (text)
- **Elevation:** `.shadow-subtle`, `.shadow-card`, `.shadow-elevated`, `.shadow-floating`
- **Glass:** `.glass`, `.glass-elevated`, `.glass-accent` (warm-toned)
- **Fonts:** Plus Jakarta Sans (Body), JetBrains Mono (Code)

## Audit-History

| Runde | Fixes | Fokus |
|-------|-------|-------|
| Runde 1 | 22 | Bugs, Stores, Accessibility, UX |
| Runde 2 | 27 | Race Conditions, ARIA, Forms, UX |
| Runde 3 (Metis Self-Audit) | 30 | Security, State-Leaks, A11y, Keyboard |
| **Gesamt** | **~80** | 54 Dateien, +2358 / -228 Zeilen |

## Lizenz

Private — Luke + Partner
