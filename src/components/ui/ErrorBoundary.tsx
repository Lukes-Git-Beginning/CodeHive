import { Component, type ReactNode, type ErrorInfo } from 'react'
import { AlertTriangle } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onReset?: () => void
  label?: string
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[ErrorBoundary${this.props.label ? `:${this.props.label}` : ''}]`, error, info)
  }

  handleReset = () => {
    this.setState({ error: null })
    this.props.onReset?.()
  }

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center">
          <AlertTriangle className="w-10 h-10 text-danger mb-3" />
          <p className="font-hud text-xs text-danger mb-2">
            {this.props.label ? `${this.props.label} — ` : ''}System Error
          </p>
          <p className="text-xs text-text-muted max-w-md font-mono mb-4">
            {this.state.error.message}
          </p>
          <button
            onClick={this.handleReset}
            className="glass neon-hover rounded-lg px-4 py-2 text-xs text-accent font-hud"
          >
            Retry
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
