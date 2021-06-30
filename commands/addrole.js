const { MessageEmbed } = require('discord.js');
const config = require('../config.json');

module.exports = {
  name: "addrole",
  description: "Adds the specified role to the provided user.",
  aliases: [""],
  usage: '<@user/ID> <@role/ID>',
  permissions: ["MANAGE_ROLES"],
  async execute(client, message, args) {
     const member = message.mentions.members.first() || message.guild.members.cache.get(args[0])
        
        const role = message.guild.roles.cache.get(args[1]) || 
        message.guild.roles.cache.find(r => r.name === args[1]) || 
        message.mentions.roles.first();

        if(!member || !role){
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
        } else {
            try {
				if (message.guild.me.roles.highest.comparePositionTo(role) < 0) {
                    const err = new MessageEmbed()
                        .setColor("RED")
                        .setDescription("**I cannot give this role!**")
                    return message.channel.send(err);
				} else {
					if (member.roles.cache.has(role.id)) {
                        const err = new MessageEmbed()
                            .setColor("RED")
                            .setDescription(`${member} **already has ${role} role!**`)
                        return message.channel.send(err);
					} else {
						member.roles.add(role).then(() => {
                            const succes = new MessageEmbed()
                                .setColor("GREEN")
                                .setDescription(`**Succesfully added ${role} role for ${member}!**`)
                            return message.channel.send(succes);
                        }).catch((error) => {
                            const err = new MessageEmbed()
                                .setColor("RED")
                                .setDescription("**I cannot give this role!**")
                            return message.channel.send(err);
                        });
					}
				}
			} catch (error) {
				const err = new MessageEmbed()
                    .setColor("RED")
                    .setDescription("**I cannot give this role!**")
                return message.channel.send(err);
			}
        }
    }
}