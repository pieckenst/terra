module.exports = {
  name: "ping",
  description: "Ping!",
  execute(client, message, args) {
    const embed = {
      title: "Ping",
      description: "```test```",
      color: 7338060,
      footer: {
        text: "Terra - Based on discord.js now instead of eris",
      },
    };
    message.channel.send({ embed });
  },
};
