import Fastify, { FastifyRequest, FastifyReply, FastifyInstance } from "fastify";
import fastifyRequestLogger from '@fastify/request-context';
import { Harmonix } from "../discordkit/types/harmonixtypes";
import { Guild } from "eris";
import fs from "fs";
import path from "path";
import cors from "@fastify/cors";
import { spawn } from "child_process";
import { prisma } from "./lib/db";
import { resolve as pathResolve } from "path";
import { bus } from './lib/events';
import { writeLog } from './lib/logSink';
import { invalidateGuildCache } from '../discordkit/utils/command';
import { loadCommandFromFile, unloadCommand } from './core';
import fastifyWebsocket from '@fastify/websocket';
import fastifyCookie from '@fastify/cookie';
import { jwtVerify } from 'jose';

// Helper function to construct Discord avatar URL
function getDiscordAvatarUrl(userId: string, avatarHash: string | null, discriminator: string = '0'): string {
  if (avatarHash) {
    // Check if avatar is animated (starts with 'a_')
    const isAnimated = avatarHash.startsWith('a_');
    // Use GIF for animated avatars, PNG for static
    const format = isAnimated ? 'gif' : 'png';
    return `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.${format}?size=256`;
  }
  
  // Fallback to default Discord avatar
  // For new usernames (discriminator = '0'), use user ID modulo
  const avatarIndex = discriminator === '0' 
    ? (BigInt(userId) >> BigInt(22)) % BigInt(6)
    : parseInt(discriminator) % 5;
  return `https://cdn.discordapp.com/embed/avatars/${avatarIndex}.png?size=256`;
}

/** Raw icon hash from Discord API → CDN URL (supports animated a_ hashes). */
function getGuildIconUrl(guildId: string, iconHash: string | null, size: number = 128): string | null {
  if (!iconHash) return null;
  const ext = iconHash.startsWith('a_') ? 'gif' : 'png';
  return `https://cdn.discordapp.com/icons/${guildId}/${iconHash}.${ext}?size=${size}`;
}
import http from 'http';

const dev = process.env.NODE_ENV !== "production";

// Robust dashboard path resolution - tries multiple strategies
function resolveDashboardPath(): string {
  // Strategy 1: Relative to this file (server.ts is in src/)
  const fromThisFile = path.resolve(__dirname, '..', 'dashboard');
  
  // Strategy 2: Relative to process.cwd()
  const fromCwd = path.resolve(process.cwd(), 'dashboard');
  
  // Strategy 3: Relative to parent of process.cwd() (if running from src/)
  const fromCwdParent = path.resolve(process.cwd(), '..', 'dashboard');
  
  // Strategy 4: Environment variable override
  const fromEnv = process.env.DASHBOARD_PATH;
  
  // Check which one exists
  const candidates = [
    fromEnv,
    fromThisFile,
    fromCwd,
    fromCwdParent,
  ].filter(Boolean) as string[];
  
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      // Verify it looks like a dashboard directory
      try {
        const hasPackageJson = fs.existsSync(path.join(candidate, 'package.json'));
        const hasAppDir = fs.existsSync(path.join(candidate, 'app')) || 
                         fs.existsSync(path.join(candidate, 'pages'));
        
        if (hasPackageJson && hasAppDir) {
          return candidate;
        }
      } catch (error) {
        // Continue to next candidate
      }
    }
  }
  
  // Return the most likely path even if it doesn't exist (for better error messages)
  return fromThisFile;
}

const dashboardPath = resolveDashboardPath();

// Read and parse config.json
const configPath = path.join(__dirname, "config.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

// Enable colors for console output if not in production
const isTTY = process.stdout.isTTY;
const colors = {
  reset: isTTY ? '\x1b[0m' : '',
  bright: isTTY ? '\x1b[1m' : '',
  dim: isTTY ? '\x1b[2m' : '',
  red: isTTY ? '\x1b[31m' : '',
  green: isTTY ? '\x1b[32m' : '',
  yellow: isTTY ? '\x1b[33m' : '',
  blue: isTTY ? '\x1b[34m' : '',
  magenta: isTTY ? '\x1b[35m' : '',
  cyan: isTTY ? '\x1b[36m' : '',
};

// Debug logger with different log levels
const debug = {
  enabled: config.debug || false,
  log: (...args: any[]) => debug.enabled && console.log(`${colors.blue}[${new Date().toISOString()}]${colors.reset} ${colors.cyan}[DEBUG]${colors.reset}`, ...args),
  info: (...args: any[]) => console.log(`${colors.blue}[${new Date().toISOString()}]${colors.reset} ${colors.green}[INFO]${colors.reset} `, ...args),
  warn: (...args: any[]) => console.warn(`${colors.blue}[${new Date().toISOString()}]${colors.reset} ${colors.yellow}[WARN]${colors.reset} `, ...args),
  error: (...args: any[]) => console.error(`${colors.blue}[${new Date().toISOString()}]${colors.reset} ${colors.red}[ERROR]${colors.reset}`, ...args),
  
  // Initialize request logging for Fastify
  initRequestLogging: (fastify: FastifyInstance) => {
    // Add request context for tracking requests
    fastify.register(fastifyRequestLogger);

    // Add hooks for request/response logging
    fastify.addHook('onRequest', (request, _, done) => {
      if (!debug.enabled) return done();
      
      const { method, url, id, params, query, headers } = request;
      const requestId = id as string;
      
      // Store start time for calculating response time
      request.requestStartTime = Date.now();
      request.requestId = requestId;
      
      debug.log(`[${requestId}] ${method} ${url}`, {
        params,
        query,
        headers: {
          'user-agent': headers['user-agent'],
          'x-forwarded-for': headers['x-forwarded-for']
        },
        timestamp: new Date().toISOString()
      });
      
      done();
    });

    fastify.addHook('onSend', (request, reply, payload, done) => {
      if (!debug.enabled || !request.requestStartTime) return done();
      
      const responseTime = Date.now() - request.requestStartTime;
      const requestId = request.requestId || 'unknown';
      
      const responseInfo = {
        requestId,
        statusCode: reply.statusCode,
        responseTime: `${responseTime}ms`,
        timestamp: new Date().toISOString(),
        hasData: payload ? (() => {
          try {
            const parsed = typeof payload === 'string' ? JSON.parse(payload) : payload;
            return !!(parsed && (Array.isArray(parsed) ? parsed.length > 0 : Object.keys(parsed).length > 0));
          } catch {
            return false;
          }
        })() : false
      };
      
      // Add request ID to response headers
      reply.header('X-Request-ID', requestId);
      
      if (reply.statusCode >= 400) {
        debug.error(`[${requestId}] Error Response:`, responseInfo);
      } else {
        debug.log(`[${requestId}] Response:`, responseInfo);
      }
      
      done();
    });
  },
  
  // Helper to log database queries
  db: {
    query: (query: string, params?: any[], duration?: number) => {
      if (!debug.enabled) return;
      const timeInfo = duration !== undefined ? `(${duration}ms)` : '';
      debug.log(`[DB] Query ${timeInfo}:`, query);
      if (params?.length) {
        debug.log('[DB] Params:', params);
      }
    },
    error: (error: Error, query?: string) => {
      debug.error('[DB] Error:', error.message);
      if (query) debug.error('[DB] Failed query:', query);
      if (error.stack) debug.error('[DB] Stack:', error.stack);
    }
  }
};

// Extend Fastify types
declare module 'fastify' {
  interface FastifyRequest {
    requestStartTime?: number;
    requestId?: string;
    user?: { id: string };
  }
}

// Log server startup info
const logStartup = () => {
  debug.info("=====================================");
  debug.info("Starting Terra Server");
  debug.info("=====================================");
  debug.info("Environment:", process.env.NODE_ENV || 'development');
  debug.info("Debug mode:", debug.enabled ? 'ENABLED' : 'disabled');
  debug.info("Dashboard path:", dashboardPath);
  debug.info("Node version:", process.version);
  debug.info("Platform:", `${process.platform} (${process.arch})`);
  debug.info("PID:", process.pid);
  debug.info("=====================================\n");
};

// Run startup logging
logStartup();

if (debug.enabled) {
  debug.log("Debug logging enabled");
  debug.log("Current working directory:", process.cwd());
  debug.log("Dashboard path:", dashboardPath);
  
  try {
    const files = fs.readdirSync(dashboardPath);
    debug.log("Dashboard directory contents:", files);
    
    // Check for 'pages' and 'app' directories
    const pagesDir = path.join(dashboardPath, "pages");
    const appDir = path.join(dashboardPath, "app");
    debug.log("Pages directory exists:", fs.existsSync(pagesDir));
    debug.log("App directory exists:", fs.existsSync(appDir));
  } catch (error) {
    debug.error("Failed to read dashboard directory:", error);
  }
}

if (!fs.existsSync(dashboardPath)) {
  const errorMessage = `
Dashboard folder not found at: ${dashboardPath}

Tried the following locations:
1. ${path.resolve(__dirname, '..', 'dashboard')} (relative to server.ts)
2. ${path.resolve(process.cwd(), 'dashboard')} (relative to cwd)
3. ${path.resolve(process.cwd(), '..', 'dashboard')} (relative to parent of cwd)

Solutions:
- Set DASHBOARD_PATH environment variable to the correct path
- Ensure you're running the bot from the project root or src/ directory
- Check that the dashboard/ folder exists at the project root

Current working directory: ${process.cwd()}
__dirname: ${__dirname}
`;
  console.error(errorMessage);
  throw new Error(errorMessage.trim());
}

if (
  !fs.existsSync(path.join(dashboardPath, "pages")) &&
  !fs.existsSync(path.join(dashboardPath, "app"))
) {
  console.error(
    `Neither 'pages' nor 'app' directory found in ${dashboardPath}`,
  );
  throw new Error(
    `Please create either a 'pages' or 'app' directory in ${dashboardPath}`,
  );
}

// Create Fastify server
const apiServer = Fastify({
  logger: debug.enabled ? {
    level: 'info',
    transport: {
      target: 'pino-pretty',
      options: {
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
        colorize: true
      }
    }
  } : false
});

// Global variable to track if server is initialized
let isServerInitialized = false;

export async function setupServer(harmonix: Harmonix) {
  if (isServerInitialized) {
    debug.warn('Server is already initialized');
    return;
  }

  debug.info('Initializing server...');
  debug.log('Harmonix options:', {
    debug: harmonix.options.debug,
    // Add other relevant options
  });
  
  try {
    // Enable CORS for API server
    debug.log('Registering CORS middleware');
    await apiServer.register(cors, {
      origin: true, // Allow all origins in development
      methods: ['GET', 'PUT', 'POST', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true
    });
    
    debug.log('CORS middleware registered successfully');
  } catch (error) {
    debug.error('Failed to initialize CORS:', error);
    throw error;
  }

  try {
    await apiServer.register(fastifyCookie);
    debug.log('Cookie parser registered');
  } catch (error) {
    debug.error('Failed to register cookie parser:', error);
    throw error;
  }

  // Register WebSocket support
  try {
    await apiServer.register(fastifyWebsocket);
    debug.log('WebSocket support registered');
  } catch (error) {
    debug.error('Failed to register WebSocket:', error);
  }

  function getDashboardSessionToken(request: FastifyRequest): string | undefined {
    const auth = request.headers.authorization;
    if (auth?.startsWith('Bearer ')) {
      return auth.slice(7).trim();
    }
    const c = request.cookies;
    return (
      c['authjs.session-token'] ||
      c['__Secure-authjs.session-token'] ||
      c['__Host-authjs.session-token']
    );
  }

  // Permission checking preHandler
  async function requireRole(request: FastifyRequest, reply: FastifyReply, minRole: number) {
    try {
      const sessionToken = getDashboardSessionToken(request);
      if (!sessionToken) {
        return reply.status(401).send({ error: 'Authentication required' });
      }

      const secret = process.env.NEXTAUTH_SECRET || 'hRCQDZSUh41PXtmK2pid0-LuFtNsUYZ0';
      const { payload } = await jwtVerify(sessionToken, new TextEncoder().encode(secret));
      
      if (!payload || typeof payload !== 'object' || !('user' in payload)) {
        return reply.status(401).send({ error: 'Invalid session' });
      }

      const user = (payload as any).user;
      if (!user?.id) {
        return reply.status(401).send({ error: 'Invalid session' });
      }

      request.user = { id: user.id };

      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { role: true, discordId: true },
      });

      if (!dbUser) {
        return reply.status(403).send({ error: 'User not found' });
      }

      // Check if bot owner
      if (dbUser.discordId === config.ownerId) {
        return; // Owner has all permissions
      }

      if (dbUser.role < minRole) {
        return reply.status(403).send({ error: 'Insufficient permissions' });
      }
    } catch (error) {
      debug.error('Permission check failed:', error);
      return reply.status(401).send({ error: 'Authentication failed' });
    }
  }

  // Initialize request logging if debug is enabled
  debug.log('Initializing request logging...');
  debug.initRequestLogging(apiServer);

  // API routes
  apiServer.get("/api/commands", async (request, reply) => {
    const commands = Array.from(harmonix.commands.values()).map((cmd) => ({
      name: cmd.name,
      description: cmd.description,
      category: cmd.category,
    }));
    return reply.status(200).send(commands);
  });

  apiServer.get("/api/featureflags", async (request, reply) => {
    return reply.status(200).send(harmonix.options.featureFlags);
  });

  // User profile endpoint
  apiServer.get('/api/users/:userId', async (request, reply) => {
    const { userId } = request.params as { userId: string };
    
    try {
      console.log(`[DEBUG] Looking up user with ID: ${userId}`);
      
      // First try to find user by Discord ID (providerAccountId)
      console.log(`[DEBUG] Searching for Discord account with providerAccountId: ${userId}`);
      const discordAccountResult = await prisma.account.findFirst({
        where: { 
          provider: 'discord',
          providerAccountId: userId
        },
        include: {
          user: true
        }
      });
      console.log(`[DEBUG] Discord account lookup result:`, 
        discordAccountResult ? 'Found' : 'Not found');

      let user = null;
      let discordAccounts = [];
      let primaryDiscordAccount = null;

      if (discordAccountResult) {
        console.log('[DEBUG] Found user by Discord ID:', discordAccountResult.user);
        user = discordAccountResult.user;
        
        // Get all Discord accounts for this user
        discordAccounts = await prisma.account.findMany({
          where: { 
            userId: user.id,
            provider: 'discord'
          },
          select: {
            providerAccountId: true,
            provider: true,
            access_token: true,
            refresh_token: true,
            expires_at: true,
            token_type: true,
            scope: true
          }
        });
        console.log(`[DEBUG] Found ${discordAccounts.length} Discord accounts for user ${user.id}`);
        
        // Use the account used for lookup as primary if available
        primaryDiscordAccount = discordAccounts.find(acc => acc.providerAccountId === userId) || discordAccounts[0];
      } else {
        console.log('[DEBUG] No user found by Discord ID, trying internal ID lookup');
        
        // If no user found with this Discord ID, try to find by internal ID (for backward compatibility)
        const userWithAccounts = await prisma.user.findUnique({
          where: { id: userId },
          include: {
            accounts: {
              where: { provider: 'discord' },
              select: {
                providerAccountId: true,
                provider: true,
                access_token: true,
                refresh_token: true,
                expires_at: true,
                token_type: true,
                scope: true
              }
            }
          }
        });

        if (userWithAccounts) {
          console.log('[DEBUG] Found user by internal ID:', userWithAccounts);
          user = userWithAccounts;
          discordAccounts = userWithAccounts.accounts || [];
          primaryDiscordAccount = discordAccounts[0];
          console.log(`[DEBUG] Found ${discordAccounts.length} Discord accounts for internal user ${user.id}`);
        }
      }
      
      if (!user) {
        console.log('[DEBUG] User not found with either Discord ID or internal ID');
        return reply.status(404).send({ 
          error: 'User not found',
          details: `No user found with ID/Discord ID: ${userId}`
        });
      }

      const discordAccount = primaryDiscordAccount;
      
      if (!discordAccount?.access_token) {
        // Return basic user data without Discord-specific info
        return reply.send({
          id: user.id,
          discordUserId: user.discordId || null,
          username: user.name || 'User',
          discriminator: '0',
          globalName: user.name || null,
          avatar: user.image || getDiscordAvatarUrl(user.discordId || '', null, '0'),
          avatarHash: null,
          email: user.email || null,
          isAdmin: user.isAdmin || false,
          isBlocked: user.isBlocked || false,
          createdAt: user.createdAt.toISOString(),
          updatedAt: user.updatedAt.toISOString(),
          guilds: [],
          premiumType: null,
          verified: null,
          locale: null,
          mfaEnabled: null,
          _warnings: ['No Discord account linked or token expired']
        });
      }

      // Helper function to refresh token if needed
      const refreshTokenIfNeeded = async (): Promise<string> => {
        if (!discordAccount.expires_at || Date.now() >= discordAccount.expires_at * 1000 - 60000) {
          try {
            const params = new URLSearchParams();
            params.append('client_id', process.env.DISCORD_CLIENT_ID || '');
            params.append('client_secret', process.env.DISCORD_CLIENT_SECRET || '');
            params.append('grant_type', 'refresh_token');
            params.append('refresh_token', discordAccount.refresh_token || '');

            const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
              method: 'POST',
              body: params,
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
              },
            });

            if (!tokenResponse.ok) {
              const errorText = await tokenResponse.text();
              console.error('Token refresh failed:', tokenResponse.status, errorText);
              
              // Check if it's an invalid_grant error (refresh token is invalid/expired)
              if (tokenResponse.status === 400 && errorText.includes('invalid_grant')) {
                console.warn('[AUTH] Refresh token is invalid, clearing tokens from database');
                // Clear the invalid tokens from database to force re-authentication
                await prisma.account.update({
                  where: {
                    provider_providerAccountId: {
                      provider: 'discord',
                      providerAccountId: discordAccount.providerAccountId
                    }
                  },
                  data: {
                    access_token: null,
                    refresh_token: null,
                    expires_at: null
                  }
                });
                throw new Error('REFRESH_TOKEN_INVALID');
              }
              
              throw new Error('Failed to refresh token');
            }

            const tokenData = await tokenResponse.json();
            
            // Update the account with new tokens
            await prisma.account.update({
              where: {
                provider_providerAccountId: {
                  provider: 'discord',
                  providerAccountId: discordAccount.providerAccountId
                }
              },
              data: {
                access_token: tokenData.access_token,
                refresh_token: tokenData.refresh_token || discordAccount.refresh_token,
                expires_at: Math.floor(Date.now() / 1000 + (tokenData.expires_in || 604800)),
                token_type: tokenData.token_type,
                scope: tokenData.scope
              }
            });

            return tokenData.access_token;
          } catch (error) {
            console.error('Failed to refresh token:', error);
            throw error;
          }
        }
        return discordAccount.access_token;
      };

      // Get a valid access token (refreshing if needed)
      let accessToken: string;
      try {
        accessToken = await refreshTokenIfNeeded();
      } catch (error) {
        if (error instanceof Error && error.message === 'REFRESH_TOKEN_INVALID') {
          // Return error response indicating re-authentication is needed
          return reply.status(401).send({ 
            error: 'Token expired',
            details: 'Your Discord session has expired. Please re-authenticate.',
            requiresReauth: true
          });
        }
        console.error('Token refresh failed, using existing token:', error);
        accessToken = discordAccount.access_token;
      }

      // Helper function to handle rate limits with exponential backoff
      const fetchWithRetry = async (url: string, options: any = {}, retries = 3, backoff = 1000): Promise<Response> => {
        try {
          const response = await fetch(url, options);
          
          // If we're rate limited, wait and retry
          if (response.status === 429) {
            const retryAfter = parseInt(response.headers.get('retry-after') || '1') * 1000 || backoff;
            console.warn(`Rate limited. Retrying in ${retryAfter}ms (${retries} retries left)`);
            
            if (retries <= 0) {
              throw new Error('Max retries reached for rate limit');
            }
            
            await new Promise(resolve => setTimeout(resolve, retryAfter));
            return fetchWithRetry(url, options, retries - 1, backoff * 2);
          }
          
          return response;
        } catch (error) {
          if (retries <= 0) throw error;
          console.warn(`Request failed, retrying (${retries} attempts left):`, error);
          await new Promise(resolve => setTimeout(resolve, backoff));
          return fetchWithRetry(url, options, retries - 1, backoff * 2);
        }
      };

      // Fetch user info first
      let discordUser = null;
      try {
        const userInfo = await fetchWithRetry('https://discord.com/api/users/@me', {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        });

        // Handle user info response
        if (!userInfo.ok) {
          const errorText = await userInfo.text();
          console.warn('Failed to fetch user info from Discord API (using cached data):', errorText);
          // Don't throw - we'll use the database user info instead
        } else {
          discordUser = await userInfo.json();
        }
      } catch (error) {
        console.warn('Discord API request failed (using cached data):', error.message);
        // Continue with database user info
      }

      // If Discord API failed, use cached user info from database
      if (!discordUser) {
        const legacyTag = user.name?.match(/^(.+)#(\d{4})$/);
        discordUser = {
          id: user.discordId,
          username: legacyTag?.[1] || user.name?.split('#')[0] || 'Unknown',
          discriminator: legacyTag?.[2] || '0',
          global_name: legacyTag ? null : user.name || null,
          avatar: user.image?.split('/').pop()?.split('.')[0] || null,
          avatar_url: user.image || null,
          premium_type: null,
          verified: null,
          locale: null,
          mfa_enabled: null,
        };
      }
      
      let guilds = [];

      try {
        // Try to fetch guilds, but don't fail the whole request if it fails
        const guildsResponse = await fetchWithRetry('https://discord.com/api/users/@me/guilds', {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        });

        if (guildsResponse.ok) {
          guilds = await guildsResponse.json();
        } else {
          const errorText = await guildsResponse.text();
          console.warn('Failed to fetch guilds from Discord API, continuing without guild data:', errorText);
        }
      } catch (guildError) {
        console.warn('Error while fetching guilds, continuing without guild data:', guildError);
      }

      // Get guilds where the bot is present from the database
      const botGuilds = await prisma.guild.findMany({
        where: {
          id: {
            in: guilds.map((g: any) => g.id)
          }
        },
        include: {
          commands: true
        }
      });

      // Combine Discord guild data with bot-specific data
      const enrichedGuilds = guilds.map((guild: any) => {
        const botGuild = botGuilds.find(g => g.id === guild.id);
        const permissions = BigInt(guild.permissions || '0');
        const isAdmin = (permissions & BigInt(0x8)) === BigInt(0x8); // ADMINISTRATOR permission
        const canManage = isAdmin || (permissions & BigInt(0x20)) === BigInt(0x20); // MANAGE_GUILD permission
        const iconHash = guild.icon ?? null;

        return {
          id: guild.id,
          name: guild.name,
          icon: iconHash,
          iconUrl: getGuildIconUrl(guild.id, iconHash, 128),
          permissions: guild.permissions,
          owner: guild.owner || false,
          permissions_new: isAdmin
            ? 'ADMINISTRATOR'
            : canManage
              ? 'MANAGE SERVER'
              : 'MEMBER',
          features: guild.features || [],
          hasBot: !!botGuild,
          botJoinedAt: botGuild?.createdAt?.toISOString() || null,
          commandCount: botGuild?.commands?.length || 0,
          isAdmin,
          canManage
        };
      });

      enrichedGuilds.sort((a, b) => {
        if (a.hasBot !== b.hasBot) {
          return a.hasBot ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });

      const discordSnowflake = String(discordUser.id || user.discordId || '');

      // Format the response
      const response = {
        id: user.id,
        discordUserId: discordSnowflake || null,
        username: discordUser.username || user.name || 'User',
        discriminator: discordUser.discriminator || '0',
        globalName: discordUser.global_name || null,
        avatar: getDiscordAvatarUrl(
          discordSnowflake,
          discordUser.avatar || null,
          discordUser.discriminator || '0'
        ),
        avatarHash: discordUser.avatar || null,
        email: discordUser.email || user.email || null,
        isAdmin: user.isAdmin,
        isBlocked: user.isBlocked,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
        guilds: enrichedGuilds,
        premiumType: typeof discordUser.premium_type === 'number' ? discordUser.premium_type : null,
        verified: typeof discordUser.verified === 'boolean' ? discordUser.verified : null,
        locale: typeof discordUser.locale === 'string' ? discordUser.locale : null,
        mfaEnabled: typeof discordUser.mfa_enabled === 'boolean' ? discordUser.mfa_enabled : null
      };

      return reply.status(200).send(response);
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return reply.status(500).send({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  apiServer.get("/api/servers", async (request, reply) => {
    const { q, offset } = request.query as { q?: string; offset?: string };
    const searchTerm = q?.toLowerCase() || "";
    const offsetNum = parseInt(offset || "0", 10);

    const allServers = Array.from(harmonix.client.guilds.values());
    const filteredServers = allServers.filter((server: Guild) =>
      server.name.toLowerCase().includes(searchTerm),
    );

    const paginatedServers = filteredServers.slice(offsetNum, offsetNum + 20);
    const serverData = paginatedServers.map((server: Guild) => ({
      id: server.id,
      name: server.name,
      memberCount: server.memberCount,
    }));

    return reply.status(200).send({
      servers: serverData,
      newOffset: offsetNum + 20,
      totalServers: filteredServers.length,
    });
  });

  apiServer.post("/api/bot/restart", async (request, reply) => {
    console.log("Restarting bot...");
    // Implement bot restart logic here
    return reply.status(200).send({ message: "Bot restarted successfully" });
  });

  apiServer.get("/api/logs/:serverId", async (request, reply) => {
    const { serverId } = request.params as { serverId: string };
    // Implement logic to fetch logs for the specific server
    const logs = [
      `Log 1 for server ${serverId}`,
      `Log 2 for server ${serverId}`,
    ];
    return reply.status(200).send(logs);
  });

  apiServer.get("/api/servers/:serverId", async (request, reply) => {
    const { serverId } = request.params as { serverId: string };
    
    try {
      const guild = harmonix.client.guilds.get(serverId);
      
      if (!guild) {
        return reply.status(404).send({ error: 'Server not found' });
      }
      
      const response = {
        id: guild.id,
        name: guild.name,
        memberCount: guild.memberCount,
        iconUrl: getGuildIconUrl(guild.id, guild.icon ?? null, 256),
        channelCount: guild.channels?.size || 0,
        roleCount: guild.roles?.size || 0,
        createdAt: (BigInt(guild.id) >> BigInt(22)) + 1420070400000n,
      };
      
      return reply.status(200).send(response);
    } catch (error) {
      console.error('Error fetching server details:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Mutual servers detection endpoint
  apiServer.get('/api/users/:userId/mutual-servers', async (request, reply) => {
    const { userId } = request.params as { userId: string };
    
    try {
      console.log(`[MUTUAL-SERVERS] Finding mutual servers for user ID: ${userId}`);
      
      // Find user's Discord account - try by providerAccountId first, then by user.id
      let discordAccount = await prisma.account.findFirst({
        where: {
          provider: 'discord',
          providerAccountId: userId
        },
        include: {
          user: true
        }
      });
      
      // If not found by providerAccountId, try to find by user's internal ID
      if (!discordAccount) {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          include: {
            accounts: {
              where: { provider: 'discord' }
            }
          }
        });
        
        if (user && user.accounts.length > 0) {
          discordAccount = {
            ...user.accounts[0],
            user: user
          } as any;
          console.log(`[MUTUAL-SERVERS] Found Discord account via user internal ID`);
        }
      }
      
      console.log(`[MUTUAL-SERVERS] Discord account found: ${discordAccount ? 'YES' : 'NO'}`);
      
      let discordId = userId;
      let accessToken: string | null = null;
      let refreshToken: string | null = null;
      let tokenScope: string | null = null;
      
      if (discordAccount) {
        discordId = discordAccount.providerAccountId;
        accessToken = discordAccount.access_token;
        refreshToken = discordAccount.refresh_token;
        tokenScope = discordAccount.scope;
        
        console.log(`[MUTUAL-SERVERS] Has access token: ${accessToken ? 'YES' : 'NO'}`);
        console.log(`[MUTUAL-SERVERS] Has refresh token: ${refreshToken ? 'YES' : 'NO'}`);
        console.log(`[MUTUAL-SERVERS] Token scope: ${tokenScope || 'UNKNOWN'}`);
        
        // Check if token is expired or about to expire (within 5 minutes)
        const isTokenExpired = discordAccount.expires_at && Date.now() >= discordAccount.expires_at * 1000 - 300000;
        
        // Refresh token if needed - only if we have a refresh token
        if (accessToken && isTokenExpired && refreshToken) {
          try {
            console.log(`[MUTUAL-SERVERS] Refreshing expired token...`);
            const params = new URLSearchParams();
            params.append('client_id', process.env.DISCORD_CLIENT_ID || '');
            params.append('client_secret', process.env.DISCORD_CLIENT_SECRET || '');
            params.append('grant_type', 'refresh_token');
            params.append('refresh_token', refreshToken);

            const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
              method: 'POST',
              body: params,
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
              },
            });

            if (tokenResponse.ok) {
              const tokenData = await tokenResponse.json();
              
              await prisma.account.update({
                where: {
                  provider_providerAccountId: {
                    provider: 'discord',
                    providerAccountId: discordAccount.providerAccountId
                  }
                },
                data: {
                  access_token: tokenData.access_token,
                  refresh_token: tokenData.refresh_token || refreshToken,
                  expires_at: Math.floor(Date.now() / 1000 + (tokenData.expires_in || 604800)),
                  token_type: tokenData.token_type,
                  scope: tokenData.scope
                }
              });
              
              accessToken = tokenData.access_token;
              console.log(`[MUTUAL-SERVERS] Token refreshed successfully`);
            } else {
              const errorText = await tokenResponse.text();
              console.error(`[MUTUAL-SERVERS] Token refresh failed: ${tokenResponse.status}`, errorText);
              
              // Check if it's an invalid_grant error (refresh token is invalid/expired)
              if (tokenResponse.status === 400 && errorText.includes('invalid_grant')) {
                console.warn('[MUTUAL-SERVERS] Refresh token is invalid, clearing tokens from database');
                // Clear the invalid tokens from database to force re-authentication
                await prisma.account.update({
                  where: {
                    provider_providerAccountId: {
                      provider: 'discord',
                      providerAccountId: discordAccount.providerAccountId
                    }
                  },
                  data: {
                    access_token: null,
                    refresh_token: null,
                    expires_at: null
                  }
                });
                // Return error response indicating re-authentication is needed
                return reply.status(401).send({ 
                  error: 'Token expired',
                  details: 'Your Discord session has expired. Please re-authenticate.',
                  requiresReauth: true
                });
              }
              
              // Don't throw - we'll try with the existing token or use bot fallback
            }
          } catch (error) {
            console.warn('[MUTUAL-SERVERS] Token refresh error:', error);
            // Don't throw - continue with existing token or bot fallback
          }
        }
      }
      
      // Helper function to handle rate limits with exponential backoff
      const fetchWithRetry = async (url: string, options: any = {}, retries = 3, backoff = 1000): Promise<Response> => {
        try {
          const response = await fetch(url, options);
          
          if (response.status === 429) {
            const retryAfter = parseInt(response.headers.get('retry-after') || '1') * 1000 || backoff;
            console.warn(`[MUTUAL-SERVERS] Rate limited. Retrying in ${retryAfter}ms (${retries} retries left)`);
            
            if (retries <= 0) {
              throw new Error('Max retries reached for rate limit');
            }
            
            await new Promise(resolve => setTimeout(resolve, retryAfter));
            return fetchWithRetry(url, options, retries - 1, backoff * 2);
          }
          
          return response;
        } catch (error) {
          if (retries <= 0) throw error;
          console.warn(`[MUTUAL-SERVERS] Request failed, retrying (${retries} attempts left):`, error);
          await new Promise(resolve => setTimeout(resolve, backoff));
          return fetchWithRetry(url, options, retries - 1, backoff * 2);
        }
      };
      
      // Get user's guilds from Discord API or database cache
      let userGuilds: Array<{id: string; name?: string; icon?: string | null; owner?: boolean; permissions?: string}> = [];
      let userGuildIds: Set<string> = new Set();
      let guildPermissions: Map<string, { isAdmin: boolean; canManage: boolean; isOwner: boolean }> = new Map();
      let source: 'api' | 'database' | 'bot_fallback' = 'bot_fallback';
      
      if (accessToken) {
        try {
          console.log(`[MUTUAL-SERVERS] Fetching user guilds from Discord API...`);
          const guildsResponse = await fetchWithRetry('https://discord.com/api/users/@me/guilds', {
            headers: {
              Authorization: `Bearer ${accessToken}`
            }
          });
          
          console.log(`[MUTUAL-SERVERS] Guilds API response status: ${guildsResponse.status}`);
          
          if (guildsResponse.ok) {
            userGuilds = await guildsResponse.json();
            userGuildIds = new Set(userGuilds.map(g => g.id));
            
            // Store permissions for each guild
            for (const guild of userGuilds) {
              const permissions = BigInt(guild.permissions || '0');
              const isAdmin = (permissions & BigInt(0x8)) === BigInt(0x8);
              const canManage = isAdmin || (permissions & BigInt(0x20)) === BigInt(0x20);
              guildPermissions.set(guild.id, { isAdmin, canManage, isOwner: guild.owner || false });
            }
            
            console.log(`[MUTUAL-SERVERS] Found ${userGuildIds.size} user guilds from Discord API`);
            source = 'api';
            
            // Cache guilds in database for future use
            if (discordAccount?.user?.id) {
              try {
                // Delete old cached guilds for this user
                await prisma.userGuild.deleteMany({
                  where: { userId: discordAccount.user.id }
                });
                
                // Insert new cached guilds
                const userGuildData = userGuilds.map(guild => ({
                  userId: discordAccount.user.id,
                  guildId: guild.id,
                  permissions: guild.permissions,
                  owner: guild.owner || false
                }));
                
                await prisma.userGuild.createMany({
                  data: userGuildData,
                  skipDuplicates: true
                });
                
                console.log(`[MUTUAL-SERVERS] Cached ${userGuildData.length} guilds in database`);
              } catch (cacheError) {
                console.warn('[MUTUAL-SERVERS] Failed to cache guilds in database:', cacheError);
              }
            }
          } else {
            const errorText = await guildsResponse.text();
            console.error(`[MUTUAL-SERVERS] Failed to fetch guilds: ${errorText}`);
          }
        } catch (error) {
          console.error('[MUTUAL-SERVERS] Failed to fetch user guilds from Discord API:', error);
        }
      }
      
      // If we don't have guilds from API, try to get them from database cache
      if (userGuildIds.size === 0 && discordAccount?.user?.id) {
        try {
          console.log(`[MUTUAL-SERVERS] Fetching cached guilds from database...`);
          const cachedGuilds = await prisma.userGuild.findMany({
            where: { userId: discordAccount.user.id }
          });
          
          if (cachedGuilds.length > 0) {
            userGuildIds = new Set(cachedGuilds.map(g => g.guildId));
            
            // Reconstruct permissions from cached data
            for (const cachedGuild of cachedGuilds) {
              if (cachedGuild.permissions) {
                const permissions = BigInt(cachedGuild.permissions);
                const isAdmin = (permissions & BigInt(0x8)) === BigInt(0x8);
                const canManage = isAdmin || (permissions & BigInt(0x20)) === BigInt(0x20);
                guildPermissions.set(cachedGuild.guildId, { isAdmin, canManage, isOwner: cachedGuild.owner });
              }
            }
            
            console.log(`[MUTUAL-SERVERS] Found ${userGuildIds.size} cached guilds in database`);
            source = 'database';
          }
        } catch (dbError) {
          console.warn('[MUTUAL-SERVERS] Failed to fetch cached guilds from database:', dbError);
        }
      }
      
      // Get all guilds the bot is in
      const botGuilds = Array.from(harmonix.client.guilds.values());
      const botGuildIds = new Set(botGuilds.map(g => g.id));
      
      console.log(`[MUTUAL-SERVERS] Bot is in ${botGuildIds.size} guilds`);
      
      // Find mutual servers by comparing user guild IDs with bot guild IDs
      let mutualGuildIds: string[] = [];
      
      if (userGuildIds.size > 0) {
        // We have user's guilds from API or database - find intersection with bot guilds
        mutualGuildIds = [...userGuildIds].filter(id => botGuildIds.has(id));
        console.log(`[MUTUAL-SERVERS] Found ${mutualGuildIds.length} mutual servers by comparing guild IDs (source: ${source})`);
      } else {
        // Fallback: Check if the user is a member in each bot guild
        // This uses the bot's ability to see guild members
        console.log(`[MUTUAL-SERVERS] Using bot fallback to check guild memberships...`);
        source = 'bot_fallback';
        
        for (const guild of botGuilds) {
          try {
            // Try to fetch the member from the guild using Eris API
            const members = await guild.fetchMembers().catch(() => null);
            if (members && members.has(discordId)) {
              mutualGuildIds.push(guild.id);
            }
          } catch (e) {
            // Member not found or error - skip
          }
        }
      }
      
      console.log(`[MUTUAL-SERVERS] Found ${mutualGuildIds.length} mutual servers`);
      if (mutualGuildIds.length > 0) {
        console.log(`[MUTUAL-SERVERS] Mutual server IDs:`, mutualGuildIds.slice(0, 5));
      }
      
      // Get detailed info for mutual servers
      const mutualServers = mutualGuildIds.map(guildId => {
        const guild = harmonix.client.guilds.get(guildId);
        if (!guild) return null;
        
        const perms = guildPermissions.get(guildId) || { isAdmin: false, canManage: false, isOwner: false };
        
        return {
          id: guild.id,
          name: guild.name,
          iconUrl: getGuildIconUrl(guild.id, guild.icon ?? null, 128),
          icon: guild.icon ?? null,
          memberCount: guild.memberCount,
          isOwner: perms.isOwner,
          isAdmin: perms.isAdmin,
          canManage: perms.canManage,
          hasBot: true
        };
      }).filter(Boolean);
      
      // Sort by name
      mutualServers.sort((a, b) => a.name.localeCompare(b.name));
      
      return reply.status(200).send({
        userId: discordId,
        mutualServers: mutualServers,
        totalMutualServers: mutualServers.length,
        totalUserGuilds: userGuildIds.size > 0 ? userGuildIds.size : mutualGuildIds.length,
        totalBotGuilds: botGuildIds.size,
        source: userGuildIds.size > 0 ? 'api' : 'bot_fallback'
      });
      
    } catch (error) {
      console.error('[MUTUAL-SERVERS] Error finding mutual servers:', error);
      return reply.status(500).send({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Database-driven command settings endpoint
  apiServer.get("/api/servers/:serverId/commands", async (request, reply) => {
    const { serverId } = request.params as { serverId: string };

    // Get all command settings from DB for this guild
    const commandSettings = await prisma.commandSetting.findMany({
      where: { guildId: serverId },
    });

    // Create a map for O(1) lookups
    const settingsMap = new Map(
      commandSettings.map((setting) => [setting.commandName, setting.enabled])
    );

    // Get all registered bot commands
    const allCommands = Array.from(harmonix.commands.values());

    // Merge bot commands with their settings
    const commandsWithStatus = allCommands.map((cmd) => ({
      name: cmd.name,
      description: cmd.description,
      category: cmd.category,
      // Use DB setting if available, otherwise default to true
      enabled: settingsMap.get(cmd.name) ?? true,
    }));

    return reply.status(200).send(commandsWithStatus);
  });

  apiServer.post("/api/servers/:serverId/commands", async (request, reply) => {
    const { serverId } = request.params as { serverId: string };
    const { commandName, enabled } = request.body as {
      commandName: string;
      enabled: boolean;
    };

    try {
      // Ensure the guild exists in the database to satisfy foreign key constraints
      await prisma.guild.upsert({
        where: { id: serverId },
        update: {},
        create: { id: serverId },
      });

      // Upsert the command setting
      await prisma.commandSetting.upsert({
        where: {
          guildId_commandName: {
            guildId: serverId,
            commandName: commandName,
          },
        },
        update: { enabled },
        create: {
          guildId: serverId,
          commandName,
          enabled,
        },
      });

      console.log(
        `DATABASE: Server ${serverId}: Command '${commandName}' status set to ${enabled}`
      );

      return reply.status(200).send({ success: true });
    } catch (error) {
      console.error("Failed to update command status in DB:", error);
      return reply
        .status(500)
        .send({ success: false, error: "Database update failed" });
    }
  });

  // User management endpoints
  apiServer.get("/api/users", async (request, reply) => {
    try {
      const dbUsers = await prisma.user.findMany({
        orderBy: {
          updatedAt: 'desc',
        },
        include: {
          accounts: {
            select: {
              providerAccountId: true,
              provider: true,
            },
          },
        },
      });

      const usersWithDetails = await Promise.all(
        dbUsers.map(async (user) => {
          try {
            // Try to get user data from Discord API via bot client first
            let discordUser = null;
            try {
              discordUser = await harmonix.client.getRESTUser(user.id);
            } catch (e) {
              console.warn(`[Users] Could not fetch user ${user.id} via bot client:`, e.message);
            }
            
            const discordAccount = user.accounts?.find(acc => acc.provider === 'discord');
            const discordId = discordAccount?.providerAccountId || user.id;
            
            // Format username with fallbacks
            let username = user.name || `User-${user.id.slice(0, 4)}`;
            let discriminator = '0';
            let avatar = null;
            let avatarUrl = null;
            
            // If we have Discord user data, use it
            if (discordUser) {
              username = discordUser.username || username;
              discriminator = discordUser.discriminator === '0' ? '0' : (discordUser.discriminator || '0');
              avatar = discordUser.avatar || null;
              
              // Build avatar URL with format detection (for GIFs)
              if (avatar) {
                const format = avatar.startsWith('a_') ? 'gif' : 'png';
                avatarUrl = `https://cdn.discordapp.com/avatars/${discordId}/${avatar}.${format}`;
              }
            }
            
            // Fallback to default avatar if no avatar URL was set
            if (!avatarUrl) {
              // Try to use the image from the user record
              if (user.image) {
                avatarUrl = user.image;
              } 
              // Fallback to default Discord avatar based on discriminator
              else if (discriminator && discriminator !== '0') {
                const defaultAvatarIndex = parseInt(discriminator) % 5;
                avatarUrl = `https://cdn.discordapp.com/embed/avatars/${defaultAvatarIndex}.png`;
              } 
              // Final fallback to default avatar
              else {
                avatarUrl = 'https://cdn.discordapp.com/embed/avatars/0.png';
              }
            }
            
            return {
              id: user.id,
              discordId: discordId,
              username: username,
              discriminator: discriminator,
              email: user.email || null,
              avatar: avatar,
              avatarUrl: avatarUrl,
              isAdmin: user.role >= 2, // Assuming role 2 is admin
              isBlocked: user.role === -1, // Assuming -1 is blocked
              role: user.role,
              createdAt: user.createdAt.toISOString(),
              updatedAt: user.updatedAt.toISOString(),
              guilds: [], // Empty array as we don't need guilds in the list
            };
            
          } catch (e) {
            console.error(`[Users] Failed to process user ${user.id}:`, e);
            // Fallback to basic user data if anything fails
            return {
              id: user.id,
              discordId: user.accounts?.find(a => a.provider === 'discord')?.providerAccountId || null,
              username: user.name || `User-${user.id.slice(0, 4)}`,
              discriminator: '0',
              email: user.email || null,
              avatar: user.image || null,
              avatarUrl: user.image || 'https://cdn.discordapp.com/embed/avatars/0.png',
              isAdmin: user.role >= 2,
              isBlocked: user.role === -1,
              role: user.role || 0,
              createdAt: user.createdAt.toISOString(),
              updatedAt: user.updatedAt.toISOString(),
              guilds: [],
              _warnings: ['Failed to fetch full user data']
            };
          }
        })
      );
      
      return reply.status(200).send(usersWithDetails);
      
    } catch (error) {
      console.error("[Users] Failed to fetch users:", error);
      return reply.status(500).send({ 
        success: false, 
        error: "Failed to fetch users.",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Permissions endpoint to get bot owner ID and user roles
  apiServer.get("/api/permissions", async (request, reply) => {
    try {
      // Get bot owner ID from config
      const botOwnerId = config.ownerId;
      
      // Get all users with admin or moderator roles (role >= 1)
      const adminUsers = await prisma.user.findMany({
        where: {
          OR: [
            { role: { gte: 2 } }, // Admins and owners
            { discordId: botOwnerId } // Always include bot owner
          ]
        },
        select: {
          id: true,
          discordId: true,
          name: true,
          email: true,
          role: true,
          isAdmin: true,
          isBlocked: true
        }
      });

      // Get all users with moderator role (role = 1)
      const moderatorUsers = await prisma.user.findMany({
        where: {
          role: 1
        },
        select: {
          id: true,
          discordId: true,
          name: true,
          email: true,
          role: true,
          isAdmin: true,
          isBlocked: true
        }
      });

      return reply.status(200).send({
        botOwnerId,
        admins: adminUsers,
        moderators: moderatorUsers
      });
    } catch (error) {
      console.error("Failed to fetch permissions:", error);
      return reply.status(500).send({ 
        success: false, 
        error: "Failed to fetch permissions." 
      });
    }
  });

  apiServer.get("/api/analytics", async (request, reply) => {
    try {
      const totalCommands = await prisma.analyticsEvent.count({
        where: { eventName: 'command_used' },
      });

      const topCommands = await prisma.analyticsEvent.groupBy({
        by: ['commandName'],
        _count: {
          commandName: true,
        },
        where: { eventName: 'command_used', commandName: { not: null } },
        orderBy: {
          _count: {
            commandName: 'desc',
          },
        },
        take: 5,
      });

      const topUsers = await prisma.analyticsEvent.groupBy({
        by: ['userId'],
        _count: {
          userId: true,
        },
        where: { eventName: 'command_used' },
        orderBy: {
          _count: {
            userId: 'desc',
          },
        },
        take: 5,
      });

      const topGuilds = await prisma.analyticsEvent.groupBy({
        by: ['guildId'],
        _count: {
          guildId: true,
        },
        where: { eventName: 'command_used', guildId: { not: null } },
        orderBy: {
          _count: {
            guildId: 'desc',
          },
        },
        take: 5,
      });

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const dailyUsage = await prisma.analyticsEvent.groupBy({
        by: ['createdAt'],
        _count: {
          _all: true,
        },
        where: {
          eventName: 'command_used',
          createdAt: {
            gte: sevenDaysAgo,
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
      });

      // This is a simplified version. A real implementation might need to group by day part of the date.
      const formattedDailyUsage = dailyUsage.map(d => ({
        date: d.createdAt.toISOString().split('T')[0],
        count: d._count._all
      })).reduce((acc, curr) => {
        const existing = acc.find(item => item.date === curr.date);
        if (existing) {
            existing.count += curr.count;
        } else {
            acc.push({ date: curr.date, count: curr.count });
        }
        return acc;
      }, [] as { date: string; count: number }[]);

      return reply.status(200).send({
        totalCommands,
        topCommands: topCommands.map(c => ({ name: c.commandName, count: c._count.commandName })),
        topUsers: topUsers.map(u => ({ id: u.userId, count: u._count.userId })),
        topGuilds: topGuilds.map(g => ({ id: g.guildId, count: g._count.guildId })),
        dailyUsage: formattedDailyUsage,
      });

    } catch (error) {
      console.error("Failed to fetch analytics:", error);
      return reply.status(500).send({ success: false, error: "Failed to fetch analytics." });
    }
  });

  apiServer.get("/api/stats", async (request, reply) => {
    try {
      const totalServers = harmonix.client.guilds.size;
      const totalMembers = harmonix.client.guilds.reduce((acc, guild) => acc + guild.memberCount, 0);
      
      const activeUsersResult = await prisma.analyticsEvent.groupBy({
        by: ['userId'],
        where: { eventName: 'command_used' },
      });
      const activeUsers = activeUsersResult.length;

      const totalCommands = harmonix.commands.size;

      return reply.status(200).send({
        totalServers,
        totalMembers,
        activeUsers,
        totalCommands,
      });
    } catch (error) {
      console.error("Failed to fetch stats:", error);
      return reply.status(500).send({ success: false, error: "Failed to fetch stats." });
    }
  });

  apiServer.post("/api/users/:userId", async (request, reply) => {
    const { userId } = request.params as { userId: string };
    const { isAdmin, isBlocked } = request.body as { isAdmin?: boolean; isBlocked?: boolean };

    try {
      const updatedUser = await prisma.user.upsert({
        where: { id: userId },
        update: {
          isAdmin,
          isBlocked,
        },
        create: {
          id: userId,
          isAdmin: isAdmin ?? false,
          isBlocked: isBlocked ?? false,
        }
      });
      return reply.status(200).send({ success: true, user: updatedUser });
    } catch (error) {
      console.error(`Failed to update user ${userId}:`, error);
      return reply.status(500).send({ success: false, error: "Database update failed." });
    }
  });

  // WebSocket endpoint for real-time updates
  // @fastify/websocket passes the raw ws WebSocket as the first argument (not { socket }).
  apiServer.get('/ws', { websocket: true }, async (socket, request) => {
    try {
      const url = new URL(request.url, `http://${request.headers.host}`);
      const token = url.searchParams.get('token');
      
      if (!token) {
        socket.close(1008, 'Authentication token required');
        return;
      }

      // Verify JWT token
      const secret = process.env.NEXTAUTH_SECRET || 'hRCQDZSUh41PXtmK2pid0-LuFtNsUYZ0';
      const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
      
      if (!payload || typeof payload !== 'object' || !('user' in payload)) {
        socket.close(1008, 'Invalid token');
        return;
      }

      const user = (payload as any).user;
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { role: true, discordId: true },
      });

      if (!dbUser) {
        socket.close(1008, 'User not found');
        return;
      }

      const isOwner = dbUser.discordId === config.ownerId;
      const userRole = isOwner ? 3 : dbUser.role;

      // Subscribe to events based on role
      const subscriptions: Array<{ event: string; handler: Function }> = [];

      const safeSend = (payloadStr: string) => {
        if (socket.readyState === 1 /* WebSocket.OPEN */) {
          socket.send(payloadStr);
        }
      };

      // All authenticated users get these
      const flagsHandler = (data: any) => {
        safeSend(JSON.stringify({ event: 'flags:changed', data }));
      };
      bus.onTyped('flags:changed', flagsHandler);
      subscriptions.push({ event: 'flags:changed', handler: flagsHandler });

      const guildHandler = (data: any) => {
        safeSend(JSON.stringify({ event: 'guildSettings:changed', data }));
      };
      bus.onTyped('guildSettings:changed', guildHandler);
      subscriptions.push({ event: 'guildSettings:changed', handler: guildHandler });

      const cmdReloadHandler = (data: any) => {
        safeSend(JSON.stringify({ event: 'commands:reload', data }));
      };
      bus.onTyped('commands:reload', cmdReloadHandler);
      subscriptions.push({ event: 'commands:reload', handler: cmdReloadHandler });

      const modHandler = (data: any) => {
        safeSend(JSON.stringify({ event: 'moderation:action', data }));
      };
      bus.onTyped('moderation:action', modHandler);
      subscriptions.push({ event: 'moderation:action', handler: modHandler });

      // Admin+ (role >= 1) gets audit logs
      if (userRole >= 1 || isOwner) {
        const auditHandler = (data: any) => {
          safeSend(JSON.stringify({ event: 'audit:new', data }));
        };
        bus.onTyped('audit:new', auditHandler);
        subscriptions.push({ event: 'audit:new', handler: auditHandler });
      }

      // Owner gets live logs
      if (isOwner) {
        const logHandler = (data: any) => {
          safeSend(JSON.stringify({ event: 'log:new', data }));
        };
        bus.onTyped('log:new', logHandler);
        subscriptions.push({ event: 'log:new', handler: logHandler });
      }

      // Cleanup on disconnect
      socket.on('close', () => {
        subscriptions.forEach(sub => {
          bus.offTyped(sub.event as any, sub.handler as any);
        });
      });

      debug.log(`WebSocket connection established for user ${user.id} (role: ${userRole})`);
    } catch (error) {
      debug.error('WebSocket connection error:', error);
      try {
        socket.close(1011, 'Internal server error');
      } catch {
        /* ignore */
      }
    }
  });

  // Guild settings endpoints
  apiServer.get('/api/servers/:serverId/settings', async (request, reply) => {
    const { serverId } = request.params as { serverId: string };
    try {
      const settings = await prisma.guildSettings.findUnique({
        where: { guildId: serverId },
      });
      return reply.status(200).send(settings || { guildId: serverId });
    } catch (error) {
      debug.error('Failed to fetch guild settings:', error);
      return reply.status(500).send({ error: 'Failed to fetch settings' });
    }
  });

  apiServer.put('/api/servers/:serverId/settings', async (request, reply) => {
    const { serverId } = request.params as { serverId: string };
    const settings = request.body as any;

    const permCheck = await requireRole(request as any, reply, 1);
    if (permCheck) return permCheck;

    try {
      const updated = await prisma.guildSettings.upsert({
        where: { guildId: serverId },
        update: settings,
        create: { guildId: serverId, ...settings, disabledChannels: '[]' },
      });

      bus.emitTyped('guildSettings:changed', {
        guildId: serverId,
        settings: updated,
        changedBy: 'dashboard',
      });

      invalidateGuildCache(serverId);
      return reply.status(200).send(updated);
    } catch (error) {
      debug.error('Failed to update guild settings:', error);
      return reply.status(500).send({ error: 'Failed to update settings' });
    }
  });

  // Feature flags (DB-primary with config.json fallback)
  apiServer.post('/api/featureflags', async (request, reply) => {
    const permCheck = await requireRole(request as any, reply, 2);
    if (permCheck) return permCheck;

    const newFlags = request.body as any;

    try {
      // Update DB
      const flagEntries = Object.entries(newFlags);
      for (const [key, value] of flagEntries) {
        await prisma.featureFlag.upsert({
          where: { key },
          update: { value: JSON.stringify(value) },
          create: { key, value: JSON.stringify(value) },
        });
      }

      // Sync to config.json as failsafe
      const configPath = path.join(__dirname, 'config.json');
      const currentConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      currentConfig.featureFlags = { ...currentConfig.featureFlags, ...newFlags };
      
      const tempPath = configPath + '.tmp';
      fs.writeFileSync(tempPath, JSON.stringify(currentConfig, null, 2));
      fs.renameSync(tempPath, configPath);

      // Emit event for hot reload
      bus.emitTyped('flags:changed', { flags: newFlags, changedBy: 'dashboard' });

      return reply.status(200).send({ 
        success: true, 
        message: 'Flags updated successfully. Changes applied immediately.' 
      });
    } catch (error) {
      debug.error('Failed to update feature flags:', error);
      return reply.status(500).send({ success: false, error: 'Failed to update flags' });
    }
  });

  // Moderation endpoints
  apiServer.post('/api/servers/:serverId/moderation/kick', async (request, reply) => {
    const { serverId } = request.params as { serverId: string };
    const { userId, reason } = request.body as { userId: string; reason?: string };

    const permCheck = await requireRole(request as any, reply, 1);
    if (permCheck) return permCheck;

    try {
      await harmonix.client.kickGuildMember(serverId, userId, reason);
      
      await prisma.auditLog.create({
        data: {
          actorId: request.user?.id || 'unknown',
          action: 'kick',
          target: userId,
          guildId: serverId,
          metadata: JSON.stringify({ reason }),
        },
      });

      bus.emitTyped('moderation:action', {
        guildId: serverId,
        action: 'kick',
        targetId: userId,
        actorId: request.user?.id || 'unknown',
        reason,
      });

      return reply.status(200).send({ success: true });
    } catch (error) {
      debug.error('Kick failed:', error);
      return reply.status(500).send({ error: 'Failed to kick member' });
    }
  });

  apiServer.post('/api/servers/:serverId/moderation/ban', async (request, reply) => {
    const { serverId } = request.params as { serverId: string };
    const { userId, deleteMessageDays = 0, reason } = request.body as { 
      userId: string; 
      deleteMessageDays?: number; 
      reason?: string 
    };

    const permCheck = await requireRole(request as any, reply, 2);
    if (permCheck) return permCheck;

    try {
      await harmonix.client.banGuildMember(serverId, userId, deleteMessageDays, reason);
      
      await prisma.auditLog.create({
        data: {
          actorId: request.user?.id || 'unknown',
          action: 'ban',
          target: userId,
          guildId: serverId,
          metadata: JSON.stringify({ reason, deleteMessageDays }),
        },
      });

      bus.emitTyped('moderation:action', {
        guildId: serverId,
        action: 'ban',
        targetId: userId,
        actorId: request.user?.id || 'unknown',
        reason,
      });

      return reply.status(200).send({ success: true });
    } catch (error) {
      debug.error('Ban failed:', error);
      return reply.status(500).send({ error: 'Failed to ban member' });
    }
  });

  apiServer.post('/api/servers/:serverId/moderation/timeout', async (request, reply) => {
    const { serverId } = request.params as { serverId: string };
    const { userId, seconds, reason } = request.body as { 
      userId: string; 
      seconds: number; 
      reason?: string 
    };

    const permCheck = await requireRole(request as any, reply, 1);
    if (permCheck) return permCheck;

    try {
      const timeoutUntil = Date.now() + (seconds * 1000);
      await harmonix.client.editGuildMember(serverId, userId, {
        communicationDisabledUntil: new Date(timeoutUntil).toISOString(),
      });
      
      await prisma.auditLog.create({
        data: {
          actorId: request.user?.id || 'unknown',
          action: 'timeout',
          target: userId,
          guildId: serverId,
          metadata: JSON.stringify({ reason, seconds }),
        },
      });

      bus.emitTyped('moderation:action', {
        guildId: serverId,
        action: 'timeout',
        targetId: userId,
        actorId: request.user?.id || 'unknown',
        reason,
      });

      return reply.status(200).send({ success: true });
    } catch (error) {
      debug.error('Timeout failed:', error);
      return reply.status(500).send({ error: 'Failed to timeout member' });
    }
  });

  // Owner-only endpoints
  apiServer.get('/api/owner/logs', async (request, reply) => {
    const permCheck = await requireRole(request as any, reply, 3);
    if (permCheck) return permCheck;

    const { since, limit = '200' } = request.query as { since?: string; limit?: string };

    try {
      const logs = await prisma.botLog.findMany({
        where: since ? {
          createdAt: { gte: new Date(since) },
        } : undefined,
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit),
      });

      return reply.status(200).send(logs);
    } catch (error) {
      debug.error('Failed to fetch logs:', error);
      return reply.status(500).send({ error: 'Failed to fetch logs' });
    }
  });

  apiServer.get('/api/owner/audit', async (request, reply) => {
    const permCheck = await requireRole(request as any, reply, 3);
    if (permCheck) return permCheck;

    const { limit = '200' } = request.query as { limit?: string };

    try {
      const logs = await prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit),
      });

      return reply.status(200).send(logs);
    } catch (error) {
      debug.error('Failed to fetch audit log:', error);
      return reply.status(500).send({ error: 'Failed to fetch audit log' });
    }
  });

  apiServer.post('/api/owner/commands/reload', async (request, reply) => {
    const permCheck = await requireRole(request as any, reply, 3);
    if (permCheck) return permCheck;

    const { name } = request.body as { name?: string };

    try {
      if (name) {
        // Reload specific command
        const files = await globby([
          path.join(harmonix.options.dirs.commands, `**/${name}.ts`),
        ]);
        if (files.length > 0) {
          unloadCommand(harmonix, name);
          await loadCommandFromFile(harmonix, files[0]);
        }
      } else {
        // Reload all commands
        harmonix.commands.clear();
        harmonix.slashCommands.clear();
        const { loadCommands } = await import('./core');
        await loadCommands(harmonix);
      }

      bus.emitTyped('commands:reload', { action: 'reload', commandName: name });
      return reply.status(200).send({ success: true });
    } catch (error) {
      debug.error('Command reload failed:', error);
      return reply.status(500).send({ error: 'Failed to reload commands' });
    }
  });

  // Catch-all route: proxy non-API requests to Next.js dashboard
  // Only handle specific methods to avoid conflict with CORS OPTIONS preflight
  // Note: HEAD is auto-registered with GET, so we don't register it separately
  apiServer.get('/*', proxyToDashboard);
  apiServer.post('/*', proxyToDashboard);
  apiServer.put('/*', proxyToDashboard);
  apiServer.delete('/*', proxyToDashboard);
  apiServer.patch('/*', proxyToDashboard);

  function proxyToDashboard(request: FastifyRequest, reply: FastifyReply) {
    const url = request.url;
    
    // Don't proxy API routes
    if (url.startsWith('/api/') || url === '/ws') {
      return reply.status(404).send({ error: 'Not found' });
    }

    // Proxy to Next.js dashboard
    try {
      const nextUrl = `http://localhost:3000${url}`;
      const proxyReq = http.request(nextUrl, {
        method: request.method,
        headers: {
          ...request.headers,
          host: 'localhost:3000',
        },
      }, (proxyRes) => {
        reply.status(proxyRes.statusCode || 200);
        
        // Copy headers from proxy response
        for (const [key, value] of Object.entries(proxyRes.headers)) {
          if (value) reply.header(key, value);
        }
        
        proxyRes.pipe(reply.raw);
      });

      proxyReq.on('error', (err) => {
        debug.error('Proxy error:', err);
        reply.status(502).send({ error: 'Dashboard unavailable' });
      });

      // Pipe request body to proxy
      if (request.body) {
        proxyReq.write(JSON.stringify(request.body));
      }
      proxyReq.end();
    } catch (error) {
      debug.error('Proxy failed:', error);
      reply.status(502).send({ error: 'Failed to proxy to dashboard' });
    }
  }

  // Error handling for API server
  apiServer.setErrorHandler((error, request, reply) => {
    console.error(error);
    reply.status(500).send({ error: "Internal Server Error" });
  });

  // Start the Next.js dashboard server
  try {
    // Verify dashboard has required files before attempting to start
    const dashboardPackageJson = path.join(dashboardPath, 'package.json');
    if (!fs.existsSync(dashboardPackageJson)) {
      debug.warn(`Dashboard package.json not found at ${dashboardPackageJson}, skipping dashboard startup`);
      console.warn('⚠ Dashboard not found - API server will run without dashboard UI');
    } else {
      const npmPath = process.platform === 'win32' ? 'npm.cmd' : 'npm';
      const nextProcess = spawn(npmPath, ["run", "dev"], {
        cwd: dashboardPath,
        stdio: "inherit",
        shell: true
      });
      
      nextProcess.on("error", (err) => {
        console.error("Failed to start Next.js process:", err);
      });
      
      nextProcess.on("exit", (code) => {
        if (code !== 0 && code !== null) {
          console.error(`Next.js dashboard exited with code ${code}`);
        }
      });
      
      console.log("> Next.js dashboard starting...");
    }
  } catch (error) {
    debug.error('Failed to start dashboard:', error);
    console.warn('⚠ Failed to start dashboard - API server will continue without UI');
  }

  // Start the API server
  const port = process.env.PORT ? parseInt(process.env.PORT) : 3001;
  const host = process.env.HOST || '0.0.0.0';
  
  try {
    debug.log(`Starting server on ${host}:${port}...`);
    await apiServer.listen({ port, host });
    
    debug.info(`API server listening on http://${host}:${port}`);
    debug.info('Server ready to handle requests');
    isServerInitialized = true;
    
    // Log all registered routes
    if (debug.enabled) {
      debug.log('Registered routes:');
      
      const routes = apiServer.printRoutes();
      // Split by newline and log each route individually for better formatting
      if (typeof routes === 'string') {
        routes.split('\n').forEach(route => route.trim() && debug.log(route));
      } else {
        debug.log('No routes found or could not print routes');
      }
    }
  } catch (err) {
    debug.error('Error starting server:', err);
    process.exit(1);
  }
}

function keepAlive() {
  return new Promise<void>((resolve, reject) => {
    setupServer({} as Harmonix) // Pass a mock Harmonix object for testing
      .then(() => {
        console.log("Servers are Ready!");
        resolve();
      })
      .catch((err) => {
        console.error("Error starting servers:", err);
        reject(err);
      });
  });
}

export default keepAlive;
