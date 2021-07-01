const Discord = module.require("discord.js")

module.exports = {
  name: "shutdown",
  description: "A Command To Shutdown The Bot!",
  usage: "shutdown",
  accessableby: "Owner",
  aliases: [""],
  async execute(client, message, args) {
    
    if(message.author.id !== "540142383270985738") {

        return await message.channel.send(new Discord.MessageEmbed().setTitle("You Are Not The Bot Owner!").setColor(0xff0000).setFooter(message.guild.me.displayName).setTimestamp())
    }
	else {
		await message.channel.send(new Discord.MessageEmbed().setTitle("Bot Is Shutting Down...").setColor("GREEN").setTimestamp().setFooter(message.guild.me.displayName));
        await client.user.setPresence({
           status: "online",
           activity: {
              name: "❤️ for ya :) | Reboot or shutdown incoming - wait a bit ",
              type: "WATCHING",
           },
        });
        await new Promise(r => setTimeout(r, 5000));
        process.exit();
		
	}
  }
};
