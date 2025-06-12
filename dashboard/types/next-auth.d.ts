import NextAuth, { type DefaultSession, type User } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      isAdmin: boolean;
      isBlocked: boolean;
    } & DefaultSession['user'];
  }

  interface User {
    isAdmin: boolean;
    isBlocked: boolean;
  }
}
