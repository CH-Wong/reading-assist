import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** Optional custom fallback UI. Defaults to a generic error message with retry. */
  fallback?: React.ReactNode;
  /** Called when an error is caught. Use for logging. */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * React Error Boundary that catches render errors and prevents
 * the entire component tree from unmounting.
 *
 * Shows a fallback UI with a "Try Again" button that remounts children.
 */
export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private retryKey = 0;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('[ReadingAssist] Render error caught by boundary:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  private handleRetry = (): void => {
    this.retryKey++;
    this.setState({ hasError: false, error: null });
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div style={{
          padding: '16px',
          margin: '8px',
          border: '1px solid #e0a458',
          borderRadius: '8px',
          backgroundColor: '#1e1e2e',
          color: '#cdd6f4',
          fontFamily: 'system-ui, sans-serif',
          fontSize: '13px',
          lineHeight: 1.5,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ fontSize: '18px' }}>⚠️</span>
            <strong>Something went wrong</strong>
          </div>
          <p style={{ color: '#a6adc8', margin: '0 0 12px 0' }}>
            The Reading Assist panel encountered an unexpected error and needs to recover.
          </p>
          <button
            onClick={this.handleRetry}
            style={{
              padding: '6px 16px',
              border: 'none',
              borderRadius: '4px',
              backgroundColor: '#89b4fa',
              color: '#1e1e2e',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '12px',
            }}
          >
            🔄 Try Again
          </button>
          <details style={{ marginTop: '8px' }}>
            <summary style={{ cursor: 'pointer', color: '#6c7086', fontSize: '11px' }}>
              Error details
            </summary>
            <pre style={{
              marginTop: '4px',
              padding: '8px',
              backgroundColor: '#11111b',
              borderRadius: '4px',
              fontSize: '11px',
              color: '#f38ba8',
              overflow: 'auto',
              maxHeight: '120px',
            }}>
              {this.state.error?.message ?? 'Unknown error'}
            </pre>
          </details>
        </div>
      );
    }

    // Key resets the tree on retry
    return React.createElement(
      React.Fragment,
      { key: this.retryKey },
      this.props.children
    );
  }
}
