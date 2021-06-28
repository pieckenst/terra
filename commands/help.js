const { MessageEmbed } = require('discord.js')
config = require("../config.json");

module.exports = {
    name: 'help',
    category: 'general',
    description: 'Help command - self explanatory',

    async execute(message, args) {
        let commands = message.client.commands.array();

        let helpEmbed = new MessageEmbed()
          .setTitle("Crystarium: Help")
          .setDescription("Bot commands are listed below")
          .setColor("#F8AA2A");

        commands.forEach((cmd) => {
         helpEmbed.addField(
           `**${config.prefix}${cmd.name} ${cmd.aliases ? `(${cmd.aliases})` : ""}**`,
           `${cmd.description}`,
           true
         );
        });

        helpEmbed.setTimestamp();

        return message.channel.send(helpEmbed).catch(console.error);
        }
    }
