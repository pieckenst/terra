import { defineEvent } from "../../discordkit/utils/event";
import { Harmonix } from "../../discordkit/types/harmonixtypes";
import { Interaction, CommandInteraction, ComponentInteraction, ModalSubmitInteraction } from "eris";
import { Effect } from "effect";
import { logError } from "../../discordkit/utils/centralloggingfactory";
import { colors } from "consola/utils";
import consola from "consola";
import { prisma } from "../lib/db";
import { logCommandUsed, logCommandSuccess, logCommandError } from "../lib/analytics";

export default class extends defineEvent({
  name: "interactionCreate",
  description: "Emitted when an interaction is created",
}) {
  static async execute(harmonix: Harmonix, interaction: Interaction) {
    return Effect.runPromise(
      Effect.tryPromise(
        () =>
          new Promise<void>(async (resolve, reject) => {
            try {
              if (interaction instanceof CommandInteraction) {
                const command = harmonix.slashCommands.get(
                  interaction.data.name,
                );
                if (!command) return;

                // Check if the command is disabled in the database
                if (interaction.guildID) {
                  const setting = await prisma.commandSetting.findUnique({
                    where: {
                      guildId_commandName: {
                        guildId: interaction.guildID,
                        commandName: command.name,
                      },
                    },
                  });

                  if (setting && !setting.enabled) {
                    await interaction.createMessage({
                      content:
                        "This command is currently disabled on this server.",
                      flags: 64, // Ephemeral
                    });
                    return; // Stop execution
                  }
                }

                // Log slash command usage
                const userId = interaction.user?.id || interaction.member?.user?.id;
                if (userId) {
                  await logCommandUsed(userId, interaction.guildID, command.name);
                }

                try {
                  await command.execute(
                    harmonix,
                    interaction,
                    interaction.data.options,
                  );
                  // Log slash command success
                  if (userId) {
                    await logCommandSuccess(userId, interaction.guildID, command.name);
                  }
                } catch (error) {
                  // Log slash command error
                  if (userId) {
                    await logCommandError(
                      userId,
                      interaction.guildID,
                      command.name,
                      error instanceof Error ? error.message : String(error)
                    );
                  }
                  logError(
                    `Error handling interaction for command ${interaction.data.name}:`,
                    error instanceof Error ? error : new Error(String(error)),
                  );
                  await interaction.createMessage({
                    content: "An error occurred while processing the command.",
                    flags: 64,
                  });
                }
              } else if (interaction instanceof ModalSubmitInteraction) {
                const commandName = interaction.data.custom_id.split('_')[0];
                const command = harmonix.slashCommands.get(commandName) || harmonix.commands.find(cmd => cmd.name === commandName);
                if (!command) return;

                if (command.onComponentInteraction) {
                  try {
                    await command.onComponentInteraction(harmonix, interaction);
                  } catch (error) {
                    logError(
                      `Error handling modal submission for command ${command.name}:`,
                      error instanceof Error ? error : new Error(String(error)),
                    );
                  }
                }
              } else if (interaction instanceof ComponentInteraction) {
                const commandName = interaction.data.custom_id.split('_')[0];
                const command = harmonix.slashCommands.get(commandName) || harmonix.commands.find(cmd => cmd.name === commandName);
                if (!command) return;

                // Prefer the new component handler, but fall back to execute for older commands
                if (command.onComponentInteraction) {
                  try {
                    await command.onComponentInteraction(harmonix, interaction);
                  } catch (error) {
                    logError(
                      `Error handling component interaction for command ${command.name}:`,
                      error instanceof Error ? error : new Error(String(error)),
                    );
                  }
                } else {
                  // Fallback for commands that don't have a dedicated component handler
                  try {
                    await command.execute(harmonix, interaction, {});
                  } catch (error) {
                    logError(
                      `Error handling interaction for command ${command.name}:`,
                      error instanceof Error ? error : new Error(String(error)),
                    );
                    await interaction.createMessage({
                      content:
                        "An error occurred while processing the interaction.",
                      flags: 64,
                    });
                  }
                }
              }
              resolve();
            } catch (error) {
              reject(error);
            }
          }),
      ).pipe(
        Effect.tapError((error) =>
          Effect.sync(() => {
            consola.error(
              colors.red(`Error processing interaction: ${error.message}`),
            );
          }),
        ),
      ),
    );
  }
}
