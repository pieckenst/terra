const Discord = module.require("discord.js")

module.exports = {
  name: "shutdown",
  description: "A Command To Shutdown The Bot!",
  usage: "shutdown",
  accessableby: "Owner",
  aliases: [""]
  async execute(message, args) {
    if(!message.author.id === "540142383270985738") return message.channel.send(new Discord.MessageEmbed().setTite("You Are Not The Bot Owner!").setColor(0xff0000).setFooter(message.guild.me.displayName).setTimestamp());

    await message.channel.send(new Discord.MessageEmbed().setTitle("Bot Is Shutting Down...").setColor("GREEN").setTimestamp().setFooter(message.guild.me.displayName));
    process.exit();
  },
};
