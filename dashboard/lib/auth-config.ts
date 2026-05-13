import { PrismaAdapter } from '@auth/prisma-adapter';
import DiscordProvider from 'next-auth/providers/discord';
import { prisma } from './prisma';
import { JWT } from 'next-auth/jwt';

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
  id: string;
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

// Enhanced logger with colors and detailed output
const AUTH_PREFIX = '\x1b[35m[AUTH]\x1b[0m';
const SUCCESS_PREFIX = '\x1b[32m[AUTH]\x1b[0m';
const ERROR_PREFIX = '\x1b[31m[AUTH]\x1b[0m';
const WARN_PREFIX = '\x1b[33m[AUTH]\x1b[0m';
const DEBUG_PREFIX = '\x1b[36m[AUTH]\x1b[0m';

const authLog = {
  info: (message: string, data?: unknown) => {
    console.log(`${AUTH_PREFIX} ${message}`, data !== undefined ? JSON.stringify(data, null, 2) : '');
  },
  success: (message: string, data?: unknown) => {
    console.log(`${SUCCESS_PREFIX} ✓ ${message}`, data !== undefined ? JSON.stringify(data, null, 2) : '');
  },
  error: (message: string, error?: unknown, data?: unknown) => {
    console.error(`${ERROR_PREFIX} ✗ ${message}`);
    if (error) {
      if (error instanceof Error) {
        console.error(`${ERROR_PREFIX}   Error: ${error.message}`);
        if (error.stack) console.error(`${ERROR_PREFIX}   Stack: ${error.stack}`);
      } else {
        console.error(`${ERROR_PREFIX}   Error:`, error);
      }
    }
    if (data) console.error(`${ERROR_PREFIX}   Data:`, JSON.stringify(data, null, 2));
  },
  warn: (message: string, data?: unknown) => {
    console.warn(`${WARN_PREFIX} ⚠ ${message}`, data !== undefined ? JSON.stringify(data, null, 2) : '');
  },
  debug: (message: string, data?: unknown) => {
    if (process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_DEBUG === 'true') {
      console.log(`${DEBUG_PREFIX} [DEBUG] ${message}`, data !== undefined ? JSON.stringify(data, null, 2) : '');
    }
  },
  step: (stepNum: number, message: string, data?: unknown) => {
    console.log(`${AUTH_PREFIX} [Step ${stepNum}] ${message}`, data !== undefined ? JSON.stringify(data, null, 2) : '');
  },
  divider: (title: string) => {
    console.log(`\n${AUTH_PREFIX} ${'='.repeat(50)}`);
    console.log(`${AUTH_PREFIX} ${title}`);
    console.log(`${AUTH_PREFIX} ${'='.repeat(50)}`);
  },
};

// Function to fetch user permissions from the bot API
async function fetchUserPermissions(discordId: string): Promise<{ isAdmin: boolean; role: number }> {
  authLog.step(0, 'Fetching user permissions from bot API', { discordId });
  const startTime = Date.now();
  
  try {
    const botApiUrl = process.env.NEXT_PUBLIC_BOT_API_URL || 'http://localhost:3001';
    authLog.debug(`Calling bot API: ${botApiUrl}/api/permissions`);
    
    const response = await fetch(`${botApiUrl}/api/permissions`, {
      signal: AbortSignal.timeout(5000),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      authLog.warn('Bot API returned error, defaulting to regular user', { 
        status: response.status, 
        error: errorText,
        discordId 
      });
      return { isAdmin: false, role: 0 };
    }
    
    const data: PermissionsData = await response.json();
    authLog.debug('Bot API response received', { 
      botOwnerId: data.botOwnerId,
      adminCount: data.admins?.length || 0,
      moderatorCount: data.moderators?.length || 0,
    });
    
    // Check if user is the bot owner
    if (discordId === data.botOwnerId) {
      authLog.success('User is bot owner', { discordId, role: 3 });
      return { isAdmin: true, role: 3 };
    }
    
    // Check if user is an admin
    const admin = data.admins?.find(admin => admin.discordId === discordId);
    if (admin) {
      authLog.success('User is admin', { discordId, role: admin.role });
      return { isAdmin: true, role: admin.role };
    }
    
    // Check if user is a moderator
    const moderator = data.moderators?.find(mod => mod.discordId === discordId);
    if (moderator) {
      authLog.success('User is moderator', { discordId, role: moderator.role });
      return { isAdmin: false, role: moderator.role };
    }
    
    authLog.debug('User is regular user', { discordId, duration: Date.now() - startTime });
    return { isAdmin: false, role: 0 };
  } catch (error) {
    authLog.warn('Error fetching permissions, defaulting to regular user', { 
      discordId, 
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    });
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
  
  const avatarIndex = discriminator === '0' 
    ? (BigInt(discordId) >> BigInt(22)) % BigInt(6)
    : parseInt(discriminator) % 5;
  return `https://cdn.discordapp.com/embed/avatars/${avatarIndex}.png?size=256`;
}

// Validate that a string is a valid Discord snowflake ID
function isValidDiscordSnowflake(id: string): boolean {
  if (!id || typeof id !== 'string') {
    authLog.debug(`isValidDiscordSnowflake: Invalid input`, { id, type: typeof id });
    return false;
  }
  if (!/^\d{17,19}$/.test(id)) {
    authLog.debug(`isValidDiscordSnowflake: Invalid format`, { id, pattern: 'should be 17-19 digits' });
    return false;
  }
  
  try {
    const snowflake = BigInt(id);
    const timestamp = Number((snowflake >> BigInt(22))) + 1420070400000;
    const now = Date.now();
    const maxFuture = now + (50 * 365 * 24 * 60 * 60 * 1000);
    const isValid = timestamp >= 1420070400000 && timestamp < maxFuture;
    authLog.debug(`isValidDiscordSnowflake: Validation result`, { id, isValid, timestamp: new Date(timestamp).toISOString() });
    return isValid;
  } catch (e) {
    authLog.debug(`isValidDiscordSnowflake: Exception`, { id, error: String(e) });
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
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID as string,
      clientSecret: process.env.DISCORD_CLIENT_SECRET as string,
      allowDangerousEmailAccountLinking: true,
      authorization: {
        params: {
          scope: 'identify email guilds guilds.members.read',
          prompt: 'consent',
        },
      },
      async profile(profile: DiscordProfile, tokens: any) {
        const opId = `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 6)}`;
        
        authLog.divider(`PROFILE CALLBACK START [${opId}]`);
        
        // Log all incoming data
        authLog.step(1, 'Incoming Discord profile data', {
          discordId: profile.id,
          username: profile.username,
          discriminator: profile.discriminator,
          globalName: profile.global_name,
          email: profile.email,
          avatar: profile.avatar,
          verified: profile.verified,
        });
        
        authLog.step(2, 'Incoming tokens', {
          hasAccessToken: !!tokens.access_token,
          hasRefreshToken: !!tokens.refresh_token,
          expiresIn: tokens.expires_in,
          tokenType: tokens.token_type,
          scope: tokens.scope,
        });

        // CRITICAL VALIDATION
        const discordId = profile.id;
        
        if (!discordId) {
          authLog.error('CRITICAL: No Discord ID in profile!', { profile });
          throw new Error('No Discord ID found in profile');
        }

        if (!isValidDiscordSnowflake(discordId)) {
          authLog.error('CRITICAL: Invalid Discord snowflake format!', { discordId, profile });
          throw new Error(`Invalid Discord ID format: ${discordId}`);
        }
        
        authLog.success('Discord ID validated', { discordId });

        if (!tokens.access_token) {
          authLog.error('CRITICAL: No access token from Discord!');
          throw new Error('No access token received from Discord');
        }
        
        authLog.success('Access token present');

        // ========================================
        // DATABASE OPERATIONS
        // ========================================
        
        let userResult: {
          id: string;
          name: string | null;
          email: string | null;
          image: string | null;
          isAdmin: boolean;
          isBlocked: boolean;
          discordId: string;
        } | null = null;

        try {
          authLog.step(3, 'Starting database transaction');
          
          // STEP 3a: Check for existing account by Discord snowflake
          authLog.debug('Querying Account table for existing Discord account', { discordId });
          
          const existingAccount = await prisma.account.findUnique({
            where: {
              provider_providerAccountId: {
                provider: 'discord',
                providerAccountId: discordId,
              },
            },
            include: {
              user: true,
            },
          });

          if (existingAccount) {
            authLog.step(4, 'FOUND existing account by Discord ID', {
              accountId: existingAccount.id,
              providerAccountId: existingAccount.providerAccountId,
              userId: existingAccount.user.id,
              userName: existingAccount.user.name,
              userDiscordId: existingAccount.user.discordId,
              userIsAdmin: existingAccount.user.isAdmin,
            });

            // Verify data consistency
            if (existingAccount.providerAccountId !== discordId) {
              authLog.warn('DATA INCONSISTENCY: providerAccountId mismatch!', {
                expected: discordId,
                actual: existingAccount.providerAccountId,
              });
            }

            const avatarUrl = getDiscordAvatarUrl(discordId, profile.avatar, profile.discriminator);

            // Update account tokens
            authLog.debug('Updating account tokens', { accountId: existingAccount.id });
            await prisma.account.update({
              where: { id: existingAccount.id },
              data: {
                access_token: tokens.access_token,
                refresh_token: tokens.refresh_token,
                expires_at: Math.floor(Date.now() / 1000) + (tokens.expires_in || 604800),
                token_type: tokens.token_type,
                scope: tokens.scope,
              },
            });
            authLog.success('Account tokens updated');

            // Update user info
            authLog.debug('Updating user info', { userId: existingAccount.user.id });
            await prisma.user.update({
              where: { id: existingAccount.user.id },
              data: {
                name: profile.username || existingAccount.user.name,
                email: profile.email || existingAccount.user.email,
                image: avatarUrl,
                discordId: discordId,
              },
            });
            authLog.success('User info updated');

            userResult = {
              id: existingAccount.user.id,
              name: profile.username || existingAccount.user.name,
              email: profile.email || existingAccount.user.email,
              image: avatarUrl,
              isAdmin: existingAccount.user.isAdmin,
              isBlocked: existingAccount.user.isBlocked,
              discordId: discordId,
            };
            
            authLog.success('Profile callback will return existing user', userResult);
          } else {
            authLog.step(4, 'NO existing account found by Discord ID');

            // STEP 4b: Check for existing user by email
            if (profile.email) {
              authLog.debug('Querying User table by email', { email: profile.email });
              
              const existingUser = await prisma.user.findUnique({
                where: { email: profile.email },
                include: {
                  accounts: {
                    where: { provider: 'discord' },
                  },
                },
              });

              if (existingUser) {
                authLog.step(5, 'FOUND existing user by email', {
                  userId: existingUser.id,
                  userName: existingUser.name,
                  userDiscordId: existingUser.discordId,
                  hasExistingDiscordAccount: existingUser.accounts.length > 0,
                });

                const avatarUrl = getDiscordAvatarUrl(discordId, profile.avatar, profile.discriminator);

                if (existingUser.accounts.length > 0) {
                  // Update existing Discord account
                  authLog.debug('Updating existing Discord account', { 
                    accountId: existingUser.accounts[0].id,
                    oldProviderAccountId: existingUser.accounts[0].providerAccountId,
                    newProviderAccountId: discordId,
                  });
                  
                  await prisma.account.update({
                    where: { id: existingUser.accounts[0].id },
                    data: {
                      providerAccountId: discordId,
                      access_token: tokens.access_token,
                      refresh_token: tokens.refresh_token,
                      expires_at: Math.floor(Date.now() / 1000) + (tokens.expires_in || 604800),
                      token_type: tokens.token_type,
                      scope: tokens.scope,
                    },
                  });
                  authLog.success('Existing Discord account updated');
                } else {
                  // Create new Discord account for existing user
                  authLog.debug('Creating new Discord account for existing user');
                  
                  await prisma.account.create({
                    data: {
                      userId: existingUser.id,
                      type: 'oauth',
                      provider: 'discord',
                      providerAccountId: discordId,
                      access_token: tokens.access_token,
                      refresh_token: tokens.refresh_token,
                      expires_at: Math.floor(Date.now() / 1000) + (tokens.expires_in || 604800),
                      token_type: tokens.token_type,
                      scope: tokens.scope,
                    },
                  });
                  authLog.success('New Discord account created');
                }

                // Update user
                await prisma.user.update({
                  where: { id: existingUser.id },
                  data: {
                    name: profile.username || existingUser.name,
                    image: avatarUrl,
                    discordId: discordId,
                  },
                });

                userResult = {
                  id: existingUser.id,
                  name: profile.username || existingUser.name,
                  email: existingUser.email,
                  image: avatarUrl,
                  isAdmin: existingUser.isAdmin,
                  isBlocked: existingUser.isBlocked,
                  discordId: discordId,
                };
                
                authLog.success('Profile callback will return existing user (found by email)', userResult);
              }
            } else {
              authLog.debug('No email provided, skipping email lookup');
            }
          }

          // STEP 5: Create new user if not found
          if (!userResult) {
            authLog.step(6, 'Creating NEW user (no existing user found)');
            
            const { isAdmin, role } = await fetchUserPermissions(discordId);
            const avatarUrl = getDiscordAvatarUrl(discordId, profile.avatar, profile.discriminator);

            authLog.debug('Creating user with permissions', {
              discordId,
              isAdmin,
              role,
              username: profile.username,
            });

            const newUser = await prisma.user.create({
              data: {
                name: profile.username,
                email: profile.email,
                discordId: discordId,
                image: avatarUrl,
                isAdmin,
                role,
                isBlocked: false,
                accounts: {
                  create: {
                    type: 'oauth',
                    provider: 'discord',
                    providerAccountId: discordId,
                    access_token: tokens.access_token,
                    refresh_token: tokens.refresh_token,
                    expires_at: Math.floor(Date.now() / 1000) + (tokens.expires_in || 604800),
                    token_type: tokens.token_type,
                    scope: tokens.scope,
                  },
                },
              },
            });

            authLog.success('New user created', {
              userId: newUser.id,
              discordId: newUser.discordId,
              isAdmin: newUser.isAdmin,
              role: newUser.role,
            });

            userResult = {
              id: newUser.id,
              name: profile.username,
              email: profile.email,
              image: avatarUrl,
              isAdmin: newUser.isAdmin,
              isBlocked: newUser.isBlocked,
              discordId: discordId,
            };
          }

        } catch (dbError) {
          authLog.error('DATABASE ERROR in profile callback', dbError, { discordId });
          throw dbError;
        }

        // FINAL VALIDATION
        if (!userResult || !userResult.id) {
          authLog.error('CRITICAL: No user result at end of profile callback!', { userResult });
          throw new Error('Failed to create or find user');
        }

        // CRITICAL: Ensure we return the EXACT user ID from the database
        authLog.divider(`PROFILE CALLBACK END [${opId}]`);
        authLog.success('RETURNING USER DATA', {
          id: userResult.id,
          discordId: userResult.discordId,
          name: userResult.name,
          isAdmin: userResult.isAdmin,
        });

        return userResult;
      },
    }),
  ],
  session: {
    strategy: 'jwt' as const,
  },
  callbacks: {
    async jwt({ token, user, account }) {
      const opId = `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 6)}`;
      
      // Initial sign in - user object comes from profile callback
      if (account && user) {
        authLog.divider(`JWT CALLBACK - INITIAL SIGN IN [${opId}]`);
        
        authLog.step(1, 'JWT callback received', {
          userId: user.id,
          userName: user.name,
          userDiscordId: (user as any).discordId,
          provider: account.provider,
          hasAccessToken: !!account.access_token,
          hasRefreshToken: !!account.refresh_token,
        });

        // CRITICAL: Verify user exists in database
        authLog.step(2, 'Verifying user exists in database', { userId: user.id });
        
        const dbUser = await prisma.user.findUnique({
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
                id: true,
                providerAccountId: true,
                access_token: true,
                refresh_token: true,
              },
            },
          },
        });

        if (!dbUser) {
          authLog.error('CRITICAL: User NOT FOUND in database after profile callback!', { 
            profileReturnedId: user.id,
          });
          
          // EMERGENCY RECOVERY: Try to find user by discordId
          authLog.warn('Attempting emergency recovery by Discord ID...');
          
          const discordId = (user as any).discordId;
          if (discordId) {
            const recoveredUser = await prisma.user.findFirst({
              where: {
                OR: [
                  { discordId: discordId },
                  { accounts: { some: { providerAccountId: discordId } } },
                ],
              },
              select: {
                id: true,
                discordId: true,
                name: true,
                isAdmin: true,
                isBlocked: true,
                role: true,
              },
            });
            
            if (recoveredUser) {
              authLog.success('EMERGENCY RECOVERY SUCCESSFUL', { recoveredUserId: recoveredUser.id });
              
              // Continue with recovered user
              return {
                ...token,
                accessToken: account.access_token,
                accessTokenExpires: account.expires_at ? account.expires_at * 1000 : Date.now() + 604800 * 1000,
                refreshToken: account.refresh_token,
                user: {
                  id: recoveredUser.id,
                  isAdmin: recoveredUser.isAdmin,
                  isBlocked: recoveredUser.isBlocked,
                  role: recoveredUser.role,
                  discordId: recoveredUser.discordId,
                },
              };
            }
          }
          
          throw new Error('User not found after authentication - database sync issue');
        }

        authLog.success('User verified in database', {
          dbUserId: dbUser.id,
          dbUserDiscordId: dbUser.discordId,
          dbUserIsAdmin: dbUser.isAdmin,
          accountsCount: dbUser.accounts.length,
        });

        // Log account details
        if (dbUser.accounts.length > 0) {
          const discordAccount = dbUser.accounts[0];
          authLog.debug('Discord account details', {
            accountId: discordAccount.id,
            providerAccountId: discordAccount.providerAccountId,
            hasAccessToken: !!discordAccount.access_token,
            hasRefreshToken: !!discordAccount.refresh_token,
          });
          
          // Validate providerAccountId is a Discord snowflake
          if (!isValidDiscordSnowflake(discordAccount.providerAccountId)) {
            authLog.warn('INVALID providerAccountId detected!', {
              providerAccountId: discordAccount.providerAccountId,
              expected: 'Discord snowflake (17-19 digits)',
            });
          }
        } else {
          authLog.warn('User has no Discord account linked!');
        }

        // Update tokens in database if we have them from the OAuth flow
        if (account.access_token && account.refresh_token && dbUser.accounts.length > 0) {
          authLog.debug('Updating tokens in database from JWT callback');
          try {
            await prisma.account.update({
              where: { id: dbUser.accounts[0].id },
              data: {
                access_token: account.access_token,
                refresh_token: account.refresh_token,
                expires_at: account.expires_at,
                token_type: account.token_type,
                scope: account.scope,
              },
            });
            authLog.success('Tokens updated in database');
          } catch (updateError) {
            authLog.warn('Failed to update tokens (non-critical)', { error: String(updateError) });
          }
        }

        const result = {
          ...token,
          accessToken: account.access_token,
          accessTokenExpires: account.expires_at ? account.expires_at * 1000 : Date.now() + 604800 * 1000,
          refreshToken: account.refresh_token,
          user: {
            id: dbUser.id,
            isAdmin: dbUser.isAdmin,
            isBlocked: dbUser.isBlocked,
            role: dbUser.role ?? 0,
            discordId: dbUser.discordId || dbUser.accounts[0]?.providerAccountId || null,
          },
        };

        authLog.success('JWT token created successfully', {
          userId: result.user?.id,
          discordId: result.user?.discordId,
        });
        authLog.divider(`JWT CALLBACK END [${opId}]`);

        return result;
      }

      // Return previous token if not expired
      if (token.accessTokenExpires && Date.now() < token.accessTokenExpires - 60000) {
        return token;
      }

      // Refresh token if expired
      authLog.info('Access token expired, refreshing...');
      return refreshAccessToken(token);
    },
    
    async session({ session, token }) {
      const opId = `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 6)}`;
      
      authLog.debug(`Session callback [${opId}]`, {
        tokenUserId: token.user?.id,
        tokenDiscordId: token.user?.discordId,
      });

      if (token?.user?.id) {
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
              select: { providerAccountId: true }
            }
          },
        });

        if (dbUser) {
          const userDiscordId = dbUser.discordId || dbUser.accounts[0]?.providerAccountId || null;
          
          session.user = {
            id: dbUser.id,
            name: dbUser.name,
            email: dbUser.email,
            image: dbUser.image,
            isAdmin: dbUser.isAdmin,
            isBlocked: dbUser.isBlocked,
            role: dbUser.role ?? 0,
            discordId: userDiscordId,
          };

          authLog.debug(`Session populated from database [${opId}]`, {
            userId: dbUser.id,
            discordId: userDiscordId,
            isAdmin: dbUser.isAdmin,
          });
        } else {
          authLog.warn(`User not found in database, using token data [${opId}]`);
          session.user = {
            ...session.user,
            id: token.user.id,
            isAdmin: token.user.isAdmin,
            isBlocked: token.user.isBlocked,
            discordId: token.user.discordId,
          };
        }

        if (token.accessToken) {
          session.accessToken = token.accessToken;
        }
        
        if (token.error) {
          session.error = token.error;
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

async function refreshAccessToken(token: JWT): Promise<JWT> {
  authLog.info('Refreshing access token');
  
  try {
    const account = await prisma.account.findFirst({
      where: {
        userId: token.user?.id || token.sub,
        provider: 'discord',
      },
      select: {
        id: true,
        refresh_token: true,
        providerAccountId: true,
      },
    });

    if (!account?.refresh_token) {
      authLog.warn('No refresh token found for user');
      return { ...token, error: 'RefreshAccessTokenError' };
    }

    const params = new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID!,
      client_secret: process.env.DISCORD_CLIENT_SECRET!,
      grant_type: 'refresh_token',
      refresh_token: account.refresh_token,
    });

    const response = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      signal: AbortSignal.timeout(10000),
    });

    const refreshedTokens = await response.json();

    if (!response.ok) {
      authLog.error('Token refresh failed', null, {
        status: response.status,
        error: refreshedTokens.error,
      });
      
      if (response.status === 400 && refreshedTokens.error === 'invalid_grant') {
        authLog.warn('Refresh token invalid, clearing tokens');
        await prisma.account.update({
          where: { id: account.id },
          data: { access_token: null, refresh_token: null, expires_at: null },
        });
      }
      
      return { ...token, error: 'RefreshAccessTokenError' };
    }

    authLog.success('Token refresh successful');
    
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
    authLog.error('Error refreshing access token', error);
    return { ...token, error: 'RefreshAccessTokenError' };
  }
}
