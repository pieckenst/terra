const Firework = require("@luvella/firework");

class shutdown extends Firework.Command {
  constructor(bot) {
    super(bot, { name: "shutdown" });
  }

  run({ message }) {
    // if(message.author.id != 540142383270985738) return message.channel.createMessage("You can't use the command! It's Developer only!")  // this is not working for reasons
    // if(message.author.id != 540142383270985738) return message.channel.createMessage("You can't use the command! It's Developer only!")
    message.channel.createMessage("Shutting down the bot");
    console.log("Shutting down");
    process.exit().catch((e) => {
      console.error(e);
    });
  }
}

module.exports = shutdown;
