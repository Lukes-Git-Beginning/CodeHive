import { invoke } from '@tauri-apps/api/core'
import { useNotificationStore } from '../stores/notificationStore'

let lastClipboardContent = ''
let clipboardInterval: ReturnType<typeof setInterval> | null = null

/**
 * Read current clipboard content.
 */
export async function readClipboard(): Promise<string> {
  try {
    return await invoke<string>('read_clipboard')
  } catch {
    return ''
  }
}

/**
 * Start monitoring clipboard for changes.
 * When code is detected, shows a notification suggesting analysis.
 */
export function startClipboardMonitor(onCodeDetected: (code: string) => void) {
  if (clipboardInterval) return // Already running

  clipboardInterval = setInterval(async () => {
    const content = await readClipboard()
    if (!content || content === lastClipboardContent) return
    lastClipboardContent = content

    // Detect if clipboard contains code (heuristic)
    const trimmed = content.trim()
    if (looksLikeCode(trimmed) && trimmed.length > 30 && trimmed.length < 5000) {
      onCodeDetected(trimmed)
    }
  }, 2000) // Check every 2 seconds
}

/**
 * Stop clipboard monitoring.
 */
export function stopClipboardMonitor() {
  if (clipboardInterval) {
    clearInterval(clipboardInterval)
    clipboardInterval = null
  }
}

/**
 * Heuristic to detect if text looks like code.
 */
function looksLikeCode(text: string): boolean {
  const codePatterns = [
    /^(import|from|const|let|var|function|class|def|async|export|interface|type)\s/m,
    /[{}\[\]();].*[{}\[\]();]/,
    /=>/,
    /\(\) *[{=]/,
    /(console\.log|print\(|println!|fmt\.Print)/,
    /^(\/\/|#|\/\*|\*)/m,
    /(\.map|\.filter|\.reduce|\.forEach)\(/,
    /^\s{2,}(if|for|while|return|try|catch)\b/m,
  ]

  let matches = 0
  for (const pattern of codePatterns) {
    if (pattern.test(text)) matches++
  }
  return matches >= 2
}
