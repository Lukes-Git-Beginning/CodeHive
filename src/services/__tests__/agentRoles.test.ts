import { describe, it, expect } from 'vitest'
import { getRoleForTask, ROLE_PROMPTS } from '../agentRoles'

describe('getRoleForTask', () => {
  it('assigns testing role for test-related tasks', () => {
    expect(getRoleForTask('Write unit tests for auth', 'Test Auth')).toBe('testing')
    expect(getRoleForTask('Run vitest coverage', 'Coverage')).toBe('testing')
    expect(getRoleForTask('Add jest specs', 'Specs')).toBe('testing')
  })

  it('assigns frontend role for UI tasks', () => {
    expect(getRoleForTask('Fix the React component', 'Fix Button')).toBe('frontend')
    expect(getRoleForTask('Update Tailwind styles', 'Styles')).toBe('frontend')
    expect(getRoleForTask('Add responsive layout', 'Layout')).toBe('frontend')
  })

  it('assigns devops role for CI/CD tasks', () => {
    expect(getRoleForTask('Set up GitHub Actions CI', 'CI Pipeline')).toBe('devops')
    expect(getRoleForTask('Create Dockerfile', 'Docker')).toBe('devops')
    expect(getRoleForTask('Deploy to production', 'Deploy')).toBe('devops')
  })

  it('assigns security role for audit tasks', () => {
    expect(getRoleForTask('Check for XSS vulnerabilities', 'XSS Audit')).toBe('security')
    expect(getRoleForTask('Review CSP settings', 'CSP')).toBe('security')
    expect(getRoleForTask('OWASP audit', 'Security')).toBe('security')
  })

  it('assigns architect role for design tasks', () => {
    expect(getRoleForTask('Refactor the service layer', 'Refactor')).toBe('architect')
    expect(getRoleForTask('Design new architecture', 'Architecture')).toBe('architect')
  })

  it('defaults to backend for general tasks', () => {
    expect(getRoleForTask('Implement user CRUD', 'CRUD')).toBe('backend')
    expect(getRoleForTask('Add API endpoint', 'API')).toBe('backend')
  })
})

describe('ROLE_PROMPTS', () => {
  it('has prompts for all defined roles', () => {
    const expectedRoles = ['frontend', 'backend', 'testing', 'devops', 'security', 'architect', 'orchestrator', 'uiux']
    for (const role of expectedRoles) {
      expect(ROLE_PROMPTS).toHaveProperty(role)
      expect(typeof ROLE_PROMPTS[role as keyof typeof ROLE_PROMPTS]).toBe('string')
      expect(ROLE_PROMPTS[role as keyof typeof ROLE_PROMPTS].length).toBeGreaterThan(10)
    }
  })
})
