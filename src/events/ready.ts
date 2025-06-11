import { defineEvent } from "../../discordkit/utils/event";
import { Harmonix, HarmonixCommand } from "../../discordkit/types/harmonixtypes";
import {
  Interaction,
  CommandInteraction,
  ComponentInteraction,
  ApplicationCommand,
} from "eris";
import { Effect } from "effect";
import { logError } from "../../discordkit/utils/centralloggingfactory";
import { colors } from "consola/utils";
import consola from "consola";

export default class extends defineEvent({
  name: "ready",
  description: "Emitted when the client is ready",
}) {
  static async execute(harmonix: Harmonix) {
    try {
      consola.debug("Client ready event triggered");
      consola.success(
        colors.green(` Logged in as ${harmonix.client.user.username}`),
      );

      consola.debug("Setting client status");
      harmonix.client.editStatus("online", {
        name: "In development : Using Eris",
        type: 3,
      });

      consola.debug("Initializing manager");
      harmonix.manager.init(harmonix.client.user.id);

      // Register slash commands
      consola.debug("Preparing slash commands for registration");
      const commands = (
        Array.from(harmonix.slashCommands.values()) as HarmonixCommand[]
      ).flatMap((cmd) => {
        const registrations: any[] = [];

        // Ensure `types` is always an array
        const types = Array.isArray(cmd.type)
          ? cmd.type
          : cmd.type
          ? [cmd.type]
          : [1];

        if (types.includes(1)) {
          registrations.push({
            name: cmd.name,
            description: cmd.description,
            options: cmd.options,
            type: 1 as const,
          });
        }

        if (types.includes(2)) {
          registrations.push({
            name: cmd.name,
            type: 2 as const, // User Context Menu
          });
        }

        // Add other types here if needed, e.g., Message Context Menu (type 3)

        return registrations;
      });

      consola.debug(`Attempting to register ${commands.length} slash commands`);
      try {
        const startTime = Date.now();
        await harmonix.client.bulkEditCommands(commands);
        const endTime = Date.now();
        const duration = endTime - startTime;

        consola.success(
          colors.green(
            ` Registered ${commands.length} slash commands in ${duration}ms`,
          ),
        );
        consola.info("Registered commands:");
        commands.forEach((cmd) => consola.info(` - ${cmd.name}`));
      } catch (error) {
        consola.error(colors.red(` Error registering slash commands:`));
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
        consola.error(`Error Details: ${errorMessage}`);
        consola.error(`Stack Trace:\n${stackTrace}`);
      }
    } catch (error) {
      consola.error(
        colors.red(` An error occurred during client ready process:`),
      );
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
      consola.error(`Error Details: ${errorMessage}`);
      consola.error(`Stack Trace:\n${stackTrace}`);
      // Optionally, you might want to rethrow the error or handle it in a specific way
      // throw error;
    }
  }
}
