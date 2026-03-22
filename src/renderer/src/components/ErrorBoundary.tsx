import { Component, type ReactNode, type ErrorInfo } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  retryCount: number
}

/** Catches rendering errors in child components and displays a recovery UI with retry or restart options. */
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
      <div className="h-full flex flex-col items-center justify-center gap-4 bg-white rounded-2xl backdrop-blur-sm border border-gray-200 shadow-xl px-6 text-center">
        <p className="text-sm text-gray-600">Something went wrong.</p>
        {isFirstFailure ? (
          <button
            onClick={this.handleReset}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs rounded-lg transition-colors cursor-pointer"
          >
            Go back
          </button>
        ) : (
          <button
            onClick={this.handleRestart}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs rounded-lg transition-colors cursor-pointer"
          >
            Restart app
          </button>
        )}
      </div>
    )
  }
}
