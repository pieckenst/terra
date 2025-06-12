

import NextAuth from 'next-auth';
import { authConfig } from './auth-config';

const { handlers, signIn, signOut, auth } = NextAuth(authConfig);

// Export server actions
export { signIn, signOut, auth };

// Export handlers for API routes
export { handlers };