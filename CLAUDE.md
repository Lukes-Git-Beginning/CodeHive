# CLAUDE.md - CodeHive / Metis — Multi-Agent Orchestrator

## Projekt-Kontext
- **Stack:** Tauri 2.x (Rust) + React 19 + TypeScript + Tailwind CSS v4
- **State:** Zustand
- **Routing:** react-router-dom v7 (createMemoryRouter)
- **Agent-Backend:** Claude Agent SDK (TypeScript)
- **DB:** SQLite (via Tauri SQL Plugin)
- **Package Manager:** npm

## Entwicklung
```bash
npm run dev          # Vite Dev-Server (Frontend only)
npx tauri dev        # Full Tauri Dev (Frontend + Rust Backend)
npx tauri build      # Production .exe Build
```

## Architektur
- `src/` — React Frontend
- `src/components/metis/` — Layout-Shell (AppShell, MetisSidebar, MetisTopBar)
- `src/components/chat/` — Chat-Experience (ChatPage, ChatMessage, ChatInput)
- `src/components/ui/` — Design-System Primitives (Button, Card, Input, Badge, Avatar, Tabs, Skeleton)
- `src/components/knowledge/` — Knowledge Base Panel
- `src/components/agents/` — Agent-Übersicht
- `src/components/dashboard/` — Metriken & Charts
- `src/components/deepscan/` — Deep Scan
- `src/components/logs/` — Run History
- `src/components/roadmap/` — Kanban Board
- `src/components/settings/` — Einstellungen
- `src/components/projects/` — Projekt-Auswahl
- `src/components/onboarding/` — Ersteinrichtung
- `src/components/jarvis/` — Legacy (CommandPalette noch aktiv, Rest deprecated)
- `src/stores/` — Zustand Stores (projectStore, agentStore, chatStore, uiStore, themeStore, etc.)
- `src/types/` — TypeScript Types
- `src-tauri/` — Rust Backend (Tauri)
- `agents/` — Agent-Definitionen, Orchestrator, Templates

## Design-System
- **Farbpalette:** Warme Töne — Tiefbraun (#0f0b08), Beige (#e8dcc8), Burnt Orange (#c4702a)
- **Font:** Plus Jakarta Sans (Body), JetBrains Mono (Code)
- **Stil:** Subtle Shadows, Apple-artige Premium-Ästhetik, griechische Mythologie-Branding
- **Dark Mode** ist Standard, Light Mode verfügbar
- Theme-Tokens in `src/index.css` (@theme Block)

## Regeln
- Sprache: Deutsch für UI-Texte, Englisch für Code
- Tailwind CSS Custom Theme in `src/index.css`
- Kein externes CSS-Framework (kein DaisyUI)
- Neue UI-Komponenten in `src/components/ui/` als Primitives (Button, Card, etc.)
- Routing über react-router-dom Memory Router (Seiten, nicht Overlay-Modals)
- Sidebar-Navigation links, TopBar oben mit Breadcrumb
