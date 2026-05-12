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

// Discord profile type from API
interface DiscordProfile {
  id: string; // Discord snowflake
  username: string;
  avatar: string | null;
  discriminator: string;
  global_name: string | null;
  email: string | null;
  verified: boolean | null;
  premium_type: number | null;
  locale: string | null;
  mfa_enabled: boolean | null;
  flags: number | null;
  public_flags: number | null;
}

// Discord token response type
interface DiscordTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

// Logger utility for auth operations
const authLogger = {
  info: (message: string, data?: Record<string, unknown>) => {
    console.log(`[AUTH][INFO] ${message}`, data ? JSON.stringify(data, null, 2) : '');
  },
  warn: (message: string, data?: Record<string, unknown>) => {
    console.warn(`[AUTH][WARN] ${message}`, data ? JSON.stringify(data, null, 2) : '');
  },
  error: (message: string, error?: unknown, data?: Record<string, unknown>) => {
    console.error(`[AUTH][ERROR] ${message}`, {
      error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
      ...data
    });
  },
  debug: (message: string, data?: Record<string, unknown>) => {
    if (process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_DEBUG === 'true') {
      console.log(`[AUTH][DEBUG] ${message}`, data ? JSON.stringify(data, null, 2) : '');
    }
  },
};

// Function to fetch user permissions from the bot API
async function fetchUserPermissions(discordId: string): Promise<{ isAdmin: boolean; role: number }> {
  const startTime = Date.now();
  try {
    authLogger.debug('Fetching user permissions', { discordId });
    
    const response = await fetch(`${process.env.NEXT_PUBLIC_BOT_API_URL || 'http://localhost:3001'}/api/permissions`, {
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      authLogger.warn('Failed to fetch permissions from bot API', { 
        status: response.status, 
        error: errorText,
        discordId 
      });
      return { isAdmin: false, role: 0 };
    }
    
    const data: PermissionsData = await response.json();
    
    // Check if user is the bot owner
    if (discordId === data.botOwnerId) {
      authLogger.debug('User is bot owner', { discordId });
      return { isAdmin: true, role: 3 }; // Owner role
    }
    
    // Check if user is an admin
    const admin = data.admins.find(admin => admin.discordId === discordId);
    if (admin) {
      authLogger.debug('User is admin', { discordId, role: admin.role });
      return { isAdmin: true, role: admin.role };
    }
    
    // Check if user is a moderator
    const moderator = data.moderators.find(mod => mod.discordId === discordId);
    if (moderator) {
      authLogger.debug('User is moderator', { discordId, role: moderator.role });
      return { isAdmin: false, role: moderator.role };
    }
    
    authLogger.debug('User is regular user', { discordId, duration: Date.now() - startTime });
    return { isAdmin: false, role: 0 };
  } catch (error) {
    authLogger.error('Error fetching user permissions', error, { discordId, duration: Date.now() - startTime });
    return { isAdmin: false, role: 0 };
  }
}

// Helper to construct Discord avatar URL
function getDiscordAvatarUrl(discordId: string, avatarHash: string | null, discriminator: string = '0'): string {
  if (avatarHash) {
    const isAnimated = avatarHash.startsWith('a_');
    const format = isAnimated ? 'gif' : 'png';
    return `https://cdn.discordapp.com/avatars/${discordId}/${avatarHash}.${format}?size=256`;
  }
  
  // Fallback to default Discord avatar
  const avatarIndex = discriminator === '0' 
    ? (BigInt(discordId) >> BigInt(22)) % BigInt(6)
    : parseInt(discriminator) % 5;
  return `https://cdn.discordapp.com/embed/avatars/${avatarIndex}.png?size=256`;
}

// Validate that a string is a valid Discord snowflake ID
function isValidDiscordSnowflake(id: string): boolean {
  // Discord snowflakes are numeric strings between 17-19 characters
  // They must be valid integers and represent a timestamp after Discord's epoch
  if (!id || typeof id !== 'string') return false;
  if (!/^\d{17,19}$/.test(id)) return false;
  
  try {
    const snowflake = BigInt(id);
    // Discord epoch is 2015-01-01 (1420070400000)
    // Snowflake timestamp is (snowflake >> 22) + 1420070400000
    const timestamp = Number((snowflake >> BigInt(22))) + 1420070400000;
    // Must be after Discord's epoch and before 50 years in the future
    const now = Date.now();
    const maxFuture = now + (50 * 365 * 24 * 60 * 60 * 1000);
    return timestamp >= 1420070400000 && timestamp < maxFuture;
  } catch {
    return false;
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
      discordId?: string | null;
    };
    error?: 'RefreshAccessTokenError';
  }
}

export const authConfig = {
  // Don't use PrismaAdapter - we handle user/account creation manually in the profile callback
  // adapter: PrismaAdapter(prisma),
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID as string,
      clientSecret: process.env.DISCORD_CLIENT_SECRET as string,
      allowDangerousEmailAccountLinking: true, // Allow linking accounts with same email
      authorization: {
        params: {
          scope: 'identify email guilds guilds.members.read',
          prompt: 'consent', // Required to get refresh token from Discord
        },
      },
      async profile(profile: DiscordProfile, tokens: DiscordTokens) {
        const operationId = `profile-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const startTime = Date.now();
        
        authLogger.info(`[${operationId}] Starting profile callback`, {
          discordId: profile.id,
          username: profile.username,
          hasEmail: !!profile.email,
          hasAccessToken: !!tokens.access_token,
          hasRefreshToken: !!tokens.refresh_token,
        });

        // CRITICAL: Validate the Discord ID
        const discordId = profile.id;
        if (!discordId) {
          authLogger.error(`[${operationId}] No Discord ID in profile`, { profile });
          throw new Error('No Discord ID found in profile');
        }

        // Validate Discord snowflake format
        if (!isValidDiscordSnowflake(discordId)) {
          authLogger.error(`[${operationId}] Invalid Discord snowflake`, { discordId, profile });
          throw new Error(`Invalid Discord ID format: ${discordId}`);
        }

        authLogger.debug(`[${operationId}] Discord ID validated`, { discordId });

        // Validate tokens
        if (!tokens.access_token) {
          authLogger.error(`[${operationId}] No access token received from Discord`);
          throw new Error('No access token received from Discord');
        }

        try {
          // Use a transaction for atomic operations
          const result = await prisma.$transaction(async (tx) => {
            // Step 1: Try to find existing account by Discord snowflake
            authLogger.debug(`[${operationId}] Searching for existing account`, { discordId });
            
            const existingAccount = await tx.account.findUnique({
              where: {
                provider_providerAccountId: {
                  provider: 'discord',
                  providerAccountId: discordId, // MUST be the Discord snowflake
                },
              },
              include: {
                user: true,
              },
            });

            if (existingAccount) {
              authLogger.info(`[${operationId}] Found existing account`, {
                userId: existingAccount.user.id,
                discordId: existingAccount.providerAccountId,
                userName: existingAccount.user.name,
              });

              // Update the account with new tokens
              await tx.account.update({
                where: {
                  id: existingAccount.id,
                },
                data: {
                  access_token: tokens.access_token,
                  refresh_token: tokens.refresh_token,
                  expires_at: Math.floor(Date.now() / 1000) + (tokens.expires_in || 604800),
                  token_type: tokens.token_type,
                  scope: tokens.scope,
                },
              });

              // Update user info if needed
              const avatarUrl = getDiscordAvatarUrl(discordId, profile.avatar, profile.discriminator);
              
              await tx.user.update({
                where: { id: existingAccount.user.id },
                data: {
                  name: profile.username || existingAccount.user.name,
                  email: profile.email || existingAccount.user.email,
                  image: avatarUrl,
                  discordId: discordId, // Ensure discordId is set on user
                },
              });

              return {
                id: existingAccount.user.id,
                name: profile.username || existingAccount.user.name,
                email: profile.email || existingAccount.user.email,
                image: avatarUrl,
                isAdmin: existingAccount.user.isAdmin,
                isBlocked: existingAccount.user.isBlocked,
                discordId: discordId,
              };
            }

            // Step 2: No existing account - check for existing user by email
            authLogger.debug(`[${operationId}] No existing account, checking by email`, { 
              email: profile.email 
            });

            if (profile.email) {
              const existingUser = await tx.user.findUnique({
                where: { email: profile.email },
                include: {
                  accounts: {
                    where: { provider: 'discord' },
                  },
                },
              });

              if (existingUser) {
                authLogger.info(`[${operationId}] Found existing user by email`, {
                  userId: existingUser.id,
                  existingDiscordId: existingUser.discordId,
                  hasDiscordAccount: existingUser.accounts.length > 0,
                });

                // Check if user already has a Discord account linked
                if (existingUser.accounts.length > 0) {
                  // Update existing Discord account
                  await tx.account.update({
                    where: { id: existingUser.accounts[0].id },
                    data: {
                      providerAccountId: discordId, // Update to correct Discord ID
                      access_token: tokens.access_token,
                      refresh_token: tokens.refresh_token,
                      expires_at: Math.floor(Date.now() / 1000) + (tokens.expires_in || 604800),
                      token_type: tokens.token_type,
                      scope: tokens.scope,
                    },
                  });
                } else {
                  // Create new Discord account for existing user
                  await tx.account.create({
                    data: {
                      userId: existingUser.id,
                      type: 'oauth',
                      provider: 'discord',
                      providerAccountId: discordId, // MUST be the Discord snowflake
                      refresh_token: tokens.refresh_token,
                      access_token: tokens.access_token,
                      expires_at: Math.floor(Date.now() / 1000) + (tokens.expires_in || 604800),
                      token_type: tokens.token_type,
                      scope: tokens.scope,
                    },
                  });
                }

                // Update user with Discord ID
                const avatarUrl = getDiscordAvatarUrl(discordId, profile.avatar, profile.discriminator);
                await tx.user.update({
                  where: { id: existingUser.id },
                  data: {
                    name: profile.username || existingUser.name,
                    image: avatarUrl,
                    discordId: discordId,
                  },
                });

                return {
                  id: existingUser.id,
                  name: profile.username || existingUser.name,
                  email: existingUser.email,
                  image: avatarUrl,
                  isAdmin: existingUser.isAdmin,
                  isBlocked: existingUser.isBlocked,
                  discordId: discordId,
                };
              }
            }

            // Step 3: No existing user - create new user and account
            authLogger.info(`[${operationId}] Creating new user and account`, { 
              discordId, 
              username: profile.username 
            });

            // Fetch permissions for new user
            const { isAdmin, role } = await fetchUserPermissions(discordId);
            
            const avatarUrl = getDiscordAvatarUrl(discordId, profile.avatar, profile.discriminator);
            
            const newUser = await tx.user.create({
              data: {
                name: profile.username,
                email: profile.email,
                discordId: discordId, // Store Discord snowflake in user table
                image: avatarUrl,
                isAdmin,
                role,
                isBlocked: false,
                accounts: {
                  create: {
                    type: 'oauth',
                    provider: 'discord',
                    providerAccountId: discordId, // MUST be the Discord snowflake
                    refresh_token: tokens.refresh_token,
                    access_token: tokens.access_token,
                    expires_at: Math.floor(Date.now() / 1000) + (tokens.expires_in || 604800),
                    token_type: tokens.token_type,
                    scope: tokens.scope,
                  },
                },
              },
            });

            authLogger.info(`[${operationId}] Created new user`, {
              userId: newUser.id,
              discordId: newUser.discordId,
              isAdmin: newUser.isAdmin,
              role: newUser.role,
            });

            return {
              id: newUser.id,
              name: profile.username,
              email: profile.email,
              image: avatarUrl,
              isAdmin: newUser.isAdmin,
              isBlocked: newUser.isBlocked,
              discordId: discordId,
            };
          }, {
            maxWait: 5000, // Maximum time to wait for transaction to start
            timeout: 10000, // Maximum time transaction can run
          });

          authLogger.info(`[${operationId}] Profile callback completed`, {
            userId: result.id,
            discordId: result.discordId,
            duration: Date.now() - startTime,
          });

          return result;
        } catch (error) {
          authLogger.error(`[${operationId}] Error in profile callback`, error, {
            discordId,
            duration: Date.now() - startTime,
          });
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
      const operationId = `jwt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Initial sign in
      if (account && user) {
        authLogger.debug(`[${operationId}] JWT callback - initial sign in`, {
          userId: user.id,
          provider: account.provider,
          hasAccessToken: !!account.access_token,
        });

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
            accounts: {
              where: { provider: 'discord' },
              select: {
                providerAccountId: true,
                access_token: true,
                refresh_token: true,
              },
            },
          },
        });

        if (!fullUser) {
          authLogger.error(`[${operationId}] User not found in database after profile callback`, {
            userId: user.id,
          });
          throw new Error('User not found after authentication');
        }

        // Validate that we have the correct Discord ID
        const discordAccount = fullUser.accounts[0];
        if (discordAccount && !isValidDiscordSnowflake(discordAccount.providerAccountId)) {
          authLogger.error(`[${operationId}] Invalid providerAccountId in database`, {
            providerAccountId: discordAccount.providerAccountId,
            userId: fullUser.id,
          });
          // This shouldn't happen, but we'll try to recover
        }

        // Update the account with the tokens if we have them from the initial auth
        if (account.access_token && account.refresh_token) {
          try {
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
          } catch (error) {
            authLogger.warn(`[${operationId}] Failed to update tokens in JWT callback`, { error });
            // Continue - the tokens from profile callback should be there
          }
        }

        const result = {
          ...token,
          accessToken: account.access_token || discordAccount?.access_token,
          accessTokenExpires: account.expires_at ? account.expires_at * 1000 : Date.now() + (account.expires_in || 604800) * 1000,
          refreshToken: account.refresh_token || discordAccount?.refresh_token,
          user: {
            id: user.id,
            name: fullUser.name,
            email: fullUser.email,
            image: fullUser.image,
            isAdmin: fullUser.isAdmin,
            isBlocked: fullUser.isBlocked,
            role: fullUser.role !== undefined ? fullUser.role : 0,
            discordId: fullUser.discordId || discordAccount?.providerAccountId || null,
          },
        };

        authLogger.debug(`[${operationId}] JWT token created`, {
          userId: user.id,
          discordId: result.user?.discordId,
        });

        return result;
      }

      // Return previous token if the access token has not expired yet
      if (token.accessTokenExpires && Date.now() < token.accessTokenExpires - 60000) {
        return token;
      }

      // Access token has expired, try to update it
      authLogger.debug(`[${operationId}] Access token expired, refreshing`);
      return refreshAccessToken(token, operationId);
    },
    async session({ session, token }) {
      const operationId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      if (token?.user?.id) {
        authLogger.debug(`[${operationId}] Session callback`, {
          userId: token.user.id,
          discordId: token.user.discordId,
        });

        // Fetch fresh user data from database
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
              select: { 
                providerAccountId: true,
                access_token: true,
              }
            }
          },
        });

        if (dbUser) {
          // Use the discordId from user table first, then from account
          const userDiscordId = dbUser.discordId || dbUser.accounts[0]?.providerAccountId || null;
          
          // Validate the Discord ID
          if (userDiscordId && !isValidDiscordSnowflake(userDiscordId)) {
            authLogger.warn(`[${operationId}] Invalid Discord ID in session`, { 
              userDiscordId,
              userId: dbUser.id 
            });
          }

          session.user = {
            id: dbUser.id,
            name: dbUser.name,
            email: dbUser.email,
            image: dbUser.image,
            isAdmin: dbUser.isAdmin,
            isBlocked: dbUser.isBlocked,
            role: dbUser.role !== undefined ? dbUser.role : 0,
            discordId: userDiscordId,
          };

          authLogger.debug(`[${operationId}] Session populated from database`, {
            userId: dbUser.id,
            discordId: userDiscordId,
            isAdmin: dbUser.isAdmin,
          });
        } else {
          // Fallback to token data if user not found in database
          authLogger.warn(`[${operationId}] User not found in database, using token data`);
          session.user = {
            ...session.user,
            id: token.user.id,
            isAdmin: token.user.isAdmin || false,
            isBlocked: token.user.isBlocked || false,
            discordId: token.user.discordId || null,
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

async function refreshAccessToken(token: JWT, operationId?: string): Promise<JWT> {
  const opId = operationId || `refresh-${Date.now()}`;
  
  authLogger.debug(`[${opId}] Starting token refresh`, {
    userId: token.user?.id || token.sub,
  });
  
  try {
    // Get the refresh token from the database to ensure it's up to date
    const account = await prisma.account.findFirst({
      where: {
        userId: token.user?.id || token.sub,
        provider: 'discord',
      },
      select: {
        id: true,
        refresh_token: true,
        access_token: true,
        expires_at: true,
        providerAccountId: true,
      },
    });

    if (!account?.refresh_token) {
      authLogger.warn(`[${opId}] No refresh token found for user`);
      return {
        ...token,
        error: 'RefreshAccessTokenError' as const,
      };
    }

    authLogger.debug(`[${opId}] Making token refresh request to Discord`);
    
    // Discord requires form-urlencoded body
    const params = new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID!,
      client_secret: process.env.DISCORD_CLIENT_SECRET!,
      grant_type: 'refresh_token',
      refresh_token: account.refresh_token,
    });

    const response = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    const refreshedTokens = await response.json();

    if (!response.ok) {
      authLogger.error(`[${opId}] Token refresh failed`, {
        status: response.status,
        error: refreshedTokens.error || refreshedTokens.message,
      });
      
      // Check for specific error types
      if (response.status === 400 && refreshedTokens.error === 'invalid_grant') {
        authLogger.warn(`[${opId}] Refresh token is invalid, user needs to re-authenticate`);
        
        // Clear the invalid tokens
        try {
          await prisma.account.update({
            where: { id: account.id },
            data: {
              access_token: null,
              refresh_token: null,
              expires_at: null,
            },
          });
        } catch (error) {
          authLogger.error(`[${opId}] Failed to clear invalid tokens`, error);
        }
      }
      
      return {
        ...token,
        error: 'RefreshAccessTokenError' as const,
      };
    }

    authLogger.info(`[${opId}] Token refresh successful`);
    
    // Update the account with the new tokens
    await prisma.account.update({
      where: { id: account.id },
      data: {
        access_token: refreshedTokens.access_token,
        refresh_token: refreshedTokens.refresh_token || account.refresh_token,
        expires_at: Math.floor(Date.now() / 1000) + (refreshedTokens.expires_in || 604800),
        token_type: refreshedTokens.token_type,
        scope: refreshedTokens.scope,
      },
    });

    return {
      ...token,
      accessToken: refreshedTokens.access_token,
      accessTokenExpires: Date.now() + (refreshedTokens.expires_in || 604800) * 1000,
      refreshToken: refreshedTokens.refresh_token || account.refresh_token,
      error: undefined,
    };
  } catch (error) {
    authLogger.error(`[${opId}] Error refreshing access token`, error);
    return {
      ...token,
      error: 'RefreshAccessTokenError' as const,
    };
  }
}
