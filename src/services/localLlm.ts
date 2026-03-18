import { getSetting, setSetting } from './persistence'

export interface LocalLlmConfig {
  enabled: boolean
  provider: 'ollama' | 'lmstudio'
  baseUrl: string
  model: string
}

const DEFAULT_CONFIG: LocalLlmConfig = {
  enabled: false,
  provider: 'ollama',
  baseUrl: 'http://localhost:11434',
  model: 'llama3.1',
}

/**
 * Load local LLM configuration from settings.
 */
export async function loadLocalLlmConfig(): Promise<LocalLlmConfig> {
  const saved = await getSetting('local_llm_config')
  if (saved) {
    try {
      return { ...DEFAULT_CONFIG, ...JSON.parse(saved) }
    } catch {
      return DEFAULT_CONFIG
    }
  }
  return DEFAULT_CONFIG
}

/**
 * Save local LLM configuration.
 */
export async function saveLocalLlmConfig(config: LocalLlmConfig): Promise<void> {
  await setSetting('local_llm_config', JSON.stringify(config))
}

/**
 * Check if Ollama is running and accessible.
 */
export async function checkOllamaStatus(): Promise<{ running: boolean; models: string[] }> {
  try {
    const config = await loadLocalLlmConfig()
    const response = await fetch(`${config.baseUrl}/api/tags`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000),
    })
    if (!response.ok) return { running: false, models: [] }
    const data = await response.json() as { models?: Array<{ name: string }> }
    const models = data.models?.map((m) => m.name) || []
    return { running: true, models }
  } catch {
    return { running: false, models: [] }
  }
}

/**
 * Send a prompt to Ollama and get a response.
 * Useful for quick, offline operations.
 */
export async function queryOllama(prompt: string, model?: string): Promise<string> {
  const config = await loadLocalLlmConfig()
  const selectedModel = model || config.model

  const response = await fetch(`${config.baseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: selectedModel,
      prompt,
      stream: false,
    }),
    signal: AbortSignal.timeout(120000), // 2 min timeout
  })

  if (!response.ok) {
    throw new Error(`Ollama error: ${response.status}`)
  }

  const data = await response.json() as { response: string }
  return data.response
}
