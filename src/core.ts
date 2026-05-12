import Eris, {
  Message,
  TextableChannel,
  Constants,
  EmbedOptions,
  CommandInteraction,
  ClientEvents,
} from "eris";
import { Collection } from "eris";
import dotenv from "dotenv";
import { resolve as pathResolve, isAbsolute as pathIsAbsolute } from "path";
import { readFileSync, existsSync } from "fs";
import consola from "consola";
import { colors } from "consola/utils";
import { watch } from "chokidar";
import { debounce } from "perfect-debounce";
import { globby } from "globby";
import stringWidth from "string-width";
import path from "path";
import art from "ascii-art";
import Table from "cli-table3";
import { Manager } from "erela.js";
import Spotify from "erela.js-spotify";
import { Effect, Console, Data } from "effect";
import {
  ConfigError,
  TokenError,
  HarmonixOptions,
  HarmonixCommand,
  HarmonixEvent,
} from "../discordkit/types/harmonixtypes";
import type { Harmonix } from "../discordkit/types/harmonixtypes";
import { ApplicationCommand } from "eris";
import { logError } from "../discordkit/utils/centralloggingfactory";
import { exec } from "child_process";
import { bus } from './lib/events';
import { prisma } from './lib/db';
import knex from "knex";
import { setupServer as setupFastifyServer } from "./server";
import {
  ClientGen,
  ClientBuilder,
  ClientConfig,
} from "../discordkit/utils/ClientGen";
async function setupServer(harmonix: Harmonix): Promise<void> {
  try {
    await setupFastifyServer(harmonix);
    consola.success(colors.green("Dashboard server started successfully"));
  } catch (error) {
    consola.error(colors.red("Failed to start dashboard server:"), error);
    throw error; // Re-throw to allow main error handling to catch it
  }
}
// Load configuration
const loadConfig = Effect.tryPromise({
  try: async (): Promise<HarmonixOptions> => {
    // Robust config path resolution
    const candidates = [
      pathResolve(__dirname, "config.json"), // Relative to this file (core.ts in src/)
      pathResolve(process.cwd(), "config.json"), // Relative to cwd
      pathResolve(process.cwd(), "src", "config.json"), // Relative to src/ subdirectory
    ];

    let configPath: string | null = null;
    for (const candidate of candidates) {
      try {
        await import('fs').then(fs => fs.promises.access(candidate));
        configPath = candidate;
        break;
      } catch {
        // Try next candidate
      }
    }

    if (!configPath) {
      const errorMsg = `Config file not found. Tried:\n${candidates.map(c => `  - ${c}`).join('\n')}`;
      consola.error(colors.red(errorMsg));
      throw new ConfigError(errorMsg);
    }
    
    consola.info(colors.yellow(` Loading configuration from: ${configPath}`));
    let configFile: string;
    try {
      configFile = readFileSync(configPath, "utf-8");
    } catch (error) {
      consola.error(colors.red(`Failed to read config file: ${error.message}`));
      consola.error(colors.red(`Stack trace:\n${error.stack}`));
      throw new ConfigError(`Failed to read config file: ${error.message}`);
    }

    let config: HarmonixOptions;
    try {
      config = JSON.parse(configFile);
    } catch (error) {
      consola.error(
        colors.red(`Failed to parse config file: ${error.message}`),
      );
      consola.error(colors.red(`Stack trace:\n${error.stack}`));
      throw new ConfigError(`Failed to parse config file: ${error.message}`);
    }

    // Resolve directory paths relative to config file location
    const configDir = pathResolve(configPath, '..');
    if (config.dirs) {
      for (const [key, value] of Object.entries(config.dirs)) {
        if (typeof value === 'string') {
          // Convert relative paths to absolute paths based on config file location
          if (!pathIsAbsolute(value)) {
            config.dirs[key] = pathResolve(configDir, value);
            if (config.debug) {
              consola.debug(`Resolved ${key} directory: ${config.dirs[key]}`);
            }
          }
        }
      }
    }

    const requiredFields = [
      "prefix",
      "dirs",
      "clientID",
      "clientSecret",
      "host",
      "port",
      "password",
    ];
    const missingFields = requiredFields.filter((field) => !(field in config));

    if (missingFields.length > 0) {
      consola.warn(
        colors.yellow(
          `Warning: Missing fields in config: ${missingFields.join(", ")}`,
        ),
      );
      missingFields.forEach((field) => {
        switch (field) {
          case "prefix":
            config.prefix = "!";
            break;
          case "dirs":
            config.dirs = { commands: "./commands", events: "./events" };
            break;
          case "clientID":
          case "clientSecret":
          case "host":
          case "password":
            config[field] = "";
            break;
          case "port":
            config.port = 0;
            break;
        }
      });
    }

    if (!config.featureFlags) {
      config.featureFlags = {
        useDiscordJS: false,
        disabledCommands: [],
        betaCommands: [],
        useDatabase: "none",
      };
      consola.warn(
        colors.yellow(
          "Warning: featureFlags not found in config, using default values",
        ),
      );
    }

    return config;
  },
  catch: (error: unknown) => {
    consola.error(
      colors.red(
        `Failed to load config: ${error instanceof Error ? error.message : String(error)}`,
      ),
    );
    if (error instanceof Error && error.stack) {
      consola.error(colors.red(`Stack trace:\n${error.stack}`));
    }
    return new ConfigError(
      `Failed to load config: ${error instanceof Error ? error.message : String(error)}`,
    );
  },
});

/** Load `.env` then `.env.local` (overrides) from `src/`, cwd, and `cwd/src`. */
function loadEnvFiles(): void {
  const dirs = [
    path.resolve(__dirname),
    path.resolve(process.cwd()),
    path.join(process.cwd(), "src"),
  ];
  const seen = new Set<string>();
  for (const dir of dirs) {
    const base = path.resolve(dir);
    if (seen.has(base)) continue;
    seen.add(base);
    const envFile = path.join(base, ".env");
    const localFile = path.join(base, ".env.local");
    if (existsSync(envFile)) {
      dotenv.config({ path: envFile });
    }
    if (existsSync(localFile)) {
      dotenv.config({ path: localFile, override: true });
    }
  }
}

// Load token from .env
const loadToken = Effect.gen(function* (_) {
  yield* Effect.tryPromise({
    try: async () => {
      loadEnvFiles();
      if (!process.env.NEXTAUTH_SECRET) {
        consola.warn(
          colors.yellow(
            "NEXTAUTH_SECRET is not set in .env. Set it in src/.env (same value as dashboard) so API/WebSocket JWT auth works.",
          ),
        );
      }
    },
    catch: (error) =>
      new TokenError(
        `Failed to load .env: ${error instanceof Error ? error.message : String(error)}`,
      ),
  });

  const token = process.env.token;
  if (!token) {
    yield* Effect.fail(new TokenError("Token not found in .env file"));
  }
  return token;
});

const initDatabase = Effect.gen(function* (_) {
  const config = yield* _(loadConfig);
  if (config.featureFlags?.useDatabase === "prisma") {
    consola.info(colors.yellow("Using Prisma for database operations."));
    
    try {
      // Try to run migrations, but don't crash if they fail
      yield* _(
        Effect.tryPromise({
          try: () =>
            new Promise<void>((resolve, reject) => {
              // Prisma 7.x needs to run from src/ directory where prisma.config.ts is located
              const srcDir = __dirname;
              exec("npx prisma migrate deploy", { cwd: srcDir }, (error, stdout, stderr) => {
                if (error) {
                  consola.warn(
                    colors.yellow(`Prisma migration warning: ${error.message}`),
                  );
                  // Don't reject - allow bot to continue with existing schema
                }
                if (stderr) {
                  consola.info(colors.cyan(`Prisma: ${stderr}`));
                }
                if (stdout) {
                  consola.success(colors.green(`Prisma: ${stdout}`));
                }
                resolve(); // Always resolve - migrations are best-effort
              });
            }),
          catch: (e) => {
            consola.warn(
              colors.yellow(`Prisma migration skipped (will use existing schema): ${e}`),
            );
            return null; // Return null to allow continuation
          },
        }),
      );
    } catch (error) {
      consola.warn(
        colors.yellow("Prisma initialization failed - bot will continue with existing database schema"),
      );
    }
    
    return null;
  }
  if (config.featureFlags?.useDatabase === "sqlite") {
    return knex({
      client: "sqlite3",
      connection: {
        filename: "./mydb.sqlite",
      },
      useNullAsDefault: true,
    });
  } else if (config.featureFlags?.useDatabase === "postgres") {
    return knex({
      client: "pg",
      connection: {
        host: "localhost",
        user: "your_database_user",
        password: "your_database_password",
        database: "myapp_database",
      },
    });
  }
  return null;
});
async function setupListeners(harmonix: Harmonix): Promise<void> {
  consola.info(colors.cyan("Setting up event listeners..."));

  // Set up ready event listener
  harmonix.client.on("ready", () => {
    const readyEvent = harmonix.events.get("ready");
    if (readyEvent && "execute" in readyEvent) {
      readyEvent.execute(harmonix);
    }
  });

  // Set up messageCreate event listener
  harmonix.client.on("messageCreate", (msg) => {
    const messageCreateEvent = harmonix.events.get("messageCreate");
    if (messageCreateEvent && "execute" in messageCreateEvent) {
      messageCreateEvent.execute(harmonix, msg);
    }
  });

  // Set up interactionCreate event listener
  harmonix.client.on("interactionCreate", (interaction) => {
    const interactionCreateEvent = harmonix.events.get("interactionCreate");
    if (interactionCreateEvent && "execute" in interactionCreateEvent) {
      interactionCreateEvent.execute(harmonix, interaction);
    }
  });

  consola.success(colors.green("Event listeners set up successfully."));
}

async function startClient(
  harmonix: Harmonix,
): Promise<Effect.Effect<void, Error, never>> {
  return Effect.tryPromise(async () => {
    consola.info(colors.cyan("Starting client..."));

    try {
      await harmonix.client.connect();
      consola.success(colors.green("Client connected successfully."));
    } catch (error) {
      consola.error(
        colors.red(
          `Failed to connect client: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
      throw error;
    }
  });
}

class TerraClient extends ClientGen {
  static defineClientStart(): ClientBuilder {
    return {
      buildClient: (
        config: ClientConfig,
      ): Effect.Effect<Harmonix, Error, never> => {
        return Effect.tryPromise({
          try: async () => {
            if (!Eris.Client) {
              throw new Error(
                "Eris.Client is undefined. Make sure Eris is properly imported.",
              );
            }
            const client = new Eris.Client(config.token, {
              intents: config.intents || [],
              restMode: true,
            });

            const manager = new Manager({
              plugins: [
                new Spotify({
                  clientID: config.options.clientID,
                  clientSecret: config.options.clientSecret,
                }),
              ],
              nodes: [
                {
                  host: config.options.host,
                  port: config.options.port,
                  password: config.options.password,
                  retryDelay: 5000,
                },
              ],
              autoPlay: true,
              send: (id, payload) => {
                const guild = client.guilds.get(id);
                if (guild) guild.shard.sendWS(payload.op, payload.d);
              },
            });

            return {
              client,
              options: config.options,
              commands: new Eris.Collection(),
              slashCommands: new Eris.Collection(),
              events: new Eris.Collection(),
              startTime: new Date(),
              manager,
            } as Harmonix;
          },
          catch: (error: unknown) => {
            console.error("Error in TerraClient.buildClient:", error);
            if (error instanceof Error) {
              console.error("Error stack:", error.stack);
            }
            return new Error(
              `Failed to build client: ${error instanceof Error ? error.message : String(error)}`,
            );
          },
        });
      },
    };
  }

  static initializeClient = (
    config: ClientConfig,
  ): Effect.Effect<Harmonix, Error, never> => {
    return Effect.gen(function* (_) {
      const clientBuilder = TerraClient.defineClientStart();
      const harmonix = yield* _(clientBuilder.buildClient(config));
      if (harmonix.options.debug) {
        console.debug("Debug: Harmonix client built");
      }
      return harmonix;
    });
  };

  static loadCommands = (
    harmonix: Harmonix,
  ): Effect.Effect<void, Error, never> =>
    Effect.tryPromise(() => loadCommands(harmonix));

  static loadEvents = (harmonix: Harmonix): Effect.Effect<void, Error, never> =>
    Effect.tryPromise(() => loadEvents(harmonix));

  static setupListeners = (
    harmonix: Harmonix,
  ): Effect.Effect<void, Error, never> =>
    Effect.tryPromise(() => setupListeners(harmonix));

  static startClient = (
    harmonix: Harmonix,
  ): Effect.Effect<void, Error, never> =>
    Effect.tryPromise(async () => {
      await harmonix.client.connect();
      if (harmonix.options.debug) {
        console.debug("Debug: Client connected successfully");
      }
    });
}

async function initHarmonix(): Promise<Harmonix> {
  try {
    console.log("Starting Harmonix initialization");
    const config = await Effect.runPromise(loadConfig);
    const token = await Effect.runPromise(loadToken);
    const database = await Effect.runPromise(initDatabase);

    const clientConfig: ClientConfig = {
      options: { ...config, token, database },
      featureFlags: config.featureFlags,
      token,
      intents: [
        "guilds",
        "guildMessages",
        "guildMessageReactions",
        "directMessages",
        "directMessageReactions",
        "guildVoiceStates",
      ],
    };

    const harmonix = await Effect.runPromise(
      TerraClient.initializeClient(clientConfig),
    );

    if (harmonix.options.debug) {
      console.log("Debug: Initializing client");
    }

    try {
      await Effect.runPromise(TerraClient.loadCommands(harmonix));
      if (harmonix.options.debug) {
        console.log("Debug: Loading commands");
      }
    } catch (error) {
      console.error("Error loading commands:", error);
      if (error instanceof Error) {
        console.error("Stack trace:", error.stack);
      }
    }

    await Effect.runPromise(TerraClient.loadEvents(harmonix));
    if (harmonix.options.debug) {
      console.log("Debug: Loading events");
    }

    setupEventListeners(harmonix);
    if (harmonix.options.debug) {
      console.log("Debug: Setting up event listeners");
    }

    await Effect.runPromise(TerraClient.startClient(harmonix));
    if (harmonix.options.debug) {
      console.log("Debug: Starting client");
      console.log("Debug: Harmonix initialization completed");
    }

    return harmonix;
  } catch (error) {
    console.error("Error initializing Harmonix:", error);
    throw error;
  }
}
// Added Effect-based error handling
function initializeManager(harmonix: Harmonix): void {
  Effect.runPromise(
    Effect.tryPromise({
      try: async (signal: AbortSignal) => {
        harmonix.manager
          .on("nodeConnect", (node) =>
            consola.success(
              colors.green(
                `[UPSTART] Node "${node.options.identifier}" has connected.`,
              ),
            ),
          )
          .on("nodeError", (node, error) =>
            consola.error(
              colors.red(
                `[ERROR] Node "${node.options.identifier}" encountered an error: ${error.message}.`,
              ),
            ),
          )
          .on("trackStart", (player, track) => {
            let channel = harmonix.client.getChannel(player.textChannel as any);
            if (channel && "createMessage" in channel) {
              channel
                .createMessage({
                  embeds: [
                    {
                      color: Math.floor(Math.random() * 0xffffff),
                      author: {
                        name: "NOW PLAYING",
                        icon_url: harmonix.client.user.avatarURL || undefined,
                      },
                      description: `[${track.title}](${track.uri})`,
                      fields: [
                        {
                          name: "Requested By",
                          value: (track.requester as { username: string })
                            .username,
                          inline: true,
                        },
                      ],
                    },
                  ],
                })
                .catch((error) =>
                  consola.error(
                    colors.red(
                      `[ERROR] Error sending trackStart message: ${error.message}`,
                    ),
                  ),
                );
            }
          })
          .on("trackStuck", (player, track) => {
            const channel = harmonix.client.getChannel(
              player.textChannel as any,
            );
            if (channel && "createMessage" in channel) {
              channel
                .createMessage({
                  embeds: [
                    {
                      color: Math.floor(Math.random() * 0xffffff),
                      author: {
                        name: "Track Stuck",
                        icon_url: harmonix.client.user.avatarURL || undefined,
                      },
                      description: track.title,
                    },
                  ],
                })
                .catch((error) =>
                  consola.error(
                    colors.red(
                      `[ERROR] Error sending trackStuck message: ${error.message}`,
                    ),
                  ),
                );
            }
          })
          .on("queueEnd", (player) => {
            const channel = harmonix.client.getChannel(
              player.textChannel as any,
            );
            if (channel && "createMessage" in channel) {
              channel
                .createMessage({
                  embeds: [
                    {
                      color: Math.floor(Math.random() * 0xffffff),
                      author: {
                        name: "Queue has ended",
                        icon_url: harmonix.client.user.avatarURL || undefined,
                      },
                    },
                  ],
                })
                .catch((error) =>
                  consola.error(
                    colors.red(
                      `[ERROR] Error sending queueEnd message: ${error.message}`,
                    ),
                  ),
                );
            }
            player.destroy();
          });

        // Return a promise to satisfy the PromiseLike<unknown> return type
        return Promise.resolve();
      },
      catch: (error: Error) =>
        Effect.sync(() =>
          console.error(`Failed to initialize manager: ${error.message}`),
        ),
    }),
  );
}

async function scanFiles(harmonix: Harmonix, dir: string): Promise<string[]> {
  const pattern = "**/*.{js,ts}";
  const files = await globby(pattern, {
    cwd: pathResolve(harmonix.options.dirs[dir]),
    absolute: true,
    deep: Infinity,
  });

  // Debug logging to show folder names where matches were found
  const folderNames = new Set(files.map((file) => path.dirname(file)));
  if (harmonix.options.debug) {
    console.log(`Files found in ${dir}:`, files);
    console.info(
      `[DEBUG] Matches found in folders: ${Array.from(folderNames).join(", ")}`,
    );
  }

  return files;
}

async function loadCommands(harmonix: Harmonix): Promise<void> {
  const files = await scanFiles(harmonix, "commands");
  console.log(`Total command files found: ${files.length}`);

  let loadedRegularCommands = 0;
  let loadedSlashCommands = 0;
  let skippedCommands = 0;
  let loadedFiles = new Set<string>();
  let erroredFiles = new Set<string>();

  const loadCommandsProcess = async () => {
    for (const file of files) {
      if (loadedFiles.has(file) || erroredFiles.has(file)) {
        skippedCommands++;
        continue;
      }

      if (harmonix.options.debug) {
        console.debug(`[DEBUG] Attempting to load command from file: ${file}`);
      }

      try {
        const commandModule = await import(file);
        let command: HarmonixCommand;

        if (
          typeof commandModule.default === "function" &&
          commandModule.default.build
        ) {
          command = commandModule.default.build();
          consola.info(
            colors.cyan(` Command ${file} uses defineCommand structure`),
          );
        } else if (
          typeof commandModule.default === "object" &&
          "execute" in commandModule.default
        ) {
          command = commandModule.default;
          consola.info(
            colors.cyan(` Command ${file} uses regular command structure`),
          );
        } else {
          throw new Error(
            `Invalid command structure in file: ${file}. Please check for incorrect import statements or other issues.`,
          );
        }

        if (
          command &&
          typeof command === "object" &&
          "name" in command &&
          "execute" in command
        ) {
          if (
            harmonix.options.featureFlags?.disabledCommands.includes(
              command.name,
            ) ||
            (harmonix.options.featureFlags?.betaCommands.includes(
              command.name,
            ) &&
              !command.beta)
          ) {
            if (harmonix.options.debug) {
              console.debug(
                `[DEBUG] Skipping ${harmonix.options.featureFlags?.disabledCommands.includes(command.name) ? "disabled" : "non-beta"} command: ${command.name}`,
              );
            }
            skippedCommands++;
            continue;
          }
          const relativePath = path.relative(
            harmonix.options.dirs.commands,
            file,
          );
          const folderPath = path.dirname(relativePath);
          const folderName = folderPath === "." ? "main" : folderPath;

          if (command.slashCommand) {
            harmonix.slashCommands.set(command.name, command);
            consola.info(
              colors.blueBright(`[${folderName}] `) +
                colors.blue(`Loaded slash command: ${command.name}`),
            );
            loadedSlashCommands++;
          } else {
            harmonix.commands.set(command.name, command);
            consola.info(
              colors.blueBright(`[${folderName}] `) +
                colors.blue(`Loaded command: ${command.name}`),
            );
            loadedRegularCommands++;
          }
          loadedFiles.add(file);
        } else {
          throw new Error(
            `Invalid command structure in file: ${file}. Please check for incorrect import statements or other issues.`,
          );
        }
      } catch (error) {
        consola.error(
          colors.red(
            `An error has occurred while loading command from file: ${file}`,
          ),
        );
        consola.error(
          colors.red(
            `Error details: ${error instanceof Error ? error.message : String(error)}`,
          ),
        );
        consola.error(colors.red("Stack trace:"));
        if (error instanceof Error && error.stack) {
          consola.error(colors.red(error.stack));
        }
        erroredFiles.add(file);
      }
    }
  };

  const loadNotFailedCommandsProcess = async () => {
    for (const file of files) {
      if (!loadedFiles.has(file) && !erroredFiles.has(file)) {
        try {
          const commandModule = await import(file);
          let command: HarmonixCommand;

          if (
            typeof commandModule.default === "function" &&
            commandModule.default.build
          ) {
            command = commandModule.default.build();
            consola.info(
              colors.cyan(` Command ${file} uses defineCommand structure`),
            );
          } else if (
            typeof commandModule.default === "object" &&
            "execute" in commandModule.default
          ) {
            command = commandModule.default;
            consola.info(
              colors.cyan(` Command ${file} uses regular command structure`),
            );
          } else {
            throw new Error(
              `Invalid command structure in file: ${file}. Please check for incorrect import statements or other issues.`,
            );
          }

          if (
            command &&
            typeof command === "object" &&
            "name" in command &&
            "execute" in command
          ) {
            const relativePath = path.relative(
              harmonix.options.dirs.commands,
              file,
            );
            const folderPath = path.dirname(relativePath);
            const folderName = folderPath === "." ? "main" : folderPath;

            if (command.slashCommand) {
              harmonix.slashCommands.set(command.name, command);
              consola.info(
                colors.blueBright(`[${folderName}] `) +
                  colors.blue(`Loaded slash command: ${command.name}`),
              );
              loadedSlashCommands++;
            } else {
              harmonix.commands.set(command.name, command);
              consola.info(
                colors.blueBright(`[${folderName}] `) +
                  colors.blue(`Loaded command: ${command.name}`),
              );
              loadedRegularCommands++;
            }
            loadedFiles.add(file);
          } else {
            throw new Error(
              `Invalid command structure in file: ${file}. Please check for incorrect import statements or other issues.`,
            );
          }
        } catch (error) {
          consola.error(
            colors.red(`Failed to load command from file: ${file}`),
          );
          consola.error(
            colors.red(
              `Error: ${error instanceof Error ? error.message : String(error)}`,
            ),
          );
          erroredFiles.add(file);
          skippedCommands++;
        }
      }
    }
  };

  try {
    await loadCommandsProcess();
  } catch (error) {
    consola.error(colors.red("Error loading commands:"), error);
    consola.warn(
      colors.yellow("Attempting to load commands that did not fail..."),
    );
    await loadNotFailedCommandsProcess();
  }

  consola.info(
    colors.green(
      ` Loaded ${loadedRegularCommands} regular commands and ${loadedSlashCommands} slash commands. Skipped ${skippedCommands} commands due to errors.`,
    ),
  );
}

/**
 * Hot-load a single command from file without full reload.
 */
export async function loadCommandFromFile(harmonix: Harmonix, filePath: string): Promise<boolean> {
  try {
    const commandModule = await import(filePath);
    let command: HarmonixCommand;

    if (typeof commandModule.default === "function" && commandModule.default.build) {
      command = commandModule.default.build();
    } else if (typeof commandModule.default === "object" && "execute" in commandModule.default) {
      command = commandModule.default;
    } else {
      throw new Error(`Invalid command structure in file: ${filePath}`);
    }

    // Check if command should be disabled
    if (
      harmonix.options.featureFlags?.disabledCommands.includes(command.name) ||
      (harmonix.options.featureFlags?.betaCommands.includes(command.name) && !command.beta)
    ) {
      consola.info(colors.yellow(` Skipping disabled/non-beta command: ${command.name}`));
      return false;
    }

    const relativePath = path.relative(harmonix.options.dirs.commands, filePath);
    const folderPath = path.dirname(relativePath);
    const folderName = folderPath === "." ? "main" : folderPath;

    if (command.slashCommand) {
      harmonix.slashCommands.set(command.name, command);
      consola.info(colors.blueBright(`[${folderName}] `) + colors.green(`Hot-loaded slash command: ${command.name}`));
    } else {
      harmonix.commands.set(command.name, command);
      consola.info(colors.blueBright(`[${folderName}] `) + colors.green(`Hot-loaded command: ${command.name}`));
    }

    bus.emitTyped('command:load', { commandName: command.name, category: command.category });
    return true;
  } catch (error) {
    consola.error(colors.red(` Failed to hot-load command from ${filePath}:`), error);
    return false;
  }
}

/**
 * Hot-unload a command by name.
 */
export function unloadCommand(harmonix: Harmonix, commandName: string): boolean {
  const regularCmd = harmonix.commands.get(commandName);
  const slashCmd = harmonix.slashCommands.get(commandName);

  if (regularCmd) {
    harmonix.commands.delete(commandName);
    consola.info(colors.yellow(`Hot-unloaded command: ${commandName}`));
    bus.emitTyped('command:unload', { commandName });
    return true;
  }

  if (slashCmd) {
    harmonix.slashCommands.delete(commandName);
    consola.info(colors.yellow(`Hot-unloaded slash command: ${commandName}`));
    bus.emitTyped('command:unload', { commandName });
    return true;
  }

  consola.warn(colors.yellow(` Command not found for unload: ${commandName}`));
  return false;
}

// Load events with Effect-based error handling
async function loadEvents(harmonix: Harmonix): Promise<void> {
  const files = await scanFiles(harmonix, "events");
  for (const file of files) {
    if (harmonix.options.debug) {
      console.debug(`[DEBUG] Attempting to load event from file: ${file}`);
    }

    await Effect.runPromise(
      Effect.tryPromise({
        try: async () => {
          const eventModule = await import(file);
          let event: HarmonixEvent;

          if (
            typeof eventModule.default === "function" &&
            eventModule.default.build
          ) {
            event = eventModule.default.build();
            consola.info(
              colors.cyan(` Event ${file} uses defineEvent structure`),
            );
          } else if (
            typeof eventModule.default === "object" &&
            "execute" in eventModule.default
          ) {
            event = eventModule.default;
            consola.info(
              colors.cyan(` Event ${file} uses regular event structure`),
            );
          } else {
            throw new Error(`Invalid event structure in file: ${file}`);
          }

          harmonix.events.set(event.name, event);

          if (harmonix.options.debug) {
            consola.info(colors.blue(` Loaded event: ${event.name}`));
          }
        },
        catch: (error: Error) => {
          consola.error(colors.red(` Error loading event from file: ${file}`));
          consola.error(colors.red(` Error details: ${error.message}`));
        },
      }),
    );
  }
}

function setupEventListeners(harmonix: Harmonix): void {
  consola.info(colors.cyan("Setting up event listeners..."));

  harmonix.events.forEach((event, eventName) => {
    harmonix.client.on(eventName as keyof ClientEvents, (...args: any[]) =>
      event.execute(harmonix, ...args),
    );
  });

  consola.success(colors.green("Event listeners set up successfully."));
}

function watchAndReload(harmonix: Harmonix): void {
  const watcher = watch([
    harmonix.options.dirs.commands,
    harmonix.options.dirs.events,
  ]);

  const reload = debounce(async () => {
    consola.info(colors.yellow(" Preparing to reload bot..."));
    const owner = await harmonix.client.getRESTUser(harmonix.options.ownerId);
    consola.info(
      colors.yellow(` Owner: ${owner ? owner.username : "Not found"}`),
    );

    let dmChannel;
    // Send DM to bot owner
    try {
      if (owner) {
        dmChannel = await harmonix.client.getDMChannel(owner.id);
        consola.info(
          colors.yellow(
            ` DM Channel: ${dmChannel ? dmChannel.id : "Not created"}`,
          ),
        );
        const embed = {
          title: "Bot Reload",
          description: "The bot will reload in 10 seconds due to file changes.",
          color: 0x7289da,
          fields: [
            {
              name: "Reload Time",
              value: `<t:${Math.floor(Date.now() / 1000) + 10}:R>`,
            },
          ],
          timestamp: new Date().toISOString(),
        };
        try {
          await dmChannel.createMessage({ embed });
        } catch (dmError) {
          if (dmError.code === 50007) {
            consola.warn(
              colors.yellow(
                `Cannot send DM to owner: DMs are disabled or blocked.`,
              ),
            );
          } else {
            throw dmError;
          }
        }
      }
    } catch (error) {
      consola.error(colors.red(`Failed to send DM to owner: ${error.message}`));
    }

    // Wait for 10 seconds
    await new Promise((resolve) => setTimeout(resolve, 10000));

    consola.info(colors.yellow(" Reloading bot..."));

    // Fully disconnect the client
    harmonix.client.removeAllListeners();
    await harmonix.client.disconnect({ reconnect: false });
    consola.info(colors.blue(" Client fully disconnected"));

    // Clear commands and events
    harmonix.commands.clear();
    harmonix.slashCommands.clear();
    harmonix.events.clear();
    consola.info(colors.blue(" Commands and events cleared"));

    // Reinitialize the client with the token

    harmonix.client = new Eris.Client(harmonix.options.token, {
      intents: [
        Constants.Intents.guilds,
        Constants.Intents.guildMessages,
        Constants.Intents.guildMessageReactions,
        Constants.Intents.directMessages,
        Constants.Intents.directMessageReactions,
        Constants.Intents.guildVoiceStates,
      ],
      restMode: true,
    });

    // Reload commands and events
    await loadCommands(harmonix);
    await loadEvents(harmonix);
    consola.info(colors.blue(" Commands and events reloaded"));

    // Reconnect the client
    await harmonix.client.connect();
    consola.info(colors.blue(" Client reconnected"));

    consola.success(colors.green(" Reload complete"));

    // Send reload completed message to owner
    if (dmChannel) {
      const reloadCompletedEmbed = {
        title: "Bot Reload Completed",
        description:
          "The bot has successfully reloaded and is now back online.",
        color: 0x00ff00,
        timestamp: new Date().toISOString(),
      };
      await dmChannel.createMessage({ embed: reloadCompletedEmbed });
    }
  }, 100);
  watcher.on("change", reload);
}

// Main function with Effect-based error handling
async function main() {
  await Effect.runPromise(
    Effect.tryPromise({
      try: async () => {
        const harmonix = await Effect.runPromise(
          Effect.tryPromise(() => initHarmonix()),
        );

         // Display ASCII art and initialization message side by side
        const fs = require("fs");
        const path = require("path");
        
        const asciiArt = await Effect.runPromise(
          Effect.tryPromise(() =>
            fs.promises.readFile(path.join(__dirname, "ascii-art.txt"), "utf8"),
          ),
        );

         // --- NEW STRATEGY: RENDER SEPARATELY ---

        // Helper function to center a block of text.
        const centerBlock = (lines: string[]) => {
          const terminalWidth = process.stdout.columns || 80;
          return lines.map(line => {
              const lineWidth = stringWidth(line);
              const padding = Math.floor((terminalWidth - lineWidth) / 2);
              return " ".repeat(padding > 0 ? padding : 0) + line;
          });
      };

      // 1. Prepare the logo block.
      const logoLines = asciiArt.split("\n");
      const centeredLogo = centerBlock(logoLines).join('\n');

      // 2. Prepare the text block.
      const textLines = [
          "┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐",
          "│ I │ │ N │ │ I │ │ T │ │ I │ │ A │ │ L │ │ I │ │ Z │ │ I │ │ N │ │ G │",
          "└───┘ └───┘ └───┘ └───┘ └───┘ └───┘ └───┘ └───┘ └───┘ └───┘ └───┘ └───┘",
          "",
          "┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐",
          "│ T │ │ E │ │ R │ │ R │ │ A │",
          "└───┘ └───┘ └───┘ └───┘ └───┘",
      ];
      const centeredText = centerBlock(textLines).join('\n');
      
      // 3. PRINT THE LOGO FIRST.
      console.log(colors.blue(centeredLogo));
      
      // 4. PRINT A BLANK LINE FOR SPACING.
      console.log('');

      // 5. PRINT THE TEXT BLOCK AFTERWARD.
      console.log(colors.blue(centeredText));
        if (harmonix.options.debug) {
          console.debug(`The bot is running in debug mode.`);
        }

        // Launch the server
        await Effect.runPromise(Effect.tryPromise(() => setupServer(harmonix)));

        // Subscribe to feature flag changes for hot command reload/unload
        bus.onTyped('flags:changed', async (data) => {
          consola.info(colors.cyan(' Feature flags changed, hot-reloading commands...'));
          
          const previousDisabled = new Set(harmonix.options.featureFlags?.disabledCommands || []);
          const newFlags = data.flags as { disabledCommands?: string[]; betaCommands?: string[] };
          const newDisabled = new Set(newFlags.disabledCommands || []);

          // Commands that are newly disabled - unload them
          for (const cmdName of newDisabled) {
            if (!previousDisabled.has(cmdName)) {
              consola.info(colors.yellow(` Unloading disabled command: ${cmdName}`));
              unloadCommand(harmonix, cmdName);
            }
          }

          // Commands that are re-enabled - load them
          for (const cmdName of previousDisabled) {
            if (!newDisabled.has(cmdName)) {
              consola.info(colors.green(` Re-enabling command: ${cmdName}`));
              // Find the file and reload
              const files = await scanFiles(harmonix, 'commands');
              const cmdFile = files.find(f => {
                const basename = path.basename(f, '.ts');
                return basename === cmdName;
              });
              if (cmdFile) {
                await loadCommandFromFile(harmonix, cmdFile);
              }
            }
          }

          // Update the in-memory flags
          harmonix.options.featureFlags = {
            ...harmonix.options.featureFlags,
            ...newFlags,
          };
          consola.success(colors.green(' Command hot-reload complete.'));
        });

        // Set up raw WebSocket event handling for Erela.js
        harmonix.client.on("rawWS", (packet: any) => {
          Effect.runPromise(
            Effect.tryPromise({
              try: async () => {
                if (
                  packet.t === "VOICE_SERVER_UPDATE" ||
                  packet.t === "VOICE_STATE_UPDATE"
                ) {
                  await harmonix.manager.updateVoiceState(packet.d);
                }
              },
              catch: (error: Error) => {
                consola.error(
                  colors.red(
                    `[ERROR] Failed to process rawWS event: ${error.message}`,
                  ),
                );
              },
            }),
          );
        });

        // Global error handling for command errors
        harmonix.client.on("error", (error: Error, id: string) => {
          consola.error(colors.red("Command Error:"), error);
          if (id) {
            harmonix.client
              .createMessage(id, {
                embed: {
                  title: "Command Error",
                  description: "An error occurred while executing the command.",
                  color: 0xff0000,
                  fields: [
                    {
                      name: "Error Details",
                      value: `\`\`\`${error.message}\`\`\``,
                    },
                  ],
                },
              })
              .catch((err) => {
                consola.error(colors.red("Failed to send error message:"), err);
              });
          }
          consola.warn(
            colors.yellow(
              "Bot will continue running. The command error has been logged above.",
            ),
          );
        });

        if (harmonix.options.debug) {
          watchAndReload(harmonix);
        }

        // Remove the duplicate call to TerraClient.startClient
        // await Effect.runPromise(TerraClient.startClient(harmonix));
      },
      catch: (error: Error) => {
        console.error(`An error has occurred in Harmonix core`);

        let errorMessage: string;
        let stackTrace: string;
        if (error instanceof Error) {
          errorMessage = error.message;
          stackTrace = error.stack
            ? error.stack.split("\n").slice(0, 3).join("\n")
            : "No stack trace available";
          if ("cause" in error && error.cause instanceof Error) {
            errorMessage = error.cause.message;
            stackTrace = error.cause.stack
              ? error.cause.stack.split("\n").slice(0, 3).join("\n")
              : "No stack trace available";
          }
        } else {
          errorMessage = String(error);
          stackTrace = "No stack trace available";
        }

        consola.error(colors.red(" A critical error occurred:"), errorMessage);
        consola.error(colors.red("Stack trace:"));
        error.stack
          ?.split("\n")
          .forEach((line) => consola.error(colors.red(line)));
        consola.error(
          colors.red("Error occurred at:"),
          new Date().toISOString(),
        );
        consola.warn(
          colors.yellow(
            " Bot will continue running. The error has been logged above.",
          ),
        );
      },
    }),
  ).catch((error: Error) => {
    console.error(`A critical error has occurred in Harmonix core`);

    let errorMessage: string;
    let stackTrace: string;
    if (error instanceof Error) {
      errorMessage = error.message;
      stackTrace = error.stack
        ? error.stack.split("\n").slice(0, 3).join("\n")
        : "No stack trace available";
      if ("cause" in error && error.cause instanceof Error) {
        errorMessage = error.cause.message;
        stackTrace = error.cause.stack
          ? error.cause.stack.split("\n").slice(0, 3).join("\n")
          : "No stack trace available";
      }
    } else {
      errorMessage = String(error);
      stackTrace = "No stack trace available";
    }

    consola.error(colors.red(" A critical error occurred:"), errorMessage);
    consola.error(colors.red("Stack trace:"));
    error.stack?.split("\n").forEach((line) => consola.error(colors.red(line)));
    consola.error(colors.red("Error occurred at:"), new Date().toISOString());
    consola.error(colors.red("Bot is shutting down due to critical error."));
    process.exit(1);
  });
}

// Run the bot
Effect.runPromise(
  Effect.catchAll(
    Effect.tryPromise(() => main()),
    (error) =>
      Effect.sync(() => {
        consola.error(colors.red("An error occurred:"), error);
        consola.error(colors.red("Stack trace:"));
        error.stack
          ?.split("\n")
          .forEach((line) => consola.error(colors.red(line)));
        consola.warn(
          colors.yellow(
            "Bot will continue running. The error has been logged above.",
          ),
        );
      }),
  ),
);

// Global error handling
process.on("uncaughtException", (error) => {
  consola.error(colors.red("Uncaught Exception:"), error);
  consola.error(colors.red("Stack trace:"));
  error.stack?.split("\n").forEach((line) => consola.error(colors.red(line)));

  if (error.message.includes("Connection reset by peer")) {
    consola.warn(
      colors.yellow(
        "Connection reset by peer detected. Attempting to reload the bot...",
      ),
    );

    // Delay the reload to allow for any cleanup
    setTimeout(() => {
      consola.info(colors.blue("Restarting the bot..."));
      process.exit(1); // Exit with a non-zero code to trigger a restart if you're using a process manager
    }, 5000); // 5 seconds delay
  } else {
    consola.warn(
      colors.yellow(
        "Bot will continue running. The error has been logged above.",
      ),
    );
  }
});

process.on("unhandledRejection", (reason, promise) => {
  consola.error(
    colors.red("Unhandled Rejection at:"),
    promise,
    "reason:",
    reason,
  );

  if (reason instanceof Error) {
    consola.error(colors.red("Stack trace:"));
    reason.stack
      ?.split("\n")
      .forEach((line) => consola.error(colors.red(line)));
  }

  if (
    reason instanceof Error &&
    reason.message.includes("Connection reset by peer")
  ) {
    consola.warn(
      colors.yellow(
        "Connection reset by peer detected in unhandled rejection. Attempting to reload the bot...",
      ),
    );

    setTimeout(() => {
      consola.info(colors.blue("Restarting the bot..."));
      process.exit(1);
    }, 5000);
  } else {
    consola.warn(
      colors.yellow(
        "Bot will continue running. The error has been logged above.",
      ),
    );
  }
});

export { Harmonix };
