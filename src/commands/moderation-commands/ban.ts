import { Message, Member, GuildChannel, TextableChannel } from 'eris';
import { Harmonix } from '../../core';

export default {
  name: "ban",
  description: "Ban a user from the guild.",
  category: "moderation",
  aliases: [""],
  usage: "<@user/ID> [reason]",
  execute: async (harmonix: Harmonix, msg: Message, args: string[]) => {
    if (!(msg.channel instanceof GuildChannel)) {
      return sendErrorEmbed(harmonix, msg, "This command can only be used in a guild.");
    }

    const userId = msg.mentions[0]?.id || args[0];
    const banReason = args.slice(1).join(" ") || "Not Specified.";

    if (!userId) {
      return sendMissingArgsEmbed(harmonix, msg, this);
    }

    const guild = (msg.channel as GuildChannel).guild;
    const banMember = guild.members.get(userId);

    if (!banMember) {
      return sendErrorEmbed(harmonix, msg, "User not found.");
    }

    if (!canBanMember(msg.member!, banMember)) {
      return sendErrorEmbed(harmonix, msg, "You don't have permission to ban this user.");
    }

    try {
      await guild.banMember(userId, 0, banReason);
      await sendBanDM(harmonix.client, banMember, guild, banReason, msg.author);
      await sendBanConfirmation(harmonix, msg, banMember, banReason);
    } catch (error) {
      console.error("Ban error:", error);
      return sendErrorEmbed(harmonix, msg, "An error occurred while trying to ban the user.");
    }
  },
};

function sendMissingArgsEmbed(harmonix: Harmonix, message: Message, command: any) {
  const embed = {
    color: 0xFF0000,
    title: "Missing arguments",
    description: `**Command:** \`${command.name}\`\n**Description:** \`${command.description || "None"}\`\n**Aliases:** \`${command.aliases.join(", ") || "None"}\`\n**Usage:** \`${command.name} ${command.usage}\`\n**Permissions:** \`${command.permissions || "None"}\``,
    timestamp: new Date()
  };
  return harmonix.client.createMessage(message.channel.id, { embed });
}

function sendErrorEmbed(harmonix: Harmonix, message: Message, errorMessage: string) {
  const embed = {
    color: 0xFF0000,
    description: errorMessage
  };
  return harmonix.client.createMessage(message.channel.id, { embed });
}

function canBanMember(moderator: Member, targetMember: Member) {
  return moderator.permissions.has("banMembers");} // should error when the role does not have ban permission
// one flaw is theoretically moderator can ban admin or other moderator- that has to get fixed

async function sendBanDM(client: Harmonix['client'], banMember: Member, guild: GuildChannel['guild'], reason: string, moderator: Message['author']) {  const dmChannel = await client.getDMChannel(banMember.id);
  const embed = {
    color: 0x0000FF,
    title: "You have been banned!",
    description: `**Server:** \`${guild.name}\`\n**Reason:** \`${reason}\`\n**Moderator:** \`${moderator.username}#${moderator.discriminator}\``
  };
  return dmChannel.createMessage({ embed }).catch(() => {});
}

function sendBanConfirmation(harmonix: Harmonix, message: Message, banMember: Member, reason: string) {
  const embed = {
    color: 0x00FF00,
    title: "Member Banned",
    description: `**Banned:** \`${banMember.username}#${banMember.discriminator}\`\n**Moderator:** ${message.author.mention}\n**Reason:** \`${reason}\``,
    timestamp: new Date()
  };
  return harmonix.client.createMessage(message.channel.id, { embed });
}
