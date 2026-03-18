/**
 * Multi-Agent Consensus System — Voting for critical decisions.
 *
 * For important decisions (security approvals, architecture changes, breaking changes),
 * multiple independent agents vote on the decision. Majority wins, with confidence weighting.
 *
 * Pattern: 3 agents vote → majority decides. On disagreement, 4th mediator resolves.
 */

import type { Project } from '../types/project'
import { ROLE_PROMPTS } from './agentRoles'
import { getProjectBrief } from './knowledge'

// Re-use spawnAndWait from orchestrator — but we need to call invoke directly
// since spawnAndWait is not exported. We use a simplified version here.
import { invoke } from '@tauri-apps/api/core'
import { useAgentStore } from '../stores/agentStore'
import { getSetting } from './persistence'

export interface ConsensusVote {
  agentId: string
  role: string
  decision: 'approve' | 'reject' | 'abstain'
  confidence: number // 0-1
  reasoning: string
}

export interface ConsensusResult {
  decision: 'approved' | 'rejected' | 'inconclusive'
  votes: ConsensusVote[]
  confidence: number // weighted average
  summary: string
}

const CONSENSUS_ROLES = ['security', 'architect', 'backend'] as const

/**
 * Run a consensus vote on a decision with 3 independent agents.
 * Each agent evaluates independently, then results are aggregated.
 */
export async function runConsensus(
  question: string,
  context: string,
  project: Project,
): Promise<ConsensusResult> {
  const brief = await getProjectBrief(project)

  const prompt = `Du bist Teil eines Consensus-Votings. Bewerte folgende Entscheidung unabhängig.

Kontext:
${brief}
${context}

Frage: ${question}

Antworte EXAKT in diesem JSON-Format:
{
  "decision": "approve" | "reject" | "abstain",
  "confidence": 0.0 bis 1.0,
  "reasoning": "Deine Begründung in 1-2 Sätzen"
}

Sei ehrlich und kritisch. Wenn du unsicher bist, gib eine niedrige Confidence.`

  const autoAccept = await getSetting('auto_accept')
  const permissionMode = autoAccept === 'true' ? 'acceptEdits' : undefined

  // Spawn 3 agents in parallel
  const votePromises = CONSENSUS_ROLES.map(async (role) => {
    const agentId = crypto.randomUUID()
    const systemPrompt = ROLE_PROMPTS[role] || ROLE_PROMPTS.backend

    try {
      await invoke('spawn_agent', {
        agentId,
        role,
        prompt,
        projectPath: project.path,
        systemPrompt: `${systemPrompt}\n\nDu nimmst an einem Consensus-Voting teil. Antworte NUR mit dem geforderten JSON.`,
        model: 'claude-haiku-4-5-20251001', // Use haiku for cost-efficiency
        permissionMode,
      })

      // Wait for completion (simplified — 60s timeout for voting)
      await new Promise<void>((resolve) => setTimeout(resolve, 60_000))

      // Collect output
      const agent = useAgentStore.getState().currentRun?.agents.find((a) => a.id === agentId)
      const output = agent?.output.join('\n') || ''

      return parseVote(agentId, role, output)
    } catch {
      return { agentId, role, decision: 'abstain' as const, confidence: 0, reasoning: 'Agent konnte nicht gestartet werden' }
    }
  })

  const votes = await Promise.all(votePromises)

  return aggregateVotes(votes)
}

/**
 * Parse a vote from agent output.
 */
function parseVote(agentId: string, role: string, output: string): ConsensusVote {
  try {
    // Try to extract JSON from output
    const jsonMatch = output.match(/\{[\s\S]*"decision"[\s\S]*\}/)
    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[0])
      return {
        agentId,
        role,
        decision: ['approve', 'reject', 'abstain'].includes(data.decision) ? data.decision : 'abstain',
        confidence: typeof data.confidence === 'number' ? Math.max(0, Math.min(1, data.confidence)) : 0.5,
        reasoning: String(data.reasoning || '').slice(0, 500),
      }
    }
  } catch { /* parse failed */ }

  // Fallback: try to infer from text
  const lower = output.toLowerCase()
  if (lower.includes('approve') || lower.includes('genehmig')) {
    return { agentId, role, decision: 'approve', confidence: 0.5, reasoning: output.slice(0, 200) }
  }
  if (lower.includes('reject') || lower.includes('ablehn')) {
    return { agentId, role, decision: 'reject', confidence: 0.5, reasoning: output.slice(0, 200) }
  }

  return { agentId, role, decision: 'abstain', confidence: 0, reasoning: 'Konnte Antwort nicht interpretieren' }
}

/**
 * Aggregate votes into a consensus result.
 * Uses confidence-weighted majority voting.
 */
function aggregateVotes(votes: ConsensusVote[]): ConsensusResult {
  let approveWeight = 0
  let rejectWeight = 0

  for (const vote of votes) {
    if (vote.decision === 'approve') approveWeight += vote.confidence
    else if (vote.decision === 'reject') rejectWeight += vote.confidence
  }

  const totalWeight = approveWeight + rejectWeight
  const avgConfidence = totalWeight > 0 ? totalWeight / votes.filter((v) => v.decision !== 'abstain').length : 0

  let decision: ConsensusResult['decision']
  if (totalWeight === 0) {
    decision = 'inconclusive'
  } else if (approveWeight > rejectWeight) {
    decision = 'approved'
  } else {
    decision = 'rejected'
  }

  const approveCount = votes.filter((v) => v.decision === 'approve').length
  const rejectCount = votes.filter((v) => v.decision === 'reject').length

  const summary = `Consensus: ${decision} (${approveCount} approve, ${rejectCount} reject, Confidence: ${Math.round(avgConfidence * 100)}%)\n` +
    votes.map((v) => `  ${v.role}: ${v.decision} (${Math.round(v.confidence * 100)}%) — ${v.reasoning}`).join('\n')

  return { decision, votes, confidence: avgConfidence, summary }
}
