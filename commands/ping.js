module.exports = {
  name: "ping",
  description: "Ping!",
  execute(message, args) {
    const embed = {
      title: "Ping",
      description: "```test```",
      color: 7338060,
      footer: {
        text: "Crystarium - Based on discord.js now instead of eris",
      },
    };
    message.channel.send({ embed });
  },
};
