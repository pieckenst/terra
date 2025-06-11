import Fastify from "fastify";
import { Harmonix } from "../discordkit/types/harmonixtypes";
import { Guild } from "eris";
import fs from "fs";
import path from "path";
import cors from "@fastify/cors";
import { spawn } from "child_process";
import { prisma } from "./lib/db";

const dev = process.env.NODE_ENV !== "production";
import { resolve } from "path";
const dashboardPath = resolve(process.cwd(), "..", "dashboard");

// Read and parse config.json
const configPath = path.join(__dirname, "config.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

if (config.debug) {
  // Debug logging for Next.js paths
  console.log("Current working directory:", process.cwd());
  console.log("Dashboard path:", dashboardPath);
  console.log("Contents of dashboard directory:");
  fs.readdirSync(dashboardPath).forEach((file) => {
    console.log(file);
  });

  // Check for 'pages' and 'app' directories
  const pagesDir = path.join(dashboardPath, "pages");
  const appDir = path.join(dashboardPath, "app");
  console.log("Pages directory exists:", fs.existsSync(pagesDir));
  console.log("App directory exists:", fs.existsSync(appDir));
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

const apiServer = Fastify();

export async function setupServer(harmonix: Harmonix) {
  // Enable CORS for API server
  await apiServer.register(cors, {
    origin: ["http://localhost:3000", "http://localhost:3001"],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  });

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
        }
      });

      const usersWithDetails = await Promise.all(
        dbUsers.map(async (user) => {
          try {
            const discordUser = await harmonix.client.getRESTUser(user.id);
            return {
              ...user,
              username: discordUser.username,
              discriminator: discordUser.discriminator,
              avatarUrl: discordUser.avatarURL,
            };
          } catch (e) {
            return {
              ...user,
              username: "Unknown User",
              discriminator: "0000",
              avatarUrl: null,
            };
          }
        })
      );
      return reply.status(200).send(usersWithDetails);
    } catch (error) {
      console.error("Failed to fetch users:", error);
      return reply.status(500).send({ success: false, error: "Failed to fetch users." });
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
  try {
    await apiServer.listen({ port: 3001 });
    console.log("> API server ready on http://localhost:3001");
  } catch (err) {
    console.error("Error starting API server:", err);
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
