import Fastify, { FastifyRequest, FastifyReply, FastifyInstance } from "fastify";
import fastifyRequestLogger from '@fastify/request-context';
import { Harmonix } from "../discordkit/types/harmonixtypes";
import { Guild } from "eris";
import fs from "fs";
import path from "path";
import cors from "@fastify/cors";
import { spawn } from "child_process";
import { prisma } from "./lib/db";
import { resolve } from "path";

const dev = process.env.NODE_ENV !== "production";
const dashboardPath = resolve(process.cwd(), "..", "dashboard");

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
  console.error(`Dashboard folder not found at ${dashboardPath}`);
  throw new Error(`Dashboard folder not found at ${dashboardPath}`);
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

  apiServer.post("/api/featureflags", async (request, reply) => {
    const newFlags = request.body as Harmonix['options']['featureFlags'];

    try {
      // Read the current config file
      const configPath = path.join(__dirname, '..', '..', 'config.json');
      const currentConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

      // Update the feature flags
      currentConfig.featureFlags = newFlags;

      // Write the updated config back to the file
      fs.writeFileSync(configPath, JSON.stringify(currentConfig, null, 2));

      // It's important to let the user know a restart is needed
      return reply.status(200).send({ success: true, message: 'Flags updated. Please restart the bot for changes to take effect.' });

    } catch (error) {
      console.error('Failed to update feature flags:', error);
      return reply.status(500).send({ success: false, error: 'Failed to write to config file.' });
    }
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
          username: user.name || 'User',
          discriminator: '', // Discord no longer uses discriminators
          avatar: user.image || null,
          email: user.email || null,
          isAdmin: user.isAdmin || false,
          isBlocked: user.isBlocked || false,
          createdAt: user.createdAt.toISOString(),
          updatedAt: user.updatedAt.toISOString(),
          guilds: [],
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
            throw new Error('Failed to refresh access token');
          }
        }
        return discordAccount.access_token;
      };

      // Get a valid access token (refreshing if needed)
      let accessToken: string;
      try {
        accessToken = await refreshTokenIfNeeded();
      } catch (error) {
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
      const userInfo = await fetchWithRetry('https://discord.com/api/users/@me', {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });

      // Handle user info response
      if (!userInfo.ok) {
        const errorText = await userInfo.text();
        console.error('Failed to fetch user info from Discord API:', errorText);
        throw new Error('Failed to fetch user info from Discord');
      }

      const discordUser = await userInfo.json();
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
        
        return {
          id: guild.id,
          name: guild.name,
          icon: guild.icon ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png` : null,
          permissions: guild.permissions,
          owner: guild.owner || false,
          permissions_new: isAdmin ? 'ADMINISTRATOR' : 'MEMBER',
          features: guild.features || [],
          hasBot: !!botGuild,
          botJoinedAt: botGuild?.createdAt?.toISOString() || null,
          commandCount: botGuild?.commands?.length || 0,
          isAdmin,
          canManage
        };
      });

      // Sort guilds: servers with the bot first, then by name
      guilds.sort((a, b) => {
        if (a.hasBot !== b.hasBot) {
          return b.hasBot ? 1 : -1;
        }
        return a.name.localeCompare(b.name);
      });

      // Format the response
      const response = {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        isAdmin: user.isAdmin,
        isBlocked: user.isBlocked,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
        guilds: guilds
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
    const server = harmonix.client.guilds.get(serverId);

    if (!server) {
      return reply.status(404).send({ error: "Server not found" });
    }

    return reply.status(200).send({
      id: server.id,
      name: server.name,
      memberCount: server.memberCount,
      iconUrl: server.iconURL,
      channelCount: server.channels.size,
      roleCount: server.roles.size,
      createdAt: server.createdAt,
    });
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

  // Error handling for API server
  apiServer.setErrorHandler((error, request, reply) => {
    console.error(error);
    reply.status(500).send({ error: "Internal Server Error" });
  });

  // Start the Next.js dashboard server
  const npmPath = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const nextProcess = spawn(npmPath, ["run", "dev"], {
    cwd: dashboardPath,
    stdio: "inherit",
    shell: true
  });
  nextProcess.on("error", (err) => {
    console.error("Failed to start Next.js process:", err);
  });
  console.log("> Next.js dashboard starting...");

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
