const { MessageEmbed } = require('discord.js');
const config = require('../config.json');

module.exports = {
 name: 'pmute',
 description: 'Permanently mute a person.',
 aliases: ["permmute"],
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
        if(mutemember == message.member){
            const err = new MessageEmbed()
                .setColor("RED")
                .setDescription(`**You cannot mute yourself!**`)
            return message.channel.send(err);
        }
        if (mutemember.roles.highest.position >= message.member.roles.highest.position){
            const err = new MessageEmbed()
                .setColor("RED")
                .setDescription(`**You cannot mute someone with an equal or higher role!**`)
            return message.channel.send(err);
        }

        let muteRole = message.guild.roles.cache.find(r => r.name === "Muted") 

        if(!muteRole){
            try {
                muteRole = await message.guild.roles.create({
                    data: {
                        name: "Muted",
                        color: "#000000",
                        permissions: []
                    },
                    reason: "Creating a muted role."
                })
                message.guild.channels.cache.forEach((channel) => {
                    channel.overwritePermissions([
                        {
                            id: muteRole.id,
                            deny: ['SEND_MESSAGES', 'ADD_REACTIONS']
                        }
                    ]);
                });
            } catch (error) {
                const err = new MessageEmbed()
                    .setColor("RED")
                    .setDescription(`**Something went wrong check my perms and try again!**`)
                return message.channel.send(err);
            }

            try {
                await mutemember.roles.add(muteRole);
            } catch (error) {
                const err = new MessageEmbed()
                    .setColor("RED")
                    .setDescription(`**Something went wrong check my perms and try again!**`)
                return message.channel.send(err);
            }
            const mute = new MessageEmbed()
                .setColor("BLUE")
                .setDescription(`**You have been __muted__ in \`${message.guild.name}\` for \`${muteReason}\`!**`)
            await mutemember.send(mute).catch(err => null);

            message.delete({ timeout: 2000 }).catch(err => null);

            let embed = new MessageEmbed()
                .setColor("GREEN")
                .setTitle("Member Muted")
                .setTimestamp()
                .setDescription(`**Muted:** \`${mutemember.user.tag}\`\n**Moderator:** ${message.member}\n**Reason:** \`${muteReason}\``)
            return message.channel.send(embed);
        } else {
            try {
                await mutemember.roles.add(muteRole);
            } catch (error) {
                const err = new MessageEmbed()
                    .setColor("RED")
                    .setDescription(`**Something went wrong check my perms and try again!**`)
                return message.channel.send(err);
            }
            const mute = new MessageEmbed()
                .setColor("BLUE")
                .setDescription(`**You have been __muted__ in \`${message.guild.name}\` for \`${muteReason}\`!**`)
            await mutemember.send(mute).catch(err => null);

            let embed = new MessageEmbed()
                .setColor("GREEN")
                .setTitle("Member Muted")
                .setTimestamp()
                .setDescription(`**Muted:** \`${mutemember.user.tag}\`\n**Moderator:** ${message.member}\n**Reason:** \`${muteReason}\``)
            return message.channel.send(embed);
        }
    }
}