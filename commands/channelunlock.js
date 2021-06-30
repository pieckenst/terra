const { MessageEmbed } = require('discord.js');

module.exports = {

 name: 'channelunlock',
 description: 'Unlocks a channel.',
 category: 'moderator',
 aliases: ["chanunlock"],
 usage: '',
 permissions: ["MANAGE_CHANNELS"],

    async execute(client, message, args) {
        let channel = message.channel;

        try {
            message.guild.roles.cache.forEach(role => {
                channel.createOverwrite(role, {
                    SEND_MESSAGES: true,
                    ADD_REACTIONS: true
                });
            });
        } catch (e) {
            console.log(e);
        }

        message.channel.send(`Done | Channel Unlocked!`);
    }
}