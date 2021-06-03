const Firework = require("@luvella/firework"); // firework thing

class testcommand extends Firework.Command {
  constructor(bot) {
    super(bot, { name: "test" });
  }

  run({ message }) {
    const embed = {
      title: "Crystarium",
      description: "Eris embeds testing in discord bot",
      color: 7894174,
      timestamp: "2021-05-08T15:42:58.309Z",
      footer: {
        text: "Internal javascript bot testing - made with eris framework by Middlle#7488",
      },
      fields: [
        {
          name: "Watch the progress on github",
          value: "https://github.com/pieckenst/crystarium",
        },
        {
          name: "Otherwise this command is simply embed testing",
          value: "embed text ",
        },
        {
          name: "Inline 1",
          value: "inline text one",
          inline: true,
        },
        {
          name: "Inline 2",
          value: "inline text two",
          inline: true,
        },
      ],
    };
    message.channel.createMessage({ embed: embed });
  }
}

module.exports = testcommand;
