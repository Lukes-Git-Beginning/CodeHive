import { describe, it, expect } from 'vitest'

// Test the JSON parsing strategies (extracted logic)
function tryParseJSON(output: string): { goals: string[]; tasks: unknown[] } | null {
  // Strategy 1: Full output as JSON
  try {
    const trimmed = output.trim()
    if (trimmed.startsWith('{')) {
      const parsed = JSON.parse(trimmed)
      if (parsed.tasks) return parsed
    }
  } catch { /* not pure JSON */ }

  // Strategy 2: JSON in code blocks
  const codeBlockMatch = output.match(/```(?:json)?\s*(\{[\s\S]*?"tasks"[\s\S]*?\})\s*```/)
  if (codeBlockMatch) {
    try {
      const parsed = JSON.parse(codeBlockMatch[1])
      if (parsed.tasks) return parsed
    } catch { /* invalid */ }
  }

  // Strategy 3: Brace matching
  const firstBrace = output.indexOf('{')
  const lastBrace = output.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      const parsed = JSON.parse(output.slice(firstBrace, lastBrace + 1))
      if (parsed.tasks) return parsed
    } catch { /* invalid */ }
  }

  // Strategy 4: Regex fallback
  const jsonMatch = output.match(/\{[\s\S]*"tasks"[\s\S]*\}/)
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0])
    } catch { /* invalid */ }
  }

  return null
}

describe('JSON Plan Parser', () => {
  it('parses pure JSON output', () => {
    const output = '{"goals": ["Fix bugs"], "tasks": [{"id": "task-01", "name": "Fix auth"}]}'
    const result = tryParseJSON(output)
    expect(result).not.toBeNull()
    expect(result?.goals).toEqual(['Fix bugs'])
    expect(result?.tasks).toHaveLength(1)
  })

  it('parses JSON in markdown code block', () => {
    const output = 'Here is the plan:\n```json\n{"goals": ["Build feature"], "tasks": [{"id": "t1", "name": "Do it"}]}\n```\nLet me know.'
    const result = tryParseJSON(output)
    expect(result).not.toBeNull()
    expect(result?.goals).toEqual(['Build feature'])
  })

  it('parses JSON with surrounding text', () => {
    const output = 'I analyzed the code.\n\n{"goals": ["Audit"], "tasks": [{"id": "t1", "name": "Check XSS"}]}\n\nThats my plan.'
    const result = tryParseJSON(output)
    expect(result).not.toBeNull()
    expect(result?.tasks).toHaveLength(1)
  })

  it('returns null for non-JSON output', () => {
    const output = 'I could not understand the request. Please try again.'
    const result = tryParseJSON(output)
    expect(result).toBeNull()
  })

  it('handles JSON with extra whitespace and newlines', () => {
    const output = `
    {
      "goals": ["Test"],
      "tasks": [
        {
          "id": "task-01",
          "name": "Write tests"
        }
      ]
    }
    `
    const result = tryParseJSON(output)
    expect(result).not.toBeNull()
    expect(result?.tasks).toHaveLength(1)
  })

  it('handles truncated JSON (should return null)', () => {
    const output = '{"goals": ["Fix"], "tasks": [{"id": "t1", "name": "F'
    const result = tryParseJSON(output)
    expect(result).toBeNull()
  })
})
