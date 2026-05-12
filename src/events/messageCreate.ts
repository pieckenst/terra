import { defineEvent } from "../../discordkit/utils/event";
import { Harmonix } from "../../discordkit/types/harmonixtypes";
import {
  Interaction,
  CommandInteraction,
  ComponentInteraction,
  EmbedOptions,
  Message,
  PossiblyUncachedTextableChannel,
} from "eris";
import { Effect } from "effect";
import { logError } from "../../discordkit/utils/centralloggingfactory";
import { colors } from "consola/utils";
import consola from "consola";
import { prisma } from "../lib/db";
import { logCommandUsed, logCommandSuccess, logCommandError } from "../lib/analytics";

export default class extends defineEvent({
  name: "messageCreate",
  description: "Emitted when a message is created",
}) {
  static async execute(
    harmonix: Harmonix,
    msg: Message<PossiblyUncachedTextableChannel>,
  ) {
    return Effect.runPromise(
      Effect.tryPromise(async () => {
        let content: string | undefined;
        const prefix = harmonix.options.prefix;
        const mentionRegex = new RegExp(`^<@!?${harmonix.client.user.id}>`);

        if (msg.content.startsWith(prefix)) {
          content = msg.content.slice(prefix.length);
        } else {
          const mentionMatch = msg.content.match(mentionRegex);
          if (mentionMatch) {
            content = msg.content.slice(mentionMatch[0].length);
          }
        }

        if (content === undefined) {
          return; // Not a command for the bot
        }

        const textableChannelTypes = [0, 1, 3, 5]; // GuildText, DM, GroupDM, GuildAnnouncement
        
        // If the bot is mentioned but no command follows, show the info embed.
        if (content.trim().length === 0 && msg.mentions.includes(harmonix.client.user)) {
            consola.info(
                colors.yellow(
                ` Bot mentioned by ${msg.author.username} in ${msg.channel.id}`,
                ),
            );
            const embed: EmbedOptions = {
                title: "Harmonix",
                description:
                "A feature-rich, and a powerful Discord bot built with Eris, and Bun.",
                color: 0x5865f2,
                thumbnail: {
                url: harmonix.client.user.avatarURL,
                },
                fields: [
                {
                    name: "Prefix",
                    value: `\`${harmonix.options.prefix}\``,
                    inline: true,
                }
                ],
            };
            if (
                "type" in msg.channel &&
                textableChannelTypes.includes(msg.channel.type)
            ) {
                await msg.channel.createMessage({ embeds: [embed] });
            }
            return;
        }

        if (
          "type" in msg.channel &&
          textableChannelTypes.includes(msg.channel.type)
        ) {
          const args = content.trim().split(/ +/);
          const commandName = args.shift()?.toLowerCase();

          if (!commandName) return;

          const command = harmonix.commands.get(commandName) || harmonix.commands.find(cmd => cmd.aliases && cmd.aliases.includes(commandName));
          if (command && "execute" in command) {
            consola.info(`[DEBUG] Command found: ${command.name}`);
            // Check if the command is disabled in the database
            if (msg.guildID) {
              consola.info(`[DEBUG] Checking database for guild: ${msg.guildID}`);
              const setting = await prisma.commandSetting.findUnique({
                where: {
                  guildId_commandName: {
                    guildId: msg.guildID,
                    commandName: command.name,
                  },
                },
              });
              consola.info(`[DEBUG] Database setting: ${JSON.stringify(setting)}`);

              if (setting && !setting.enabled) {
                await msg.channel.createMessage({
                  content: "This command is currently disabled on this server.",
                  messageReference: {
                    messageID: msg.id,
                  },
                });
                return; // Stop execution
              }
            } else {
              consola.info(`[DEBUG] No guildID found, skipping database check.`);
            }
            consola.info(
              colors.cyan(
                `Command "${commandName}" used by ${msg.author.username} in ${msg.channel.id}`,
              ),
            );
            
            // Log command usage
            await logCommandUsed(msg.author.id, msg.guildID, command.name);
            
            try {
              await command.execute(harmonix, msg, args);
              // Log command success
              await logCommandSuccess(msg.author.id, msg.guildID, command.name);
            } catch (error) {
              // Log command error
              await logCommandError(
                msg.author.id,
                msg.guildID,
                command.name,
                error instanceof Error ? error.message : String(error)
              );
              throw error; // Re-throw to maintain existing error handling
            }
          } else {
            consola.warn(
              colors.yellow(
                ` Unknown command "${commandName}" attempted by ${msg.author.username} in ${msg.channel.id}`,
              ),
            );
          }
        }
      }),
    );
  }
}

// Function to create an embed with bot start time and uptime
function createBotInfoEmbed(harmonix: Harmonix): EmbedOptions {
  const uptime = Date.now() - harmonix.startTime.getTime();
  const days = Math.floor(uptime / 86400000);
  const hours = Math.floor((uptime % 86400000) / 3600000);
  const minutes = Math.floor((uptime % 3600000) / 60000);
  const seconds = Math.floor((uptime % 60000) / 1000);

  return {
    title: "Bot Information",
    fields: [
      {
        name: "Start Time",
        value: harmonix.startTime.toUTCString(),
        inline: true,
      },
      {
        name: "Uptime",
        value: `${days}d ${hours}h ${minutes}m ${seconds}s`,
        inline: true,
      },
    ],
    color: 0x7289da, // Discord blurple color
    footer: {
      text: `${harmonix.client.user.username}`,
      icon_url: harmonix.client.user.avatarURL,
    },
    timestamp: new Date().toISOString(),
  };
}
