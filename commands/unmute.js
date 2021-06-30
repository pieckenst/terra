const { MessageEmbed } = require('discord.js');
const config = require('../config.json');

module.exports = {

 name: 'unmute',
 description: 'Unmute a person.',
 aliases: ["unmmute"],
 usage: '<@user/ID> [Reason]',
 permissions: ["MANAGE_ROLES"],

    async execute(client, message, args) {
        const mutemember = message.mentions.members.first() || message.guild.members.cache.get(args[0])
        let muteReason = args.slice(1).join(' ');
        if(!muteReason) muteReason = "Not Specified."

        if(!mutemember){
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
        let muteRole = message.guild.roles.cache.find(r => r.name === "Muted")

        if(!muteRole){
            const err = new MessageEmbed()
                .setColor("RED")
                .setDescription(`**There is no role called \`Muted\` on this server!**`)
            return message.channel.send(err);
        } else {
            if(!mutemember.roles.cache.has(muteRole.id)) {
                const err = new MessageEmbed()
                    .setColor("RED")
                    .setDescription(`${member} **is not muted!**`)
                return message.channel.send(err);
            } else {
                await mutemember.roles.remove(muteRole)

                let embed = new MessageEmbed()
                    .setColor("GREEN")
                    .setTitle("Member Unmuted")
                    .setTimestamp()
                    .setDescription(`**Unmuted:** \`${mutemember.user.tag}\`\n**Moderator:** ${message.member}\n**Reason:** \`${muteReason}\``)
                return message.channel.send(embed); 
            }
        }
    }
}
