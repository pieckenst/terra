const { MessageEmbed } = require("discord.js");
const config = require("../config.json");

module.exports = {
  name: "clear",
  description: "Purge messages in a channel.",
  category: "moderation",
  aliases: [""],
  usage: "<#messages>",
  permissions: ["MANAGE_MESSAGES"],
  async execute(client, message, args) {
    const amount = parseInt(args[0]);

    if (isNaN(amount) || !amount || amount < 0) {
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

    let purgelimit = amount + 1;
    if (purgelimit > 100) purgelimit = 100;

    messages = await message.channel.messages.fetch({ limit: purgelimit });

    message.channel
      .bulkDelete(messages)
      .then((messages) => {
        const succes = new MessageEmbed()
          .setColor("GREEN")
          .setDescription(
            `**Succesfully deleted** \`${messages.size}\` **messages.**`
          );
        return message.channel
          .send(succes)
          .then((msg) => msg.delete({ timeout: 5000 }))
          .catch((err) => null);
      })
      .catch((error) => {
        const err = new MessageEmbed()
          .setColor("RED")
          .setDescription("**Unable to delete messages older than 2 weeks.**");
        return message.channel
          .send(err)
          .then((msg) => msg.delete({ timeout: 5000 }))
          .catch((err) => null);
      });
  },
};
