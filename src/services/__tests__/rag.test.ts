import { describe, it, expect, vi } from 'vitest'

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue([]),
}))

// Test the FTS query sanitization logic (extracted from rag.ts)
function sanitizeFtsQuery(query: string): string {
  return query
    .split(/\s+/)
    .filter((w) => w.length > 1)
    .map((w) => `"${w.replace(/"/g, '')}"`)
    .join(' OR ')
}

describe('FTS Query Sanitization', () => {
  it('wraps words in quotes', () => {
    expect(sanitizeFtsQuery('security audit')).toBe('"security" OR "audit"')
  })

  it('filters out single-character words', () => {
    expect(sanitizeFtsQuery('a security b audit')).toBe('"security" OR "audit"')
  })

  it('escapes double quotes in input', () => {
    expect(sanitizeFtsQuery('test "injection"')).toBe('"test" OR "injection"')
  })

  it('returns empty for single-char input', () => {
    expect(sanitizeFtsQuery('a b c')).toBe('')
  })

  it('handles extra whitespace', () => {
    expect(sanitizeFtsQuery('  security   audit  ')).toBe('"security" OR "audit"')
  })
})
