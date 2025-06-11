import { defineCommand } from "../../../discordkit/utils/command";
import {
  Message,
  Member,
  GuildChannel,
  TextableChannel,
  CommandInteraction,
  ComponentInteraction,
  User,
  Constants,
  ModalSubmitInteraction,
  InteractionDataOptions
} from "eris";
import { Harmonix } from "../../../discordkit/types/harmonixtypes";

export default class extends defineCommand({
  name: "ban",
  description: "Ban a user from the guild.",
  category: "moderation",
  usage: "<@user/ID> [reason]",
  slashCommand: true,
  type: Constants.ApplicationCommandTypes.USER, // User Context Menu
  permissions: {
    bot: ["banMembers"],
    user: ["banMembers"],
  },
  options: [
    {
      type: Constants.ApplicationCommandOptionTypes.USER,
      name: "user",
      description: "The user to ban",
      required: true,
    },
    {
      type: Constants.ApplicationCommandOptionTypes.STRING,
      name: "reason",
      description: "The reason for the ban",
      required: false,
    },
  ],
}) {
  static async execute(
    harmonix: Harmonix,
    context: Message<TextableChannel> | CommandInteraction,
    args: string[] | InteractionDataOptions[],
  ) {
    if (!(context.channel instanceof GuildChannel)) {
      if (context instanceof Message) {
        return sendErrorEmbed(harmonix, context, "❌ This command can only be used in a server.");
      }
      return context.createMessage({ content: "❌ This command can only be used in a server.", flags: 64 });
    }

    let targetUser: User | undefined;
    let reason: string | undefined;

    if (context instanceof Message) {
      const userId = context.mentions[0]?.id || (args as string[])[0];
      if (!userId) return sendMissingArgsEmbed(harmonix, context, (this as any).config);
      targetUser = await harmonix.client.getRESTUser(userId).catch(() => undefined);
      reason = (args as string[]).slice(1).join(' ') || undefined;
    } else { // Interaction
      if (harmonix.options.debug) {
        console.log(`[DEBUG] Interaction received. Type: ${context.data.type}`);
        console.log(`[DEBUG] Resolved data: ${JSON.stringify(context.data.resolved, null, 2)}`);
      }

      if (context.data.type === Constants.ApplicationCommandTypes.USER) { // User Context Menu
        if (harmonix.options.debug) console.log(`[DEBUG] User Context Menu path. Target ID: ${context.data.target_id}`);
        targetUser = context.data.target_id ? context.data.resolved?.users?.get(context.data.target_id) : undefined;
      } else { // Slash Command
        if (harmonix.options.debug) console.log(`[DEBUG] Slash Command path. Raw Args: ${JSON.stringify(args, null, 2)}`);
        const options = args as InteractionDataOptions[];
        const userOption = options.find(opt => opt.name === 'user');
        const reasonOption = options.find(opt => opt.name === 'reason');

        let userId: string | undefined;
        if (userOption && 'value' in userOption) {
            userId = userOption.value as string | undefined;
        }
        if (reasonOption && 'value' in reasonOption) {
            reason = reasonOption.value as string | undefined;
        }

        if (harmonix.options.debug) {
          console.log(`[DEBUG] Extracted User ID: ${userId}`);
          console.log(`[DEBUG] Extracted Reason: ${reason}`);
        }

        if (userId) {
            const resolvedUsers = context.data.resolved?.users;
            if (harmonix.options.debug) console.log(`[DEBUG] Resolved users map: ${JSON.stringify(resolvedUsers, null, 2)}`);
            if (resolvedUsers) {
                if (harmonix.options.debug) console.log(`[DEBUG] Attempting lookup with key: '${userId}' using .get() method.`);
                targetUser = resolvedUsers.get(userId);
            }
        }
      }
      if (harmonix.options.debug) console.log(`[DEBUG] Final targetUser object: ${JSON.stringify(targetUser, null, 2)}`);
    }

    if (!targetUser) {
      if (context instanceof Message) {
        return sendErrorEmbed(harmonix, context, "❌ User not found.");
      }
      return context.createMessage({ content: "❌ User not found.", flags: 64 });
    }

    if (context instanceof CommandInteraction) {
      return context.createModal({
        title: `Banning ${targetUser.username}`,
        custom_id: `${(this as any).config.name}_${targetUser.id}`,
        components: [
          {
            type: Constants.ComponentTypes.ACTION_ROW, 
            components: [
              {
                type: Constants.ComponentTypes.TEXT_INPUT,
                custom_id: 'reason',
                label: 'Reason for ban',
                style: Constants.TextInputStyles.PARAGRAPH,
                placeholder: 'No reason provided',
                required: false,
                value: reason, // Pre-fill from slash command
              },
            ],
          },
        ],
      });
    } else if (context instanceof Message) {
      const finalReason = reason || "No reason provided";
      const moderator = context.member!;
      const botMember = context.channel.guild.members.get(harmonix.client.user.id)!;
      const targetMember = await context.channel.guild.getRESTMember(targetUser.id).catch(() => undefined);
      
      if (!targetMember) return sendErrorEmbed(harmonix, context, "❌ User not found in this server.");

      if (!canBanMember(moderator, targetMember)) return sendErrorEmbed(harmonix, context, "❌ You can't ban this user due to role hierarchy.");
      if (!canBanMember(botMember, targetMember)) return sendErrorEmbed(harmonix, context, "❌ I can't ban this user due to role hierarchy.");

      try {
        await context.channel.guild.banMember(targetMember.id, 0, `Banned by ${moderator.user.username}: ${finalReason}`);
        await sendBanDM(harmonix.client, targetMember, context.channel.guild, finalReason, moderator.user);
        return sendBanConfirmation(harmonix, context, targetMember.user, finalReason);
      } catch (error) {
        console.error("Ban error:", error);
        return sendErrorEmbed(harmonix, context, `❌ Failed to ban user: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  static async onComponentInteraction(harmonix: Harmonix, interaction: ComponentInteraction | ModalSubmitInteraction) {
    if (!(interaction instanceof ModalSubmitInteraction)) return;
    if (!(interaction.channel instanceof GuildChannel) || !interaction.member) return;

    const targetId = interaction.data.custom_id.split('_')[1];
    const reason = interaction.data.components[0].components[0].value || "No reason provided";

    await interaction.defer();

    const moderator = interaction.member;
    const botMember = interaction.channel.guild.members.get(harmonix.client.user.id)!;
    const targetMember = await interaction.channel.guild.getRESTMember(targetId).catch(() => undefined);

    if (!targetMember) {
        return sendErrorEmbed(harmonix, interaction, "❌ User not found in this server.");
    }

    if (!canBanMember(moderator, targetMember)) {
        return sendErrorEmbed(harmonix, interaction, "❌ You can't ban this user due to role hierarchy.");
    }
    if (!canBanMember(botMember, targetMember)) {
        return sendErrorEmbed(harmonix, interaction, "❌ I can't ban this user due to role hierarchy.");
    }

    try {
      await interaction.channel.guild.banMember(targetMember.id, 0, `Banned by ${moderator.user.username}: ${reason}`);
      await sendBanDM(harmonix.client, targetMember, interaction.channel.guild, reason, moderator.user);
      
      return sendBanConfirmation(harmonix, interaction, targetMember.user, reason);
    } catch (error) {
      console.error("Ban error (modal):", error);
      return sendErrorEmbed(harmonix, interaction, `❌ Failed to ban user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// --- HELPER FUNCTIONS --- //

function sendMissingArgsEmbed(
  harmonix: Harmonix,
  message: Message,
  command: any,
) {
  const embed = {
    color: 0xff0000,
    title: "Missing arguments",
    description: `**Command:** \`${command.name}\`\n**Description:** \`${command.description || "None"}\`\n**Aliases:** \`${command.aliases?.join(", ") || "None"}\`\n**Usage:** \`${command.name} ${command.usage}\`\n**Permissions:** \`${JSON.stringify(command.permissions) || "None"}\``,
    timestamp: new Date(),
  };
  return harmonix.client.createMessage(message.channel.id, { embed });
}

async function sendErrorEmbed(
  harmonix: Harmonix,
  context: Message | CommandInteraction | ModalSubmitInteraction,
  message: string,
) {
  const embed = {
    color: 0xff0000,
    description: message,
  };
  if (context instanceof Message) {
    return await harmonix.client.createMessage(context.channel.id, { embeds: [embed] });
  } else {
    if (context.acknowledged) {
      return await context.createFollowup({ embeds: [embed], flags: 64 });
    }
    return await context.createMessage({ embeds: [embed], flags: 64 });
  }
}

function canBanMember(moderator: Member, targetMember: Member): boolean {
  if (!moderator.permissions.has('banMembers')) {
    return false;
  }

  if (moderator.guild.ownerID === moderator.id) {
    return true;
  }

  if (targetMember.id === targetMember.guild.ownerID) {
    return false;
  }

  const moderatorHighestRole = Math.max(...moderator.roles.map(r => moderator.guild.roles.get(r)?.position || 0));
  const targetHighestRole = Math.max(...targetMember.roles.map(r => targetMember.guild.roles.get(r)?.position || 0));
  
  return moderatorHighestRole > targetHighestRole;
}

async function sendBanDM(
  client: Harmonix["client"],
  banMember: Member,
  guild: GuildChannel["guild"],
  reason: string,
  moderator: User,
) {
  const dmChannel = await client.getDMChannel(banMember.id);
  const embed = {
    color: 0xff0000,
    title: "You have been banned!",
    description: `**Server:** \`${guild.name}\`\n**Reason:** \`${reason}\`\n**Moderator:** \`${moderator.username}#${moderator.discriminator}\``,
  };
  return dmChannel.createMessage({ embed }).catch(() => {});
}

async function sendBanConfirmation(
  harmonix: Harmonix,
  context: Message | CommandInteraction | ModalSubmitInteraction,
  banUser: User,
  reason: string,
) {
  const moderator = context instanceof Message ? context.author : context.member!.user;
  const embed = {
    color: 0x00ff00,
    title: "✅ Member Banned",
    description: [
      `**User:** <@${banUser.id}> (\`${banUser.username}#${banUser.discriminator}\`)`,
      `**Moderator:** <@${moderator.id}>`,
      `**Reason:** \`${reason}\``,
      `\n*User was successfully banned from the server.*`
    ].join('\n'),
    timestamp: new Date(),
    footer: {
      text: `User ID: ${banUser.id}`
    }
  };
  
  try {
    if (context instanceof Message) {
      return await harmonix.client.createMessage(context.channel.id, { embeds: [embed] });
    } else {
      if (context.acknowledged) {
        return await context.createFollowup({ embeds: [embed] });
      }
      return await context.createMessage({ embeds: [embed] });
    }
  } catch (error) {
    console.error('Failed to send ban confirmation:', error);
  }
}
