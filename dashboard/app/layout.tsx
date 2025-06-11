import '../styles/globals.css';
import { Providers } from './providers';

export const metadata = {
  title: 'Terra Dashboard',
  description: 'Admin dashboard for Terra Discord bot'
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className="flex min-h-screen w-full flex-col bg-background text-foreground">
        <Providers
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <main className="flex-grow">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
