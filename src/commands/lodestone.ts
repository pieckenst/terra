import { Message, TextableChannel, CommandInteraction, ComponentInteraction, ModalSubmitInteraction } from "eris";
import { Harmonix } from "../core";
import { defineCommand } from "../../discordkit/utils/command";
import fetch from "node-fetch";
import {
  fetchCharacterInfo,
  searchCharacter,
  convertRace,
  convertClan,
} from "../../discordkit/utils/lodestone-utils";
import {
  JobData,
  ClassJob,
  Experience,
  ClassJobLevel,
  ClassLevel,
  Race,
  Clan,
  CharacterInfo,
  JobIconMapping,
} from "../typedefinitions/lodestonetypes";
import { prisma } from "../lib/db";

// Temporary storage for modal results (in production, use Redis or database)
const modalResultsCache = new Map<string, { info: CharacterInfo; characterId: string; emoji: any; fetchTime: number }>();

export default class extends defineCommand({
  name: "lodestone",
  description: "Get FFXIV character information from Lodestone",
  usage: "<server> <character name> or <lodestone id>",
  category: "information",
  slashCommand: true,
  options: [
    {
      type: 3,
      name: "character",
      description: "The character name or Lodestone ID",
      required: true,
    },
    {
      type: 3,
      name: "server",
      description: "The server name",
      required: false,
    },
    {
      type: 3,
      name: "display",
      description: "How to display the results",
      required: false,
      choices: [
        { name: "Immediate", value: "immediate" },
        { name: "Modal", value: "modal" },
      ],
    },
    {
      type: 5,
      name: "save",
      description: "Save this character ID to your profile",
      required: false,
    },
  ],
}) {
  static async showConfirmationModal(
    interaction: CommandInteraction,
    characterId: string,
    character: string | undefined,
    server: string | undefined
  ) {
    const modalEmbed = {
      title: "Confirm Character Lookup",
      description: `You are about to fetch character information for:\n\n**Character ID:** ${characterId}\n${character ? `**Character Name:** ${character}` : ''}${server ? `\n**Server:** ${server}` : ''}\n\nDo you want to proceed?`,
      color: 0x5865f2,
      footer: {
        text: "FFXIV Lodestone",
      },
    };

    await interaction.createMessage({
      embeds: [modalEmbed],
      components: [
        {
          type: 1,
          components: [
            {
              type: 2,
              style: 3, // Primary button (green)
              label: "Yes, Fetch Data",
              custom_id: `lodestone_confirm_${characterId}_${character || ''}_${server || ''}`,
            },
            {
              type: 2,
              style: 4, // Danger button (red)
              label: "Cancel",
              custom_id: "lodestone_cancel",
            },
          ],
        },
      ],
    });
  }

  static async showResultsModal(
    interaction: ComponentInteraction,
    info: CharacterInfo,
    characterId: string,
    emoji: any,
    fetchTime: number
  ) {
    // This method is no longer used - we use actual Discord modals now
    // Kept for backward compatibility if needed
  }

  static async showModalResults(
    interaction: CommandInteraction,
    info: CharacterInfo,
    characterId: string,
    emoji: any,
    fetchTime: number
  ) {
    // Create a Discord modal (type 9) with character information
    const mainEmbed = this.createMainEmbed(info, characterId, emoji, fetchTime);
    
    // Format character info for modal display
    const characterInfoText = `**Name:** ${info.name}
**Server:** ${info.server}
**Title:** ${info.title || 'None'}
**Race/Clan/Gender:** ${convertRace(info.race)} / ${convertClan(info.clan)} / ${info.gender}
**Nameday:** ${info.nameday}
**Guardian:** ${info.guardian}
**City-state:** ${info.cityState}
**Active Class/Job:** ${emoji ? `<:${emoji.name}:${emoji.id}>` : ''} ${info.activeClassJob} (Level ${info.activeClassJobLevel})
**Grand Company:** ${info.grandCompany ? (typeof info.grandCompany === 'string' ? info.grandCompany : `${info.grandCompany.name} - ${info.grandCompany.rank}`) : 'None'}
**Free Company:** ${info.freeCompany ? (typeof info.freeCompany === 'string' ? info.freeCompany : `${info.freeCompany.name}`) : 'None'}`;

    // Format class levels for modal
    const classLevels = info.classLevels as Record<string, ClassJobLevel>;
    const classLevelsText = Object.entries(classLevels)
      .filter(([key, data]) => data && typeof data === 'object' && 'level' in data)
      .map(([key, data]) => `${key}: Level ${data.level}`)
      .join('\n');

    await interaction.createModal({
      title: `${info.name} - Character Info`,
      custom_id: `lodestone_modal_${characterId}`,
      components: [
        {
          type: 1,
          components: [
            {
              type: 4,
              custom_id: "lodestone_char_info",
              label: "Character Information",
              style: 2, // Paragraph style
              value: characterInfoText,
              required: false,
            },
          ],
        },
        {
          type: 1,
          components: [
            {
              type: 4,
              custom_id: "lodestone_class_levels",
              label: "Class Levels",
              style: 2, // Paragraph style
              value: classLevelsText || "No class data available",
              required: false,
            },
          ],
        },
      ],
    });
  }

  static async onComponentInteraction(
    harmonix: Harmonix,
    interaction: ComponentInteraction | ModalSubmitInteraction
  ) {
    // Handle modal submission for loading modal
    if (interaction instanceof ModalSubmitInteraction) {
      if (interaction.data.custom_id.startsWith("lodestone_fetch_")) {
        const characterId = interaction.data.custom_id.split("_")[2];
        const cacheKey = `${interaction.member?.id || interaction.user?.id}_${characterId}`;
        const cachedData = modalResultsCache.get(cacheKey);

        // Check if there was an error
        if (cachedData && (cachedData as any).error) {
          await interaction.createMessage({
            content: "❌ Failed to fetch character data. Please try again later.",
            flags: 64,
          });
          modalResultsCache.delete(cacheKey);
          return;
        }

        if (!cachedData || !cachedData.info) {
          // Data not ready yet or failed
          await interaction.createMessage({
            content: "⏳ Data is still being fetched. Please wait a moment and try again.",
            flags: 64,
          });
          return;
        }

        // Data is ready, send followup with View Results button
        const { info, fetchTime } = cachedData;
        await interaction.createMessage({
          content: `✅ Character information for **${info.name}** fetched successfully! (${fetchTime.toFixed(2)}s)\n\nClick the button below to view results in a modal.`,
          components: [
            {
              type: 1,
              components: [
                {
                  type: 2,
                  style: 3, // Primary button (green)
                  label: "View Results",
                  custom_id: `lodestone_view_results_${characterId}`,
                },
              ],
            },
          ],
        });
        return;
      }
      
      if (interaction.data.custom_id.startsWith("lodestone_results_")) {
        // This is the results modal submission
        await interaction.createMessage({
          content: "Character information viewed.",
          flags: 64,
        });
        return;
      }
    }

    if (!("data" in interaction) || !interaction.data.custom_id) return;

    const customId = interaction.data.custom_id;

    // Handle view results button
    if (customId.startsWith("lodestone_view_results_")) {
      const characterId = customId.split("_")[3];
      const cacheKey = `${interaction.member?.id || interaction.user?.id}_${characterId}`;
      const cachedData = modalResultsCache.get(cacheKey);

      if (!cachedData) {
        await interaction.createMessage({
          content: "Character data not found. Please try running the command again.",
          flags: 64,
        });
        return;
      }

      // Format character info for modal display
      const { info, emoji, fetchTime } = cachedData;
      const characterInfoText = `**Name:** ${info.name}
**Server:** ${info.server}
**Title:** ${info.title || 'None'}
**Race/Clan/Gender:** ${convertRace(info.race)} / ${convertClan(info.clan)} / ${info.gender}
**Nameday:** ${info.nameday}
**Guardian:** ${info.guardian}
**City-state:** ${info.cityState}
**Active Class/Job:** ${emoji ? `<:${emoji.name}:${emoji.id}>` : ''} ${info.activeClassJob} (Level ${info.activeClassJobLevel})
**Grand Company:** ${info.grandCompany ? (typeof info.grandCompany === 'string' ? info.grandCompany : `${info.grandCompany.name} - ${info.grandCompany.rank}`) : 'None'}
**Free Company:** ${info.freeCompany ? (typeof info.freeCompany === 'string' ? info.freeCompany : `${info.freeCompany.name}`) : 'None'}`;

      // Format class levels for modal
      const classLevels = info.classLevels as Record<string, ClassJobLevel>;
      const classLevelsText = Object.entries(classLevels)
        .filter(([key, data]) => data && typeof data === 'object' && 'level' in data)
        .map(([key, data]) => `${key}: Level ${data.level}`)
        .join('\n');

      // Update the message to show loading
      await interaction.editParent({
        content: "Opening results modal...",
        components: [],
      });

      // ComponentInteraction can create modal
      if (interaction instanceof ComponentInteraction) {
        await interaction.createModal({
          title: `${info.name} - Character Info`,
          custom_id: `lodestone_results_${characterId}`,
          components: [
            {
              type: 1,
              components: [
                {
                  type: 4,
                  custom_id: "lodestone_char_info",
                  label: "Character Information",
                  style: 2, // Paragraph style
                  value: characterInfoText,
                  required: false,
                },
              ],
            },
            {
              type: 1,
              components: [
                {
                  type: 4,
                  custom_id: "lodestone_class_levels",
                  label: "Class Levels",
                  style: 2, // Paragraph style
                  value: classLevelsText || "No class data available",
                  required: false,
                },
              ],
            },
          ],
        });
      }
      return;
    }

    // Handle cancel fetch button (no longer needed since modal has built-in cancel)
    if (customId.startsWith("lodestone_cancel_fetch_")) {
      const characterId = customId.split("_")[3];
      const cacheKey = `${interaction.member?.id || interaction.user?.id}_${characterId}`;
      
      // Remove from cache
      modalResultsCache.delete(cacheKey);
      
      await interaction.editParent({
        content: "❌ Character lookup cancelled.",
        components: [],
      });
      return;
    }

    // Handle show results button (old handler, can be removed)
    if (customId.startsWith("lodestone_show_results_")) {
      const characterId = customId.split("_")[3];
      const cacheKey = `${interaction.member?.id || interaction.user?.id}_${characterId}`;
      const cachedData = modalResultsCache.get(cacheKey);

      if (!cachedData) {
        await interaction.createMessage({
          content: "Character data not found. Please try running the command again.",
          flags: 64,
        });
        return;
      }

      // Format character info for modal display
      const { info, emoji, fetchTime } = cachedData;
      const characterInfoText = `**Name:** ${info.name}
**Server:** ${info.server}
**Title:** ${info.title || 'None'}
**Race/Clan/Gender:** ${convertRace(info.race)} / ${convertClan(info.clan)} / ${info.gender}
**Nameday:** ${info.nameday}
**Guardian:** ${info.guardian}
**City-state:** ${info.cityState}
**Active Class/Job:** ${emoji ? `<:${emoji.name}:${emoji.id}>` : ''} ${info.activeClassJob} (Level ${info.activeClassJobLevel})
**Grand Company:** ${info.grandCompany ? (typeof info.grandCompany === 'string' ? info.grandCompany : `${info.grandCompany.name} - ${info.grandCompany.rank}`) : 'None'}
**Free Company:** ${info.freeCompany ? (typeof info.freeCompany === 'string' ? info.freeCompany : `${info.freeCompany.name}`) : 'None'}`;

      // Format class levels for modal
      const classLevels = info.classLevels as Record<string, ClassJobLevel>;
      const classLevelsText = Object.entries(classLevels)
        .filter(([key, data]) => data && typeof data === 'object' && 'level' in data)
        .map(([key, data]) => `${key}: Level ${data.level}`)
        .join('\n');

      // ComponentInteraction can create modal
      if (interaction instanceof ComponentInteraction) {
        await interaction.createModal({
          title: `${info.name} - Character Info`,
          custom_id: `lodestone_results_${characterId}`,
          components: [
            {
              type: 1,
              components: [
                {
                  type: 4,
                  custom_id: "lodestone_char_info",
                  label: "Character Information",
                  style: 2, // Paragraph style
                  value: characterInfoText,
                  required: false,
                },
              ],
            },
            {
              type: 1,
              components: [
                {
                  type: 4,
                  custom_id: "lodestone_class_levels",
                  label: "Class Levels",
                  style: 2, // Paragraph style
                  value: classLevelsText || "No class data available",
                  required: false,
                },
              ],
            },
          ],
        });
      }
      return;
    }

    // Handle cancel button
    if (customId === "lodestone_cancel") {
      await interaction.editParent({
        content: "Character lookup cancelled.",
        embeds: [],
        components: [],
      });
      return;
    }

    // Handle close button
    if (customId === "lodestone_close") {
      if (interaction instanceof ComponentInteraction) {
        await interaction.message.delete();
      }
      return;
    }
  }

  static async execute(
    harmonix: Harmonix,
    interaction: CommandInteraction | Message<TextableChannel>,
    args: { server?: string; character: string },
  ) {
    if (harmonix.options.debug) {
      console.debug("[Lodestone] Debug: Starting execution");
      console.debug(
        "[Lodestone] Debug: Interaction type:",
        interaction.constructor.name,
      );
    }

    let character: string | undefined;
    let server: string | undefined;
    let displayMode: string = "immediate";
    let saveCharacter: boolean = false;

    if (interaction instanceof CommandInteraction) {
      const characterOption = interaction.data.options?.find(
        (opt) => opt.name === "character",
      );
      const serverOption = interaction.data.options?.find(
        (opt) => opt.name === "server",
      );
      const displayOption = interaction.data.options?.find(
        (opt) => opt.name === "display",
      );
      const saveOption = interaction.data.options?.find(
        (opt) => opt.name === "save",
      );
      character =
        characterOption && "value" in characterOption
          ? (characterOption.value as string)
          : undefined;
      server =
        serverOption && "value" in serverOption
          ? (serverOption.value as string)
          : undefined;
      displayMode =
        displayOption && "value" in displayOption
          ? (displayOption.value as string)
          : "immediate";
      saveCharacter =
        saveOption && "value" in saveOption
          ? (saveOption.value as boolean)
          : false;
    } else {
      // Handle regular message command if needed
      server = args.server;
      character = args.character;
    }

    if (harmonix.options.debug) {
      console.debug("[Lodestone] Debug: Character:", character);
      console.debug("[Lodestone] Debug: Server:", server);
      console.debug("[Lodestone] Debug: Display mode:", displayMode);
    }

    let characterId: string | null = null;
    let emoji;

    if (character && /^\d+$/.test(character)) {
      characterId = character;
      if (harmonix.options.debug) {
        console.debug(
          "[Lodestone] Debug: Character ID provided directly:",
          characterId,
        );
      }
    } else if (character && server) {
      if (harmonix.options.debug) {
        console.debug(
          "[Lodestone] Debug: Searching for character:",
          character,
          "on server:",
          server,
        );
      }
      characterId = await searchCharacter(server, character);
    }

    if (!characterId) {
      if (harmonix.options.debug) {
        console.debug("[Lodestone] Debug: Character not found");
      }
      await this.sendErrorMessage(
        harmonix,
        interaction,
        "Character not found. Please check the server name and character name, or provide a valid Lodestone ID.",
      );
      return;
    }

    if (harmonix.options.debug) {
      console.debug("[Lodestone] Debug: Character ID found:", characterId);
    }

    // If modal mode is selected, show modal immediately (before fetching data)
    if (displayMode === "modal" && interaction instanceof CommandInteraction) {
      // Create modal immediately with loading message
      await interaction.createModal({
        title: "Fetching Character Info...",
        custom_id: `lodestone_fetch_${characterId}`,
        components: [
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: "lodestone_loading",
                label: "Status",
                style: 2,
                value: "Fetching character information from Lodestone... Please wait.",
                required: false,
              },
            ],
          },
        ],
      });

      // Fetch data in background immediately
      try {
        const startTime = Date.now();
        const info = await fetchCharacterInfo(characterId);
        const fetchTime = (Date.now() - startTime) / 1000;

        let emoji;
        if (info.jobIconUrl && info.jobIconUrl.trim() !== "") {
          try {
            const imageResponse = await fetch(info.jobIconUrl);
            const imageBuffer = await imageResponse.buffer();
            const base64Image = imageBuffer.toString("base64");

            if ("guild" in interaction.channel) {
              const classLevels = info.classLevels as Record<string, ClassJobLevel>;
              const jobNameForEmoji =
                classLevels[info.activeClassJob as string]?.jobname || info.jobName;
              emoji = await interaction.channel.guild.createEmoji({
                name: `job_${jobNameForEmoji.toLowerCase().replace(/\s+/g, "_")}`,
                image: `data:image/png;base64,${base64Image}`,
              });
            }
          } catch (error) {
            console.error("[Lodestone] Failed to create emoji:", error);
          }
        }

        // Store results in cache for the results modal
        const cacheKey = `${interaction.member?.id || interaction.user?.id}_${characterId}`;
        modalResultsCache.set(cacheKey, { info, characterId, emoji, fetchTime });

        // Note: We don't send followup here - we wait for modal submit
        // The modal submit handler will send the followup with View Results button
      } catch (error) {
        console.error("[Lodestone] Error fetching character info:", error);
        // Store error state
        const cacheKey = `${interaction.member?.id || interaction.user?.id}_${characterId}`;
        modalResultsCache.set(cacheKey, { error: "Failed to fetch character data" } as any);
      }
      return;
    }

    if (harmonix.options.debug) {
      console.debug("[Lodestone] Debug: Starting execution");
    }

    if (interaction instanceof CommandInteraction) {
      await interaction.defer();
      if (harmonix.options.debug) {
        console.debug("[Lodestone] Debug: Interaction deferred");
      }
    }

    try {
      if (harmonix.options.debug) {
        console.debug("[Lodestone] Debug: Creating please wait embed");
      }
      const pleaseWaitEmbed = {
        title: "Please wait",
        description: "Fetching character information...",
        color: 0xffff00,
        footer: {
          text: "FFXIV Lodestone",
        },
      };

      let responseMessage;
      if (interaction instanceof CommandInteraction) {
        responseMessage = await interaction.createFollowup({
          embeds: [pleaseWaitEmbed],
        });
      } else {
        responseMessage = await harmonix.client.createMessage(
          interaction.channel.id,
          { embed: pleaseWaitEmbed },
        );
      }
      if (harmonix.options.debug) {
        console.debug("[Lodestone] Debug: Please wait message sent");
      }

      const startTime = Date.now();
      if (harmonix.options.debug) {
        console.debug(
          "[Lodestone] Debug: Fetching character info for ID:",
          characterId,
        );
      }
      const info = await fetchCharacterInfo(characterId);
      const fetchTime = (Date.now() - startTime) / 1000;

      // Save character ID to user profile if requested
      if (saveCharacter && interaction instanceof CommandInteraction) {
        try {
          const userId = interaction.member?.user?.id || interaction.user?.id;
          if (userId) {
            await prisma.user.updateMany({
              where: { discordId: userId },
              data: { ffxivCharacterId: characterId },
            });
            console.log(`[Lodestone] Saved character ID ${characterId} for user ${userId}`);
          }
        } catch (error) {
          console.error("[Lodestone] Error saving character ID to profile:", error);
        }
      }

      if (harmonix.options.debug) {
        console.debug(
          "[Lodestone] Debug: Character info fetched in",
          fetchTime,
          "seconds",
        );
      }

      if (info.jobIconUrl && info.jobIconUrl.trim() !== "") {
        if (harmonix.options.debug) {
          console.debug(
            "[Lodestone] Debug: Fetching job icon from URL:",
            info.jobIconUrl,
          );
        }
        const imageResponse = await fetch(info.jobIconUrl);
        const imageBuffer = await imageResponse.buffer();
        const base64Image = imageBuffer.toString("base64");

        if ("guild" in interaction.channel) {
          if (harmonix.options.debug) {
            console.debug(
              "[Lodestone] Debug: Attempting to create emoji for job:",
              info.jobName,
            );
          }
          try {
            const classLevels = info.classLevels as Record<string, ClassJobLevel>;
            const jobNameForEmoji =
              classLevels[info.activeClassJob as string]?.jobname || info.jobName;
            if (harmonix.options.debug) {
              console.debug(
                "[Lodestone] Debug: Job name for emoji:",
                jobNameForEmoji,
              );
            }

            emoji = await interaction.channel.guild.createEmoji({
              name: `job_${jobNameForEmoji.toLowerCase().replace(/\s+/g, "_")}`,
              image: `data:image/png;base64,${base64Image}`,
            });
            if (harmonix.options.debug) {
              console.debug(
                "[Lodestone] Debug: Emoji created successfully. Emoji ID:",
                emoji.id,
              );
            }
          } catch (error) {
            if (
              error.message.includes("Invalid Form Body") &&
              error.message.includes("image: Invalid image data")
            ) {
              if (harmonix.options.debug) {
                console.debug(
                  "[Lodestone] Debug: Skipping emoji creation due to invalid image data",
                );
              }
            } else {
              console.error(
                "[Lodestone] Error: Failed to create emoji:",
                error.message,
              );
            }
          }
        } else {
          if (harmonix.options.debug) {
            console.debug(
              "[Lodestone] Debug: Channel does not have a guild, skipping emoji creation",
            );
          }
        }
      } else {
        if (harmonix.options.debug) {
          console.debug(
            "[Lodestone] Debug: No active class job found, skipping emoji creation",
          );
        }
      }

      if (harmonix.options.debug) {
        console.debug("[Lodestone] Debug: Creating main embed");
      }
      const mainEmbed = this.createMainEmbed(
        info,
        characterId,
        emoji,
        fetchTime,
      );
      if (harmonix.options.debug) {
        console.debug("[Lodestone] Debug: Creating class level embed");
      }
      const classLevelEmbed = this.createClassLevelEmbed(info);

      if (harmonix.options.debug) {
        console.debug("[Lodestone] Debug: Sending final response");
      }
      if (interaction instanceof CommandInteraction) {
        await interaction.editMessage(responseMessage.id, {
          embeds: [mainEmbed, classLevelEmbed],
        });
      } else {
        await harmonix.client.editMessage(
          interaction.channel.id,
          responseMessage.id,
          { embeds: [mainEmbed, classLevelEmbed] },
        );
      }
      if (harmonix.options.debug) {
        console.debug("[Lodestone] Debug: Final response sent");
      }
    } catch (error) {
      console.error("[Lodestone] Error: Error fetching character info:", error);
      await this.sendErrorMessage(
        harmonix,
        interaction,
        "An error occurred while fetching character information. Please try again later.",
      );
    }
  }

  static createMainEmbed(
    info: CharacterInfo,
    characterId: string,
    emoji: any,
    fetchTime: number,
  ) {
    // FFXIV-themed colors
    const ffxivColors = {
      blue: 0x2d5a7d,
      gold: 0xd4af37,
      purple: 0x6b4c9a,
      red: 0x8b0000,
      green: 0x2e8b57,
    };

    // Select color based on grand company
    let embedColor = ffxivColors.blue;
    if (info.grandCompany && typeof info.grandCompany === 'object') {
      const gcName = info.grandCompany.name?.toLowerCase();
      if (gcName?.includes('immortal')) embedColor = ffxivColors.red;
      else if (gcName?.includes('maelstrom')) embedColor = ffxivColors.green;
      else if (gcName?.includes('flames')) embedColor = ffxivColors.gold;
      else if (gcName?.includes('serpents')) embedColor = ffxivColors.purple;
    }

    return {
      title: `${info.name} — ${info.server}`,
      description: info.title ? `*${info.title}*` : "No title",
      url: `https://na.finalfantasyxiv.com/lodestone/character/${characterId}/`,
      thumbnail: { url: info.avatar },
      fields: [
        {
          name: "📋 Basic Information",
          value: `**Race/Clan/Gender:** ${convertRace(info.race)} / ${convertClan(info.clan)} / ${info.gender}\n**Nameday:** ${info.nameday}\n**Guardian:** ${info.guardian}\n**City-state:** ${info.cityState}`,
          inline: false,
        },
        {
          name: "⚔️ Affiliations",
          value: `**Grand Company:** ${info.grandCompany ? (typeof info.grandCompany === "string" ? info.grandCompany : `${info.grandCompany.name} — ${info.grandCompany.rank}`) : "None"}\n**Free Company:** ${info.freeCompany ? (typeof info.freeCompany === "string" ? info.freeCompany : `${info.freeCompany.name}`) : "None"}\n**PvP Team:** ${info.pvpTeam ? (typeof info.pvpTeam === "string" ? info.pvpTeam : info.pvpTeam.name) : "None"}`,
          inline: false,
        },
        {
          name: "⚡ Active Class/Job",
          value: emoji
            ? `<:${emoji.name}:${emoji.id}> **${info.activeClassJob}** — Level ${info.activeClassJobLevel}`
            : `**${info.activeClassJob}** — Level ${info.activeClassJobLevel}`,
          inline: true,
        },
        {
          name: "🛡️ Guardian Deity",
          value: typeof info.guardianDeity === "string" ? info.guardianDeity : info.guardianDeity.name,
          inline: true,
        },
        { 
          name: "📝 Bio", 
          value: info.bio || "No bio available", 
          inline: false 
        },
      ],
      image: { url: info.portrait },
      color: embedColor,
      timestamp: new Date().toISOString(),
      footer: {
        text: `FFXIV Lodestone | ⏱️ ${fetchTime.toFixed(2)}s`,
      },
    };
  }

  static createClassLevelEmbed(info: CharacterInfo) {
    const classLevelEmbed: {
      title: string;
      fields: { name: string; value: string; inline?: boolean }[];
      color: number;
      timestamp: string;
      footer: { text: string };
    } = {
      title: `${info.name} — Class Levels`,
      fields: [],
      color: 0x5865f2,
      timestamp: new Date().toISOString(),
      footer: {
        text: "FFXIV Lodestone — Class Levels",
      },
    };

    const categories = [
      { name: "🛡️ Tanks", id: "TANK" },
      { name: "💚 Healers", id: "HEALER" },
      { name: "⚔️ Melee DPS", id: "MELEE_DPS" },
      { name: "🏹 Physical Ranged DPS", id: "PHYSICAL_RANGED_DPS" },
      { name: "🔮 Magical Ranged DPS", id: "MAGICAL_RANGED_DPS" },
      { name: "🔨 DoH", id: "DISCIPLE_OF_THE_HAND" },
      { name: "🌾 DoL", id: "DISCIPLE_OF_THE_LAND" },
      { name: "⭐ Special", id: "SPECIAL" },
    ];

    const classLevels = info.classLevels as Record<string, ClassJobLevel>;
    let foundAnyJobs = false;
    
    for (const category of categories) {
      console.debug(`Processing category: ${category}`);
      const categoryJobs = Object.entries(classLevels)
        .filter(([, data]) => (data as ClassJobLevel).categoryname === category.id)
        .sort(
          ([, a], [, b]) =>
            Number((b as ClassJobLevel).level) -
            Number((a as ClassJobLevel).level),
        );

      if (categoryJobs.length > 0) {
        foundAnyJobs = true;
        console.debug(
          `Found ${categoryJobs.length} jobs for category: ${category}`,
        );
        const jobList = categoryJobs
          .map(([, data]) => {
            console.debug(
                `Processing job: ${(data as ClassJobLevel).jobname}`,
              );
            const level = (data as ClassJobLevel).level;
            const jobName = (data as ClassJobLevel).jobname;
            const levelDisplay = level === "Class not unlocked" ? "🔒 Locked" : `**Lv. ${level}**`;
            return `${levelDisplay} ${jobName}`;
          })
          .join(" • ");

        classLevelEmbed.fields.push({
          name: category.name,
          value: jobList,
          inline: false,
        });
      } else {
        console.debug(`No jobs found for category: ${category}`);
      }
    }

    if (!foundAnyJobs) {
      console.debug(
        "No jobs found in any category. Outputting raw class level data.",
      );
      classLevelEmbed.fields.push({
        name: "Class Levels",
        value: Object.entries(classLevels)
          .map(([key, data]) => {
            if (typeof data === "object" && data !== null && "level" in data) {
              return `${key}: Level ${data.level}`;
            }
            return `${key}: Unknown`;
          })
          .join("\n"),
        inline: false,
      });
    }

    // Add Bozja and Eureka as special sections
    if (info.bozja && info.bozja.level) {
      classLevelEmbed.fields.push({
        name: "⚔️ Bozjan Southern Front",
        value: `**Resistance Rank:** ${info.bozja.level}`,
        inline: true,
      });
    }

    if (info.eureka && info.eureka.level) {
      classLevelEmbed.fields.push({
        name: "🌊 Eureka",
        value: `**Elemental Level:** ${info.eureka.level}`,
        inline: true,
      });
    }

    return classLevelEmbed;
  }

  static async sendErrorMessage(
    harmonix: Harmonix,
    interaction: CommandInteraction | Message<TextableChannel>,
    message: string,
  ) {
    if (harmonix.options.debug) {
      console.debug("[Lodestone] Debug: Sending error message:", message);
    }
    if (interaction instanceof CommandInteraction) {
      await interaction.createMessage({ content: message, flags: 64 });
    } else {
      await harmonix.client.createMessage(interaction.channel.id, message);
    }
  }
}
