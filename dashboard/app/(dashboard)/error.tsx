'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react';
import * as client from "react-dom/client";
import { reportError } from '@/components/global-error-handler';

export default function Error({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to console
    console.error('[Dashboard Error]:', error);

    // Determine error severity
    const message = error.message.toLowerCase();
    let severity: 'error' | 'warning' | 'info' = 'error';
    
    if (message.includes('rate limit') || message.includes('429')) {
      severity = 'warning';
    } else if (message.includes('timeout')) {
      severity = 'warning';
    } else if (message.includes('not found')) {
      severity = 'warning';
    }

    // Show toast notification with appropriate severity
    switch (severity as 'error' | 'warning' | 'info') {
      case 'warning':
        toast.warning('Application Error', {
          description: getErrorMessage(error),
          duration: 5000,
          action: {
            label: 'Report',
            onClick: () => {
              console.log('Error details:', {
                message: error.message,
                digest: error.digest,
                stack: error.stack,
              });
            }
          }
        });
        break;
      case 'info':
        toast.info('Application Error', {
          description: getErrorMessage(error),
          action: {
            label: 'Report',
            onClick: () => {
              console.log('Error details:', {
                message: error.message,
                digest: error.digest,
                stack: error.stack,
              });
            }
          }
        });
        break;
      case 'error':
      default:
        toast.error('Application Error', {
          description: getErrorMessage(error),
          duration: 10000,
          action: {
            label: 'Report',
            onClick: () => {
              console.log('Error details:', {
                message: error.message,
                digest: error.digest,
                stack: error.stack,
              });
            }
          }
        });
    }

    // Report to global error bus
    reportError(getErrorMessage(error), error.stack, error.digest, severity);
  }, [error]);

  function getErrorMessage(error: Error): string {
    const message = error.message.toLowerCase();

    if (message.includes('failed to load config')) {
      return 'Configuration error: Please check your config.json file.';
    }
    if (message.includes('token not found')) {
      return 'Authentication error: Please check your .env file for the token.';
    }
    if (message.includes('failed to start dashboard server')) {
      return 'Server error: Unable to start the dashboard server. Check your network settings.';
    }
    if (message.includes('api request failed') || message.includes('fetch failed')) {
      return 'API error: Unable to fetch data from the server. Please try again later.';
    }
    if (message.includes('eperm: operation not permitted')) {
      return 'Permission error: The application does not have sufficient permissions.';
    }
    if (message.includes('unauthorized')) {
      return 'Authentication required. Please log in to continue.';
    }
    if (message.includes('rate limit') || message.includes('429')) {
      return 'Rate limit exceeded. Please wait a moment and try again.';
    }
    if (message.includes('timeout')) {
      return 'Request timed out. Please check your connection and try again.';
    }
    
    return error.message || 'An unexpected error occurred.';
  }

  function handleReload() {
    window.location.reload();
  }

  function handleGoHome() {
    window.location.href = '/';
  }

  return (
    <main className="flex min-h-[50vh] items-center justify-center p-4 md:p-6 bg-background text-foreground">
      <div className="max-w-lg w-full space-y-6">
        {/* Error Icon */}
        <div className="flex justify-center">
          <div className="rounded-full bg-destructive/10 p-4">
            <AlertTriangle className="h-12 w-12 text-destructive" />
          </div>
        </div>

        {/* Error Message */}
        <div className="text-center space-y-2">
          <h1 className="font-semibold text-xl md:text-2xl text-destructive">
            Something went wrong
          </h1>
          <p className="text-muted-foreground">
            We apologize for the inconvenience. Please try again.
          </p>
        </div>

        {/* Error Details (collapsible in development) */}
        {process.env.NODE_ENV === 'development' && (
          <details className="group">
            <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground flex items-center gap-2 justify-center">
              <Bug className="h-4 w-4" />
              View error details
            </summary>
            <pre className="mt-4 px-4 py-3 bg-muted text-muted-foreground rounded-lg overflow-auto text-xs">
              <code>{error.message}</code>
              {error.stack && (
                <div className="mt-2 text-xs opacity-70">
                  {error.stack.split('\n').slice(0, 5).join('\n')}
                </div>
              )}
            </pre>
          </details>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={reset} variant="default" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Try again
          </Button>
          <Button onClick={handleReload} variant="outline" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Reload page
          </Button>
          <Button onClick={handleGoHome} variant="ghost" className="gap-2">
            <Home className="h-4 w-4" />
            Go home
          </Button>
        </div>
      </div>
    </main>
  );
}
