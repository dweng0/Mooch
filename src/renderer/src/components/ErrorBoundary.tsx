import { Component, type ReactNode, type ErrorInfo } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  retryCount: number
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, retryCount: 0 }

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, info.componentStack)
  }

  handleReset = () => {
    this.setState((prev) => ({ hasError: false, retryCount: prev.retryCount + 1 }))
  }

  handleRestart = () => {
    window.electronAPI.restartApp()
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    const isFirstFailure = this.state.retryCount === 0

    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 bg-gray-900/85 rounded-2xl backdrop-blur-sm border border-white/10 shadow-2xl px-6 text-center">
        <p className="text-sm text-gray-300">Something went wrong.</p>
        {isFirstFailure ? (
          <button
            onClick={this.handleReset}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs rounded-lg transition-colors cursor-pointer"
          >
            Go back
          </button>
        ) : (
          <button
            onClick={this.handleRestart}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs rounded-lg transition-colors cursor-pointer"
          >
            Restart app
          </button>
        )}
      </div>
    )
  }
}
