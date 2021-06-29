const { MessageEmbed } = require("discord.js");
const config = require("../config.json");

module.exports = {
  name: "ban",
  description: "Ban a user from the guild.",
  category: "moderation",
  aliases: [""],
  usage: "<@user/ID> [reason]",
  permissions: ["BAN_MEMBERS"],

  async execute(client, message, args) {
    const banmember =
      message.mentions.members.first() ||
      message.guild.members.cache.get(args[0]);
    let banReason = args.join(" ").slice(23);
    if (!banReason) banReason = "Not Specified.";

    if (!banmember) {
      const missingArgs = new MessageEmbed()
        .setColor("RED")
        .setTitle("Missing arguments")
        .setDescription(
          `**Command:** \`${this.name}\`\n**Description:** \`${
            this.description || "None"
          }\`\n**Aliases:** \`${
            this.aliases.join(", ") || "None"
          }\`\n**Usage:** \`${config.prefix}${this.name}${
            this.usage
          }\`\n**Permissions:**\`${this.permissions || "None"}\``
        )
        .setTimestamp();
      return message.channel.send(missingArgs);
    }

    if (!banmember.bannable) {
      const err = new MessageEmbed()
        .setColor("RED")
        .setDescription("**That person can't be banned!**");
      return message.channel.send(err);
    }

    if (
      message.guild.me.roles.highest.comparePositionTo(
        banmember.roles.highest
      ) < 0
    ) {
      const err = new MessageEmbed()
        .setColor("RED")
        .setDescription(
          `**My role must be higher than \`${banmember.user.tag}\` highest role!**`
        );
      return message.channel.send(err);
    }

    try {
      banmember.ban({ reason: banReason });

      const kick = new MessageEmbed()
        .setColor("BLUE")
        .setTitle("You have beek banned!")
        .setDescription(
          `**Server: \`${message.guild.name}\`\nReason:\`${banReason}\`\nModerator: \`${message.author.tag}\`**`
        );
      banmember.send(kick).catch((err) => null);

      const embed = new MessageEmbed()
        .setColor("GREEN")
        .setTitle("Member Banned")
        .setTimestamp()
        .setDescription(
          `**Banned:** \`${banmember.user.tag}\`\n**Moderator:** ${message.member}\n**Reason:** \`${banReason}\``
        );
      return message.channel.send(embed);
    } catch (error) {
      const err = new MessageEmbed()
        .setColor("RED")
        .setDescription(
          "**Something went wrong check my perms and try again!**"
        );
      return message.channel.send(err);
    }
  },
};
