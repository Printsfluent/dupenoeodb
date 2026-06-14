import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('App error:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      const quotaExceeded =
        this.state.error.name === 'QuotaExceededError' ||
        this.state.error.message.toLowerCase().includes('quota')
      return (
        <div className="min-h-screen flex items-center justify-center bg-app-bg p-6">
          <div className="max-w-md text-center">
            <h1 className="text-lg font-semibold text-app-text">Something went wrong</h1>
            <p className="mt-2 text-sm text-app-muted">
              {quotaExceeded
                ? 'Browser storage is full. Your data is still saved in Firebase — reload after the fix deploys, or run sheetflowClearStorageBloat() in the browser console.'
                : this.state.error.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600"
            >
              Reload page
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
