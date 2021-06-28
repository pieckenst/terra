const { MessageEmbed } = require('discord.js');
module.exports = {
name: 'kick',
category: 'moderation',
description: 'This will kick a user of your choice from the server',
async execute(message, args) {
    const kickmember = message.mentions.members.first() || message.guild.members.cache.get(args[0])
        let kickReason = args.slice(1).join(' ');
        if(!kickReason) kickReason = "Not Specified."

        if(!kickmember){
            const missingArgs = new MessageEmbed()
                .setColor("RED")
                .setTitle("Missing arguments")
                .setDescription(`**Command:** \`${this.name}\`\n**Description:** \`${this.description || "None"}\`\n**Aliases:** \`${this.aliases.join(", ") || "None"}\`\n**Usage:** \`${config.prefix}${this.name}${this.usage}\`\n**Permissions:**\`${this.permissions || "None"}\``)
                .setTimestamp()
            return message.channel.send(missingArgs);
        }

        if (!kickmember.kickable) {
            const err = new MessageEmbed()
                .setColor("RED")
                .setDescription(`**That person can't be kicked!**`)
            return message.channel.send(err);
        }

        if (message.guild.me.roles.highest.comparePositionTo(kickmember.roles.highest) < 0){
            if (message.guild.me.roles.highest.comparePositionTo(banmember.roles.highest) < 0){
                const err = new MessageEmbed()
                    .setColor("RED")
                    .setDescription(`**My role must be higher than \`${kickmember.user.tag}\` highest role!**`)
                return message.channel.send(err);
            }
        }

        try {
            kickmember.kick(kickReason);
            const kick = new MessageEmbed()
                .setColor("BLUE")
                .setTitle("You have been kicked!")
                .setDescription(`**Server: \`${message.guild.name}\`\nReason:\`${kickReason}\`\nModerator: \`${message.author.tag}\`**`)
            kickmember.send(kick).catch(err => null);

            let embed = new MessageEmbed()
                .setColor("GREEN")
                .setTitle("Member Kicked")
                .setTimestamp()
                .setDescription(`**Kicked:** \`${kickmember.user.tag}\`\n**Moderator:** ${message.member}\n**Reason:** \`${kickReason}\``)
            return message.channel.send(embed);
        } catch (error) {
            const err = new MessageEmbed()
                .setColor("RED")
                .setDescription(`**Something went wrong check my perms and try again!**`)
            return message.channel.send(err);
        }
    }
};