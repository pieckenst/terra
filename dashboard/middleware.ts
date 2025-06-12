import { auth } from './lib/auth';
import { NextResponse } from 'next/server';
import { createLogger } from './debug';

const debug = createLogger('middleware');

export const runtime = 'nodejs';

// We need to export the middleware function directly, not as a result of auth()
// This is a workaround for the current Next.js middleware + auth.js integration
// Log request information
function logRequest(req: Request) {
  if (!debug.isEnabled()) return;
  
  const url = new URL(req.url);
  debug.debug(`${req.method} ${url.pathname}${url.search}`, {
    headers: Object.fromEntries(req.headers.entries()),
    nextUrl: {
      pathname: url.pathname,
      search: url.search,
      origin: url.origin,
    },
    timestamp: new Date().toISOString(),
  });
}

export default auth((req) => {
  // Log incoming request
  logRequest(req);
  
  // The `auth` middleware provides the session as `req.auth`
  // The matcher in `config` already excludes static assets and API routes
  
  // Redirect to login page disabled for now
  // if (!req.auth) {
  //   const url = req.nextUrl.clone();
  //   url.pathname = '/login';
  //   return NextResponse.redirect(url);
  // }
  
  // Allow the request to continue
  const response = NextResponse.next();
  
  // Log response
  debug.debug(`Response for ${req.method} ${req.nextUrl.pathname}`, {
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
  });
  
  return response;
});

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)']
};

