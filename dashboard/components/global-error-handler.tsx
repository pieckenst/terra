'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';
import { Component, type ReactNode } from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

// Global error event bus for programmatic error reporting
type ErrorEvent = {
  message: string;
  details?: string;
  code?: string | number;
  severity?: 'error' | 'warning' | 'info';
  error?: Error;
  silent?: boolean; // If true, don't show toast notifications
};

type ErrorListener = (event: ErrorEvent) => void;

const errorListeners: Set<ErrorListener> = new Set();

// Track recently shown errors to prevent toast spam
const recentErrors = new Map<string, number>();
const ERROR_DEBOUNCE_MS = 5000; // 5 seconds

const getErrorKey = (event: ErrorEvent): string => {
  // Include more context to make the key more specific
  // This prevents different errors with the same message from being deduplicated
  const detailsKey = event.details ? event.details.substring(0, 50) : '';
  return `${event.message}-${event.code || ''}-${event.severity || 'error'}-${detailsKey}`;
};

export const errorBus = {
  emit: (event: ErrorEvent) => {
    errorListeners.forEach(listener => listener(event));
  },
  subscribe: (listener: ErrorListener) => {
    errorListeners.add(listener);
    return () => errorListeners.delete(listener);
  }
};

// Utility function to report errors from anywhere in the app
export function reportError(
  message: string, 
  details?: string, 
  code?: string | number,
  severity: 'error' | 'warning' | 'info' = 'error',
  silent: boolean = false
) {
  const event: ErrorEvent = { message, details, code, severity, silent };
  const errorKey = getErrorKey(event);
  const now = Date.now();
  
  // Check if this error was recently shown
  const lastShown = recentErrors.get(errorKey);
  if (lastShown && now - lastShown < ERROR_DEBOUNCE_MS) {
    console.log(`[Error Handler] Debouncing duplicate error: ${message}`);
    return; // Skip showing this error
  }
  
  // Record this error as shown (even if silent, to prevent spam)
  recentErrors.set(errorKey, now);
  
  // Clean up old entries periodically
  if (recentErrors.size > 100) {
    const cutoff = now - ERROR_DEBOUNCE_MS;
    recentErrors.forEach((timestamp, key) => {
      if (timestamp < cutoff) {
        recentErrors.delete(key);
      }
    });
  }
  
  errorBus.emit(event);
}

// Error Boundary Component for catching React errors
export class GlobalErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Global Error Boundary caught an error:', error, errorInfo);
    
    // Show toast notification
    toast.error('Application Error', {
      description: error.message || 'An unexpected error occurred',
      action: {
        label: 'Reload',
        onClick: () => window.location.reload()
      }
    });

    // Report to error tracking service if available
    if (process.env.NODE_ENV === 'production') {
      // Add your error tracking service here (e.g., Sentry, LogRocket, etc.)
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex min-h-[400px] w-full flex-col items-center justify-center p-8 text-center">
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6">
            <h2 className="text-lg font-semibold text-destructive mb-2">
              Something went wrong
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook for handling errors in components
export function useErrorHandler() {
  const handleError = (error: unknown, context?: string, silent: boolean = false) => {
    let message = 'An unexpected error occurred';
    let details: string | undefined;

    if (error instanceof Error) {
      message = error.message;
      details = error.stack;
    } else if (typeof error === 'string') {
      message = error;
    } else if (typeof error === 'object' && error !== null) {
      const errorObj = error as Record<string, unknown>;
      message = String(errorObj.message || errorObj.error || 'Unknown error');
      details = errorObj.details ? String(errorObj.details) : undefined;
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error(`[${context || 'Error'}]:`, error);
    }

    // Emit to global error bus (this will handle toast debouncing)
    reportError(message, details, undefined, 'error', silent);
  };

  const handleApiError = (error: unknown, endpoint?: string, silent: boolean = false) => {
    let message = 'API request failed';
    let code: string | number | undefined;
    let details: string | undefined;
    let severity: 'error' | 'warning' | 'info' = 'error';

    if (error instanceof Response || (typeof error === 'object' && error !== null && 'status' in error)) {
      const response = error as Response;
      code = response.status;
      
      // Handle specific HTTP status codes
      if (response.status === 429) {
        severity = 'warning';
        message = 'Rate limit exceeded. Please wait a moment and try again.';
        details = 'The bot API is rate limiting requests. This is temporary.';
      } else if (response.status === 401) {
        message = 'Authentication required. Please log in again.';
      } else if (response.status === 403) {
        message = 'Permission denied. You do not have access to this resource.';
      } else if (response.status === 404) {
        message = 'Resource not found.';
        severity = 'warning';
      } else if (response.status >= 500) {
        message = 'Server error. Please try again later.';
      }
      
      // Try to parse error response for more details
      if ('json' in response && typeof response.json === 'function') {
        response.json().then((data: Record<string, unknown>) => {
          const serverMessage = String(data.message || data.error || '');
          if (serverMessage && serverMessage !== message) {
            message = serverMessage;
          }
          if (data.details) {
            details = String(data.details);
          }
          
          // Emit to global error bus (this will handle toast debouncing)
          reportError(message, details, code, severity, silent);
        }).catch(() => {
          // Emit to global error bus (this will handle toast debouncing)
          reportError(message, undefined, code, severity, silent);
        });
        return;
      }
    } else if (error instanceof Error) {
      message = error.message;
      details = error.stack;
      
      // Check for rate limit error in error message
      if (message.toLowerCase().includes('rate limit') || message.toLowerCase().includes('429')) {
        severity = 'warning';
        message = 'Rate limit exceeded. Please wait a moment and try again.';
      }
    } else if (typeof error === 'string') {
      message = error;
      
      // Check for rate limit error in string
      if (message.toLowerCase().includes('rate limit') || message.toLowerCase().includes('429')) {
        severity = 'warning';
      }
    }

    // Emit to global error bus (this will handle toast debouncing)
    reportError(message, details, code, severity, silent);
  };

  return { handleError, handleApiError };
}

// Global error handler wrapper component
export function GlobalErrorHandler({ children }: { children: ReactNode }) {
  useEffect(() => {
    // Handle unhandled promise rejections
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('Unhandled promise rejection:', event.reason);
      
      const error = event.reason;
      let message = 'An unexpected error occurred';
      let details: string | undefined;

      if (error instanceof Error) {
        message = error.message;
        details = error.stack;
      } else if (typeof error === 'string') {
        message = error;
      } else if (typeof error === 'object' && error !== null) {
        const errorObj = error as Record<string, unknown>;
        message = String(errorObj.message || errorObj.error || 'Unknown error');
      }

      reportError(message, details, undefined, 'error');
    };

    // Handle uncaught errors
    const handleUnhandledError = (event: ErrorEvent) => {
      console.error('Uncaught error:', event.error);
      
      reportError(
        event.error?.message || event.message,
        event.error?.stack,
        undefined,
        'error'
      );
    };

    // Subscribe to programmatic error events
    const unsubscribe = errorBus.subscribe((event) => {
      const { message, details, severity = 'error', silent } = event;
      
      // Don't show toast if error is marked as silent
      if (silent) {
        // Log to console in development even for silent errors
        if (process.env.NODE_ENV === 'development') {
          console.log(`[Global Error Handler] Silent ${severity.toUpperCase()}: ${message}`, details || '');
        }
        return;
      }
      
      // Show toast notification (debouncing is handled in reportError)
      switch (severity) {
        case 'error':
          toast.error('Error', { description: message });
          break;
        case 'warning':
          toast.warning('Warning', { description: message, duration: 5000 });
          break;
        case 'info':
          toast.info('Info', { description: message });
          break;
      }

      // Log to console in development
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Global Error Handler] ${severity.toUpperCase()}: ${message}`, details || '');
      }
    });

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleUnhandledError);

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleUnhandledError);
      unsubscribe();
    };
  }, []);

  return <GlobalErrorBoundary>{children}</GlobalErrorBoundary>;
}
