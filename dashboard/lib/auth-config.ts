import { PrismaAdapter } from '@auth/prisma-adapter';
import DiscordProvider from 'next-auth/providers/discord';
import { prisma } from './prisma';
import { JWT } from 'next-auth/jwt';
import { Session } from 'next-auth';

// Type for the permissions data from the bot API
interface PermissionsData {
  botOwnerId: string;
  admins: Array<{
    id: string;
    discordId: string | null;
    name: string | null;
    email: string | null;
    role: number;
    isAdmin: boolean;
    isBlocked: boolean;
  }>;
  moderators: Array<{
    id: string;
    discordId: string | null;
    name: string | null;
    email: string | null;
    role: number;
    isAdmin: boolean;
    isBlocked: boolean;
  }>;
}

// Function to fetch user permissions from the bot API
async function fetchUserPermissions(discordId: string): Promise<{ isAdmin: boolean; role: number }> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_BOT_API_URL || 'http://localhost:3001'}/api/permissions`);
    if (!response.ok) {
      console.error('Failed to fetch permissions:', await response.text());
      return { isAdmin: false, role: 0 }; // Default to regular user if we can't fetch permissions
    }
    
    const data: PermissionsData = await response.json();
    
    // Check if user is the bot owner
    if (discordId === data.botOwnerId) {
      return { isAdmin: true, role: 3 }; // Owner role
    }
    
    // Check if user is an admin
    const admin = data.admins.find(admin => admin.discordId === discordId);
    if (admin) {
      return { isAdmin: true, role: admin.role };
    }
    
    // Check if user is a moderator
    const moderator = data.moderators.find(mod => mod.discordId === discordId);
    if (moderator) {
      return { isAdmin: false, role: moderator.role };
    }
    
    // Default to regular user
    return { isAdmin: false, role: 0 };
  } catch (error) {
    console.error('Error fetching user permissions:', error);
    return { isAdmin: false, role: 0 }; // Default to regular user on error
  }
}


// Extend the session type to include our custom fields
declare module 'next-auth' {
  interface Session {
    accessToken?: string;
    error?: 'RefreshAccessTokenError';
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      isAdmin?: boolean;
      isBlocked?: boolean;
      discordId?: string | null;
      role?: number;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    accessToken?: string;
    accessTokenExpires?: number;
    refreshToken?: string;
    user?: {
      id: string;
      isAdmin: boolean;
      isBlocked: boolean;
      role: number;
    };
    error?: 'RefreshAccessTokenError';
  }
}

export const authConfig = {
  adapter: PrismaAdapter(prisma),
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID as string,
      clientSecret: process.env.DISCORD_CLIENT_SECRET as string,
      allowDangerousEmailAccountLinking: true, // Allow linking accounts with same email
      authorization: {
        params: {
          scope: 'identify email guilds',
          prompt: 'consent',
          access_type: 'offline',
          response_type: 'code',
        },
      },
      async profile(profile, tokens) {
        // Ensure we have the Discord ID
        const discordId = profile.id;
        if (!discordId) {
          throw new Error('No Discord ID found in profile');
        }

        try {
          // Try to find an existing account with this Discord ID
          let existingAccount = await prisma.account.findFirst({
            where: {
              provider: 'discord',
              providerAccountId: discordId,
            },
            include: {
              user: true,
            },
          });

          // If account exists, return the user
          if (existingAccount) {
            return {
              id: existingAccount.user.id,
              name: profile.username || existingAccount.user.name,
              email: profile.email || existingAccount.user.email,
              image: profile.avatar
                ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
                : existingAccount.user.image,
              isAdmin: existingAccount.user.isAdmin,
              isBlocked: existingAccount.user.isBlocked,
            };
          }

          // If no account found, check if a user with this email exists
          if (profile.email) {
            const existingUser = await prisma.user.findUnique({
              where: { email: profile.email },
            });

            // If user exists, link the Discord account
            if (existingUser) {
              await prisma.account.create({
                data: {
                  userId: existingUser.id,
                  type: 'oauth',
                  provider: 'discord',
                  providerAccountId: discordId,
                  refresh_token: tokens.refresh_token as string,
                  access_token: tokens.access_token as string,
                  expires_at: Math.floor(Date.now() / 1000) + (tokens.expires_in as number || 604800),
                  token_type: tokens.token_type as string,
                  scope: tokens.scope as string,
                },
              });

              return {
                id: existingUser.id,
                name: profile.username || existingUser.name,
                email: existingUser.email,
                image: profile.avatar
                  ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
                  : existingUser.image,
                isAdmin: existingUser.isAdmin,
                isBlocked: existingUser.isBlocked,
              };
            }
          }

          // Fetch user permissions from the bot API
          const { isAdmin, role } = await fetchUserPermissions(discordId);
          
          // Create new user with Discord ID and permissions
          const newUser = await prisma.user.create({
            data: {
              name: profile.username,
              email: profile.email,
              discordId: discordId, // Store Discord ID in user table
              image: profile.avatar
                ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
                : null,
              isAdmin,
              role,
              isBlocked: false,
              accounts: {
                create: {
                  type: 'oauth',
                  provider: 'discord',
                  providerAccountId: discordId,
                  refresh_token: tokens.refresh_token as string,
                  access_token: tokens.access_token as string,
                  expires_at: Math.floor(Date.now() / 1000) + (tokens.expires_in as number || 604800),
                  token_type: tokens.token_type as string,
                  scope: tokens.scope as string,
                },
              },
            },
          });


          return {
            id: newUser.id,
            name: profile.username,
            email: profile.email,
            image: profile.avatar
              ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
              : null,
            isAdmin: newUser.isAdmin,
            isBlocked: newUser.isBlocked,
            discordId: discordId,
          };
        } catch (error) {
          console.error('Error in Discord profile callback:', error);
          throw error;
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt' as const,
  },
  callbacks: {
    async jwt({ token, user, account, trigger }) {
      // Initial sign in
      if (account && user) {
        // Get the full user data including image, role, and discordId
        const fullUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            isAdmin: true,
            isBlocked: true,
            role: true,
            discordId: true,
          },
        });

        // Update the account with the tokens
        if (account.access_token && account.refresh_token) {
          await prisma.account.updateMany({
            where: {
              userId: user.id,
              provider: 'discord',
            },
            data: {
              access_token: account.access_token,
              refresh_token: account.refresh_token,
              expires_at: account.expires_at,
              token_type: account.token_type,
              scope: account.scope,
            },
          });
        }

        return {
          ...token,
          accessToken: account.access_token,
          accessTokenExpires: account.expires_at ? account.expires_at * 1000 : Date.now() + (account.expires_in as number) * 1000,
          refreshToken: account.refresh_token,
          user: {
            id: user.id,
            name: fullUser?.name || (user as any).name || null,
            email: fullUser?.email || (user as any).email || null,
            image: fullUser?.image || (user as any).image || null,
            isAdmin: fullUser?.isAdmin || (user as any).isAdmin || false,
            isBlocked: fullUser?.isBlocked || (user as any).isBlocked || false,
            role: fullUser?.role !== undefined ? fullUser.role : 0,
            discordId: fullUser?.discordId || null,
          },
        };
      }

      // Return previous token if the access token has not expired yet
      if (token.accessTokenExpires && Date.now() < token.accessTokenExpires) {
        return token;
      }

      // Access token has expired, try to update it
      return refreshAccessToken(token);
    },
    async session({ session, token, user }) {
      if (token) {
        // We have a user from the token (set in jwt callback)
        const dbUser = await prisma.user.findUnique({
          where: { id: token.user.id },
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            isAdmin: true,
            isBlocked: true,
            role: true,
            discordId: true,
            accounts: {
              where: { provider: 'discord' },
              select: { providerAccountId: true }
            }
          },
        });

        if (dbUser) {
          session.user = {
            id: dbUser.id,
            name: dbUser.name,
            email: dbUser.email,
            image: dbUser.image,
            isAdmin: dbUser.isAdmin,
            isBlocked: dbUser.isBlocked,
            role: dbUser.role !== undefined ? dbUser.role : 0,
            discordId: dbUser.discordId || dbUser.accounts[0]?.providerAccountId || null
          };
        } else {
          // Fallback to token data if user not found
          session.user = {
            ...session.user,
            id: token.user?.id || token.sub!,
            isAdmin: token.user?.isAdmin || false,
            isBlocked: token.user?.isBlocked || false,
          };
        }

        // Add access token to session
        if (token.accessToken) {
          session.accessToken = token.accessToken as string;
        }
        
        // Add error if present
        if (token.error) {
          session.error = token.error as 'RefreshAccessTokenError';
        }
      }
      
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === 'development',
  pages: {
    signIn: '/login',
    error: '/error',
  },
};

async function refreshAccessToken(token: JWT) {
  try {
    // Get the refresh token from the database to ensure it's up to date
    const account = await prisma.account.findFirst({
      where: {
        userId: token.user?.id || token.sub,
        provider: 'discord',
      },
      select: {
        refresh_token: true,
      },
    });

    if (!account?.refresh_token) {
      throw new Error('No refresh token found');
    }

    const url =
      'https://discord.com/api/oauth2/token?' +
      new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID!,
        client_secret: process.env.DISCORD_CLIENT_SECRET!,
        grant_type: 'refresh_token',
        refresh_token: account.refresh_token,
      });

    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      method: 'POST',
    });

    const refreshedTokens = await response.json();

    if (!response.ok) {
      console.error('Failed to refresh token:', refreshedTokens);
      throw new Error('Failed to refresh token');
    }

    // Update the account with the new tokens
    await prisma.account.updateMany({
      where: {
        userId: token.user?.id || token.sub,
        provider: 'discord',
      },
      data: {
        access_token: refreshedTokens.access_token,
        refresh_token: refreshedTokens.refresh_token || account.refresh_token,
        expires_at: Math.floor(Date.now() / 1000) + refreshedTokens.expires_in,
        token_type: refreshedTokens.token_type,
        scope: refreshedTokens.scope,
      },
    });

    return {
      ...token,
      accessToken: refreshedTokens.access_token,
      accessTokenExpires: Date.now() + refreshedTokens.expires_in * 1000,
      refreshToken: refreshedTokens.refresh_token || account.refresh_token, // Fall back to old refresh token
      error: undefined, // Clear any previous errors
    };
  } catch (error) {
    console.error('Error refreshing access token', error);
    
    // If we can't refresh the token, sign the user out
    if (token.user?.id || token.sub) {
      try {
        await prisma.account.deleteMany({
          where: {
            userId: token.user?.id || token.sub,
            provider: 'discord',
          },
        });
      } catch (e) {
        console.error('Error cleaning up invalid account', e);
      }
    }

    return {
      ...token,
      error: 'RefreshAccessTokenError',
    };
  }
}
