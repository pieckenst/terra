'use client';

import { SessionProvider } from 'next-auth/react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import type { ComponentProps } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { GlobalErrorHandler } from '@/components/global-error-handler';

type ThemeProviderProps = ComponentProps<typeof NextThemesProvider>;

export function Providers({ children, ...props }: ThemeProviderProps) {
  return (
    <SessionProvider>
      <NextThemesProvider {...props}>
        <GlobalErrorHandler>
          {children}
        </GlobalErrorHandler>
        <Toaster position="top-right" richColors closeButton />
      </NextThemesProvider>
    </SessionProvider>
  );
}
