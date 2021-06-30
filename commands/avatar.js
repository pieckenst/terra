// User profile picture command

const Discord = require('discord.js');
const Canvas = require('canvas');

// ========================================== \\

module.exports = {
    name: 'avatar',
    description: 'Show user discord avatar by command',
    async execute(client, message, args) {
        let avatarinfo = new Discord.MessageEmbed()
		
		
        if(!message.mentions.users.first()) {
            avatarinfo.setDescription(`Avatar of ${message.author.tag}`)
            avatarinfo.setImage(message.author.displayAvatarURL({size: 1024, dynamic: true }))
            avatarinfo.setColor(`RANDOM`)
            avatarinfo.setTimestamp()
            avatarinfo.setFooter(`Avatar command`)
            return message.channel.send(avatarinfo);
        } else {
            let User = message.mentions.users.first()
            avatarinfo.setDescription(`Avatar of ${User.tag}`)
            avatarinfo.setImage(User.displayAvatarURL({size: 1024, dynamic: true }))
            avatarinfo.setColor(`RANDOM`)
            avatarinfo.setTimestamp()
            avatarinfo.setFooter(`Avatar command`)
            return message.channel.send(avatarinfo)
        }
    }
}