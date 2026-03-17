import { invoke } from '@tauri-apps/api/core'
import { useChatStore } from '../stores/chatStore'
import { useProjectStore } from '../stores/projectStore'
import { orchestrate } from './orchestrator'

/**
 * Capture a screenshot of the primary display.
 * Returns the file path of the saved screenshot.
 */
export async function captureScreen(): Promise<string> {
  return await invoke<string>('capture_screenshot')
}

/**
 * Get the screenshot as base64 encoded string.
 */
export async function getScreenshotBase64(): Promise<string> {
  return await invoke<string>('screenshot_to_base64')
}

/**
 * Capture screen and analyze with Claude via Metis orchestrator.
 * The agent will receive the screenshot context in its prompt.
 */
export async function captureAndAnalyze(userPrompt?: string): Promise<void> {
  const chatStore = useChatStore.getState()
  const activeProject = useProjectStore.getState().getActiveProject()

  if (!activeProject) {
    chatStore.addMessage({
      id: crypto.randomUUID(),
      role: 'system',
      content: 'Kein aktives Projekt — Screenshot-Analyse benötigt ein Projekt.',
      timestamp: new Date().toISOString(),
    })
    return
  }

  try {
    // Capture screenshot
    const screenshotPath = await captureScreen()

    chatStore.addMessage({
      id: crypto.randomUUID(),
      role: 'user',
      content: `[Screenshot aufgenommen]\n${userPrompt || 'Analysiere diesen Screenshot.'}`,
      timestamp: new Date().toISOString(),
    })

    // Build prompt that tells the agent about the screenshot
    const prompt = `Ein Screenshot wurde aufgenommen und liegt unter: ${screenshotPath}

${userPrompt || 'Analysiere den Screenshot und beschreibe was du siehst. Wenn es ein Fehler oder Code ist, erkläre was passiert und schlage Lösungen vor.'}

Hinweis: Lies die Datei ${screenshotPath} um den Screenshot zu sehen. Nutze deine Vision-Fähigkeiten um den Inhalt zu analysieren.`

    chatStore.setProcessing(true)
    await orchestrate(prompt, activeProject)
  } catch (err) {
    chatStore.addMessage({
      id: crypto.randomUUID(),
      role: 'system',
      content: `Screenshot-Fehler: ${String(err)}`,
      timestamp: new Date().toISOString(),
    })
    chatStore.setProcessing(false)
  }
}
