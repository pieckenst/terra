import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export const middleware = auth((request) => {
  // The `auth` middleware provides the session as `request.auth`.
  // The matcher in `config` already excludes static assets and API routes.

  // Redirect to login page disabled for now
  // if (!request.auth) {
  //   const url = request.nextUrl.clone();
  //   url.pathname = '/login';
  //   return NextResponse.redirect(url);
  // }

  // Allow the request to continue
  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)']
};

