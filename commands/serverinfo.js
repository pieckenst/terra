// Server information command 

const Discord = require('discord.js');

// ========================================== \\

module.exports = {
    name: 'serverinfo',
    description: 'Informations about discord where bot is on',
    execute(client , message, args) {
        const { guild } = message

        const { name, region, memberCount, owner, joinedAt, createdAt } = guild
        const icons = guild.iconURL()

        const infoserver = new Discord.MessageEmbed()
        .setColor('#F8AA2A')
        .setTitle(`Information about the server : ${name} `)
        .setThumbnail(icons)
        .setTimestamp()
        .addFields(
            {
            name: 'Region',
            value: region,
            },
            {
                name: 'Created At',
                value: createdAt,
            },
            {
            name: 'Member Count',
            value: memberCount,
            },
            {
            name: 'Joined At',
            value: joinedAt,
            },
            {
            name: 'Discord Owner',
            value: owner.user.tag,
            });
        message.reply(infoserver);
    }
}