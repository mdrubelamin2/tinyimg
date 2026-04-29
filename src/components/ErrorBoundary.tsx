import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children?: ReactNode
  onError?: (error: Error, info: ErrorInfo) => void
}

interface State {
  hasError: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
  }

  public static getDerivedStateFromError(error: Error): State {
    void error
    return { hasError: true }
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.props.onError?.(error, errorInfo)
    console.error('Uncaught error:', error, errorInfo)
  }

  public override render() {
    if (this.state.hasError) {
      return (
        <div className='glass border-destructive/30 bg-destructive/10 text-foreground rounded-3xl border p-8 text-center'>
          <h2 className='text-destructive text-xl font-bold'>Something went wrong.</h2>
          <p className='text-muted-foreground mt-2'>
            The application encountered an unexpected error. Please refresh.
          </p>
          <button
            className='btn-primary mt-4'
            onClick={() => globalThis.location.reload()}
          >
            Refresh App
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
