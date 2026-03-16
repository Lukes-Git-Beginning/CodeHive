# CLAUDE.md - CodeHive Multi-Agent Orchestrator

## Projekt-Kontext
- **Stack:** Tauri 2.x (Rust) + React 19 + TypeScript + Tailwind CSS
- **State:** Zustand
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
- `src/components/` — UI-Komponenten (layout, chat, agents, projects, roadmap, settings)
- `src/stores/` — Zustand Stores (projectStore, agentStore, chatStore)
- `src/types/` — TypeScript Types
- `src-tauri/` — Rust Backend (Tauri)
- `agents/` — Agent-Definitionen, Orchestrator, Templates

## Regeln
- Sprache: Deutsch für UI-Texte, Englisch für Code
- Tailwind CSS Custom Theme in `src/index.css`
- Kein externes CSS-Framework (kein DaisyUI)
