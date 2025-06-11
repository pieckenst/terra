import Fastify from "fastify";
import { Harmonix } from "../discordkit/types/harmonixtypes";
import { Guild } from "eris";
import fs from "fs";
import path from "path";
import cors from "@fastify/cors";
import { spawn } from "child_process";

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
