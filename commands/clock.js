const { MessageEmbed } = require('discord.js');

module.exports = {

 name: 'channellock',
 description: 'Locks a channel.',
 category: 'moderator',
 aliases: ["clock"],
 usage: '',
 permissions: ["MANAGE_CHANNELS"],

    async execute(client, message, args) {
        let channel = message.channel;

        try {
            message.guild.roles.cache.forEach(role => {
                channel.createOverwrite(role, {
                    SEND_MESSAGES: false,
                    ADD_REACTIONS: false
                });
            });
        } catch (e) {
            console.log(e);
        }

        message.channel.send(`Done | Channel Locked!`);
    }
}