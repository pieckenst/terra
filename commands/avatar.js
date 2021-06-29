// User profile picture command

const Discord = require('discord.js');

// ========================================== \\

module.exports = {
    name: 'avatar',
    description: 'Show user discord avatar by command',
    execute(client, message, args) {
        let avatarinfo = new Discord.MessageEmbed()
        if(!message.mentions.users.first()) {
            avatarinfo.setDescription(`Avatar of ${User.tag}`)
            avatarinfo.setImage(User.displayAvatarURL())
            avatarinfo.setColor(`RANDOM`)
            avatarinfo.setTimestamp()
            avatarinfo.setFooter(`Avatar command`)
            return message.channel.send(avatarinfo);
        } else {
            let User = message.mentions.users.first()
            avatarinfo.setDescription(`Avatar of ${User.tag}`)
            avatarinfo.setImage(User.displayAvatarURL())
            avatarinfo.setColor(`RANDOM`)
            avatarinfo.setTimestamp()
            avatarinfo.setFooter(`Avatar command`)
            return message.channel.send(avatarinfo)
        }
    }
}