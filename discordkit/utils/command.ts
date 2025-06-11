import { Effect } from "effect";
import { 
  Harmonix, 
  HarmonixCommand, 
  HarmonixCommandConfig, 
  HarmonixOptions, 
  CustomApplicationCommandOptions, 
  CommandPermissions, 
  Cooldown, 
} from "../types/harmonixtypes";
import Eris, {
  Message,
  TextableChannel,
  Constants,
  CommandInteraction,
  GuildChannel,
  ComponentInteraction,
  ModalSubmitInteraction,
} from "eris";
import { logError } from "../utils/centralloggingfactory";

const cooldowns = new Map<string, Map<string, number>>();

export function defineCommand<T extends Record<string, any> = Record<string, any>>(
  config: HarmonixCommandConfig,
) {
  return class {
    static config = config;

    static execute(
      harmonix: Harmonix,
      message: Message<TextableChannel> | CommandInteraction,
      args: string[] | T,
    ): Promise<void> {
      throw new Error("Execute method must be implemented");
    }

    static onComponentInteraction?(
      harmonix: Harmonix,
      interaction: ComponentInteraction | ModalSubmitInteraction,
    ): Promise<void>;

    static build(): HarmonixCommand {
      return {
        ...config,
        onComponentInteraction: this.onComponentInteraction,
        execute: async (
          harmonix: Harmonix,
          message: Message<TextableChannel> | CommandInteraction,
          args: string[] | Record<string, any>,
        ): Promise<void> => {
          await Effect.runPromise(
            Effect.tryPromise(async () => {
              const userId =
                "author" in message
                  ? message.author.id
                  : message.member?.id || message.user?.id;
              const member = message.member;
              const channel = message.channel;

              if (harmonix.options.debug) {
                console.log(`Debug: User ID for command execution: ${userId}`);
              }

              // Owner check
              if (config.ownerOnly && userId !== harmonix.options.ownerId) {
                throw new Error(
                  "This command can only be used by the bot owner.",
                );
              }

              // Cooldown check
              if (config.cooldown) {
                if (!cooldowns.has(config.name)) {
                  cooldowns.set(config.name, new Map());
                }
                const now = Date.now();
                const timestamps = cooldowns.get(config.name)!;
                const cooldownAmount = (config.cooldown.seconds || 3) * 1000;
                const cooldownKey = config.cooldown.perUser ? userId : "global";

                if (timestamps.has(cooldownKey)) {
                  const expirationTime =
                    timestamps.get(cooldownKey)! + cooldownAmount;
                  if (now < expirationTime) {
                    const timeLeft = (expirationTime - now) / 1000;
                    throw new Error(
                      `Please wait ${
                        timeLeft.toFixed(1)
                      } more second(s) before reusing the \`${
                        config.name
                      }\` command.`,
                    );
                  }
                }
                timestamps.set(cooldownKey, now);
                setTimeout(() => timestamps.delete(cooldownKey), cooldownAmount);
              }

              // Permissions check (only in guilds)
              if (config.permissions && member && channel.type !== 1) {
                const perms = config.permissions;
                const guild = (channel as GuildChannel).guild;

                // Bot permissions
                if (perms.bot) {
                  const botMember = await guild.getRESTMember(
                    harmonix.client.user.id,
                  );
                  const botPermissions = (channel as GuildChannel).permissionsOf(
                    botMember,
                  );
                  const missingBotPerms = perms.bot.filter(
                    (p) => !botPermissions.has(p),
                  );
                  if (missingBotPerms.length) {
                    throw new Error(
                      `I am missing the following permissions: ${missingBotPerms.join(
                        ", ",
                      )}`,
                    );
                  }
                }

                // User permissions
                if (perms.user) {
                  const userPermissions = (channel as GuildChannel).permissionsOf(
                    member,
                  );
                  const missingUserPerms = perms.user.filter(
                    (p) => !userPermissions.has(p),
                  );
                  if (missingUserPerms.length) {
                    throw new Error(
                      `You are missing the following permissions: ${missingUserPerms.join(
                        ", ",
                      )}`,
                    );
                  }
                }

                // Role checks
                if (perms.roles) {
                  if (
                    perms.roles.denied?.some((roleId) =>
                      member.roles.includes(roleId),
                    )
                  ) {
                    throw new Error(
                      "You have a role that prevents you from using this command.",
                    );
                  }
                  if (
                    perms.roles.needed &&
                    !perms.roles.needed.some((roleId) =>
                      member.roles.includes(roleId),
                    )
                  ) {
                    throw new Error(
                      "You do not have the required role to use this command.",
                    );
                  }
                }

                // Channel checks
                if (perms.channels) {
                  if (perms.channels.denied?.includes(channel.id)) {
                    throw new Error(
                      "This command cannot be used in this channel.",
                    );
                  }
                  if (
                    perms.channels.needed &&
                    !perms.channels.needed.includes(channel.id)
                  ) {
                    throw new Error(
                      "This command can only be used in specific channels.",
                    );
                  }
                }

                // Custom check
                if (perms.custom) {
                  const customCheckPassed = await Promise.resolve(
                    perms.custom(harmonix, message),
                  );
                  if (!customCheckPassed) {
                    throw new Error(
                      "You do not have permission to use this command.",
                    );
                  }
                }
              }

              // Handle slash command options
              let commandArgs: T = args as T;
              if (
                message instanceof CommandInteraction &&
                message.data.options
              ) {
                commandArgs = message.data.options.reduce(
                  (acc, option) => {
                    if ("value" in option) {
                      return { ...acc, [option.name]: option.value };
                    }
                    return acc;
                  },
                  {} as Record<string, unknown>,
                ) as T;
              }

              await this.execute(
                harmonix,
                message as Message<TextableChannel> | CommandInteraction,
                commandArgs,
              );
            }).pipe(
              Effect.tapError((error) =>
                Effect.sync(() => {
                  console.error(
                    `An error has occured in command ${config.name}`,
                  );
                }),
              ),
              Effect.catchAll((error) =>
                Effect.sync(() => {
                  console.error(`Detailed error log follows : \n`, error);
                  console.error("Stack trace:", error.stack);

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

                  console.error(
                    `Error in command ${config.name}:`,
                    errorMessage,
                  );

                  if (config.slashCommand && "createMessage" in message) {
                    return (message as CommandInteraction).createMessage({
                      embeds: [
                        {
                          color: 0xff0000,
                          title: "Oops!",
                          description: "An unexpected error has occurred!",
                          fields: [
                            { name: "Command", value: config.name },
                            {
                              name: "Error Details",
                              value: `\`\`\`${errorMessage}\`\`\``,
                            },
                            {
                              name: "Stack Trace",
                              value: `\`\`\`${stackTrace}\`\`\``,
                            },
                          ],
                        },
                      ],
                      flags: 64,
                    });
                  } else if ("channel" in message) {
                    return harmonix.client.createMessage(
                      (message as Message<TextableChannel>).channel.id,
                      {
                        embed: {
                          color: 0xff0000,
                          title: "Oops!",
                          description: "An unexpected error has occurred!",
                          fields: [
                            { name: "Command", value: config.name },
                            {
                              name: "Error Details",
                              value: `\`\`\`${errorMessage}\`\`\``,
                            },
                            {
                              name: "Stack Trace",
                              value: `\`\`\`${stackTrace}\`\`\``,
                            },
                          ],
                        },
                      },
                    );
                  }
                }),
              ),
            ),
          );
        },
      };
    }
  };
}
export const defineEvent = (
  name: string,
  execute: (...args: any[]) => Promise<void>,
) => {
  return {
    name,
    execute: async (...args: any[]) => {
      return Effect.runPromise(
        Effect.tryPromise(async () => {
          await execute(...args);
        }).pipe(
          Effect.catchAll((error) =>
            Effect.sync(() => {
              logError(`Error executing event ${name}:`, error);
            }),
          ),
        ),
      );
    },
  };
};

export const definePrecondition = (
  name: string,
  check: (
    harmonix: Harmonix,
    message: Message<TextableChannel> | any,
  ) => Promise<boolean>,
) => {
  return {
    name,
    check: async (
      harmonix: Harmonix,
      message: Message<TextableChannel> | any,
    ) => {
      return Effect.runPromise(
        Effect.tryPromise(async () => {
          return await check(harmonix, message);
        }).pipe(
          Effect.catchAll((error) =>
            Effect.sync(() => {
              logError(`Error in precondition ${name}:`, error);
              return false;
            }),
          ),
        ),
      );
    },
  };
};

export const defineHarmonixConfig = (config: HarmonixOptions) => {
  return config;
};
export const createSlashCommandOption = (
  type: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10,
  name: string,
  description: string,
  required: boolean = false,
  choices?: { name: string; value: string | number }[],
): CustomApplicationCommandOptions => {
  return {
    type,
    name,
    description,
    required,
    choices: choices || undefined,
  };
};
