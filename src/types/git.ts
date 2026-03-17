export interface GitFileChange {
  path: string
  status: string
}

export interface GitStatus {
  is_git_repo: boolean
  branch: string
  files: GitFileChange[]
  ahead: number
  behind: number
}

export interface GitCommit {
  hash: string
  short_hash: string
  author: string
  date: string
  message: string
}
