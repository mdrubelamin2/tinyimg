import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children?: ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(_error: Error): State { // eslint-disable-line @typescript-eslint/no-unused-vars
    return { hasError: true };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.props.onError?.(error, errorInfo);
    console.error('Uncaught error:', error, errorInfo);
  }

  public override render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 text-center glass rounded-3xl border border-destructive/30 bg-destructive/10 text-foreground">
          <h2 className="text-xl font-bold text-destructive">Something went wrong.</h2>
          <p className="text-muted-foreground mt-2">The application encountered an unexpected error. Please refresh.</p>
          <button 
            className="btn-primary mt-4"
            onClick={() => window.location.reload()}
          >
            Refresh App
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
