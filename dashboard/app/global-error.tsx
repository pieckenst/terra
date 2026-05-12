'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { reportError } from '@/components/global-error-handler';

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error
    console.error('[Global Error]:', error);

    // Determine error severity
    const message = error.message.toLowerCase();
    let severity: 'error' | 'warning' | 'info' = 'error';
    
    if (message.includes('rate limit') || message.includes('429')) {
      severity = 'warning';
    } else if (message.includes('timeout')) {
      severity = 'warning';
    }

    // Show toast notification with appropriate severity
    switch (severity as 'error' | 'warning' | 'info') {
      case 'warning':
        toast.warning('Critical Error', {
          description: error.message || 'A critical error occurred. Please reload the page.',
          duration: 5000,
        });
        break;
      case 'info':
        toast.info('Critical Error', {
          description: error.message || 'A critical error occurred. Please reload the page.',
        });
        break;
      case 'error':
      default:
        toast.error('Critical Error', {
          description: error.message || 'A critical error occurred. Please reload the page.',
          duration: Infinity,
        });
    }

    // Report to global error bus
    reportError(error.message || 'A critical error occurred', error.stack, error.digest, severity);
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-background text-foreground">
        <div className="flex min-h-screen items-center justify-center p-4">
          <div className="max-w-md w-full space-y-6 text-center">
            <div className="flex justify-center">
              <div className="rounded-full bg-destructive/10 p-4">
                <AlertTriangle className="h-16 w-16 text-destructive" />
              </div>
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-destructive">
                Critical Error
              </h1>
              <p className="text-muted-foreground">
                Something went wrong that prevented the page from loading.
              </p>
            </div>

            <button
              onClick={() => {
                reset();
                window.location.reload();
              }}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Reload Application
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
