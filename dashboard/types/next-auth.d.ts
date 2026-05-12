import NextAuth, { type DefaultSession, type User } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      isAdmin: boolean;
      isBlocked: boolean;
      discordId?: string | null;
      role?: number;
    } & DefaultSession['user'];
    accessToken?: string;
  }

  interface User {
    isAdmin: boolean;
    isBlocked: boolean;
    discordId?: string | null;
    role?: number;
  }
}
