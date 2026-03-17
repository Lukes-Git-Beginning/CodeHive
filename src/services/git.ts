import { invoke } from '@tauri-apps/api/core'
import type { GitStatus, GitCommit } from '../types/git'

const EMPTY_STATUS: GitStatus = {
  is_git_repo: false,
  branch: '',
  files: [],
  ahead: 0,
  behind: 0,
}

export async function getGitStatus(path: string): Promise<GitStatus> {
  try {
    return await invoke<GitStatus>('git_status', { path })
  } catch {
    return EMPTY_STATUS
  }
}

export async function getRecentCommits(path: string, limit = 10): Promise<GitCommit[]> {
  try {
    return await invoke<GitCommit[]>('git_log', { path, limit })
  } catch {
    return []
  }
}

export async function getGitDiff(path: string, staged = false): Promise<string> {
  try {
    return await invoke<string>('git_diff', { path, staged })
  } catch {
    return ''
  }
}

// ── Write Operations ──

export async function gitCommit(path: string, message: string, files?: string[]): Promise<string> {
  return await invoke<string>('git_commit', { path, message, files: files ?? [] })
}

export async function gitPush(path: string, remote?: string, branch?: string): Promise<string> {
  return await invoke<string>('git_push', { path, remote, branch })
}

export async function gitPull(path: string, remote?: string, branch?: string): Promise<string> {
  return await invoke<string>('git_pull', { path, remote, branch })
}

export async function gitCheckout(path: string, branch: string, create?: boolean): Promise<string> {
  return await invoke<string>('git_checkout', { path, branch, create })
}
