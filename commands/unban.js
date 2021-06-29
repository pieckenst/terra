const { MessageEmbed } = require("discord.js");
const config = require("../config.json");

module.exports = {
  name: "unban",
  description: "Unban a user from the guild.",
  category: "moderation",
  aliases: [""],
  usage: "<ID>",
  permissions: ["BAN_MEMBERS"],
  async execute(client, message, args) {
    const userID = args[0];

    if (!userID) {
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
    message.guild.fetchBans().then((bans) => {
      if (bans.size == 0) {
        const err = new MessageEmbed()
          .setColor("RED")
          .setDescription("**Nobody is banned from this server!**");
        return message.channel.send(err);
      } else {
        const unbanUser = bans.find((b) => b.user.id == userID);
        if (!unbanUser) {
          const err = new MessageEmbed()
            .setColor("RED")
            .setDescription("**This user is not banned!**");
          return message.channel.send(err);
        } else {
          try {
            message.guild.members.unban(unbanUser.user);
            const unbanned = new MessageEmbed()
              .setColor("GREEN")
              .setTitle("Member Unbanned")
              .setDescription(
                `**Unbanned:** \`${unbanUser.user.tag}\`\n**Moderator:** ${message.member}`
              );
            return message.channel.send(unbanned);
          } catch (error) {
            const err = new MessageEmbed()
              .setColor("RED")
              .setDescription(
                "**Something went wrong check my perms and try again!**"
              );
            return message.channel.send(err);
          }
        }
      }
    });
  },
};
