import { invoke } from '@tauri-apps/api/core'
import type { Project } from '../types/project'
import { readClaudeMd } from './rag'

export interface ScanResult {
  id: string
  type: 'info' | 'warning' | 'suggestion'
  title: string
  detail: string
}

/**
 * Quick project scan on project switch or app start.
 * Checks for common issues and opportunities.
 */
export async function quickScan(project: Project): Promise<ScanResult[]> {
  const results: ScanResult[] = []

  // Check if CLAUDE.md exists
  const claudeMd = await readClaudeMd(project.path)
  if (!claudeMd) {
    results.push({
      id: 'no-claude-md',
      type: 'suggestion',
      title: 'Keine CLAUDE.md gefunden',
      detail: 'Erstelle eine CLAUDE.md im Projekt-Root damit Metis den Projekt-Kontext besser versteht.',
    })
  }

  // Check tech stack
  if (project.techStack.length === 0) {
    results.push({
      id: 'no-tech-stack',
      type: 'info',
      title: 'Tech-Stack nicht erkannt',
      detail: 'Metis konnte den Tech-Stack nicht automatisch erkennen. Manche Vorschläge könnten weniger präzise sein.',
    })
  }

  // Check for common files that indicate opportunities
  try {
    const files = await invoke<Array<{ name: string; is_dir: boolean }>>('list_project_files', {
      path: project.path,
      maxDepth: 1,
    })

    const fileNames = files.map((f) => f.name)

    // No tests directory
    if (!fileNames.some((f) => f === 'tests' || f === '__tests__' || f === 'test' || f === 'spec')) {
      results.push({
        id: 'no-tests',
        type: 'warning',
        title: 'Kein Test-Verzeichnis gefunden',
        detail: 'Metis kann Tests für dein Projekt generieren.',
      })
    }

    // No CI/CD
    if (!fileNames.includes('.github') && !fileNames.includes('.gitlab-ci.yml')) {
      results.push({
        id: 'no-cicd',
        type: 'suggestion',
        title: 'Keine CI/CD Pipeline',
        detail: 'Metis kann eine GitHub Actions Pipeline für dein Projekt erstellen.',
      })
    }

    // Docker
    if (!fileNames.includes('Dockerfile') && !fileNames.includes('docker-compose.yml')) {
      if (project.techStack.some((t) => ['Python', 'Node.js', 'Flask', 'React'].includes(t))) {
        results.push({
          id: 'no-docker',
          type: 'suggestion',
          title: 'Keine Docker-Konfiguration',
          detail: 'Metis kann Dockerfile und docker-compose.yml für dein Projekt erstellen.',
        })
      }
    }
  } catch {
    // File listing failed — skip file-based checks
  }

  return results.slice(0, 4) // Max 4 results
}
