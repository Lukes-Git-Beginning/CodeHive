/**
 * Structured logger for CodeHive.
 * Replaces scattered console.log/error calls with a unified interface.
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug'

interface LogEntry {
  level: LogLevel
  module: string
  message: string
  data?: unknown
  timestamp: string
}

const LOG_BUFFER: LogEntry[] = []
const MAX_LOG_BUFFER = 500

function createEntry(level: LogLevel, module: string, message: string, data?: unknown): LogEntry {
  return {
    level,
    module,
    message,
    data,
    timestamp: new Date().toISOString(),
  }
}

function log(entry: LogEntry) {
  LOG_BUFFER.push(entry)
  if (LOG_BUFFER.length > MAX_LOG_BUFFER) {
    LOG_BUFFER.splice(0, LOG_BUFFER.length - MAX_LOG_BUFFER)
  }

  // Also output to browser console in dev mode
  const prefix = `[${entry.module}]`
  switch (entry.level) {
    case 'error':
      console.error(prefix, entry.message, entry.data ?? '')
      break
    case 'warn':
      console.warn(prefix, entry.message, entry.data ?? '')
      break
    case 'debug':
      console.debug(prefix, entry.message, entry.data ?? '')
      break
    default:
      console.log(prefix, entry.message, entry.data ?? '')
  }
}

export const logger = {
  info: (module: string, message: string, data?: unknown) =>
    log(createEntry('info', module, message, data)),

  warn: (module: string, message: string, data?: unknown) =>
    log(createEntry('warn', module, message, data)),

  error: (module: string, message: string, data?: unknown) =>
    log(createEntry('error', module, message, data)),

  debug: (module: string, message: string, data?: unknown) =>
    log(createEntry('debug', module, message, data)),

  /**
   * Get the log buffer (for displaying in a debug panel).
   */
  getLogs: (): readonly LogEntry[] => LOG_BUFFER,

  /**
   * Clear the log buffer.
   */
  clear: () => { LOG_BUFFER.length = 0 },
}
