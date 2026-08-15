import React, { ReactNode, ErrorInfo, Component } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  declare props: ErrorBoundaryProps;
  declare state: ErrorBoundaryState;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
    
    // Log to localStorage for debugging
    if (typeof localStorage !== 'undefined') {
      const logs = JSON.parse(localStorage.getItem('livecall_errors') || '[]');
      logs.push({
        timestamp: new Date().toISOString(),
        error: error.toString(),
        stack: error.stack,
        info: errorInfo.componentStack,
      });
      localStorage.setItem('livecall_errors', JSON.stringify(logs.slice(-10)));
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            width: '100%',
            backgroundColor: '#0f172a',
            color: '#e2e8f0',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            padding: '20px',
            textAlign: 'center',
          }}
        >
          <div style={{ maxWidth: '500px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '16px' }}>⚠️ Error Loading App</h1>
            <p style={{ fontSize: '14px', marginBottom: '16px', color: '#cbd5e1' }}>
              Something went wrong while loading the application.
            </p>
            
            {this.state.error && (
              <details style={{ marginBottom: '24px', textAlign: 'left', padding: '12px', backgroundColor: '#1e293b', borderRadius: '8px', border: '1px solid #334155' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 'bold', marginBottom: '8px' }}>
                  Technical Details (Tap to expand)
                </summary>
                <pre
                  style={{
                    fontSize: '12px',
                    overflow: 'auto',
                    padding: '8px',
                    backgroundColor: '#0f172a',
                    borderRadius: '4px',
                    marginTop: '8px',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                    color: '#f87171',
                  }}
                >
                  {this.state.error.message}
                  {'\n\n'}
                  {this.state.error.stack}
                </pre>
              </details>
            )}
            
            <button
              onClick={() => {
                window.location.href = window.location.href;
              }}
              style={{
                padding: '12px 24px',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: 'bold',
                cursor: 'pointer',
              }}
            >
              Reload Page
            </button>
            
            <p style={{ marginTop: '16px', fontSize: '12px', color: '#94a3b8' }}>
              If the problem persists, check Safari Settings &gt; Advanced &gt; Web Inspector for console logs.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
