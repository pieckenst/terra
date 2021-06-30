const levels = {
    0: 0.0,
    1: 0.50,
    2: 1.0,
    3: 2.0,
  };
  
  module.exports = {
    name: "bassboost",
    aliases: ['bb','bassboost'],
    description: "Set filter/bassboost level",
    async execute(client, message, args) {
      const player = message.client.manager.get(message.guild.id);
      if (!player) return message.reply("there is no player for this guild.");
  
      const { channel } = message.member.voice;
      
      if (!channel) return message.reply("you need to join a voice channel.");
      if (channel.id !== player.voiceChannel) return message.reply("you're not in the same voice channel.");
  
      let level = "0";
      if (args.length && args[0].toLowerCase() in levels) level = args[0].toLowerCase();
  
      const bands = new Array(3)
        .fill(null)
        .map((_, i) =>
          ({ band: i, gain: levels[level] })
        );
  
      player.setEQ(...bands);
  
      return message.reply(`set the bassboost level to ${level}`);
    }
  }
