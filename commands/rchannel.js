const { MessageEmbed } = require('discord.js');

module.exports = {

 name: 'recreatechannel',
 description: 'Deletes the channel and all messages in it and then recreates it with empty contents.',
 category: 'moderator',
 aliases: ["rchannel"],
 usage: '',
 permissions: ["MANAGE_CHANNELS"],

    async execute(client, message, args) {
        let channel = client.channels.cache.get(message.channel.id);
        const position = channel.position;
        const topic = channel.topic;
    
        const channel2 = await channel.clone();
    
        channel2.setPosition(position);
        channel2.setTopic(topic);
        channel.delete();

        const infocomplete = new MessageEmbed()
            .setColor("BLUE")
            .setDescription("```The channel has been cleared of contents```")
        return channel2.send(infocomplete);
    }
}