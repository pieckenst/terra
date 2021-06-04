const Firework = require("@luvella/firework"); // firework thing

class playcommand extends Firework.Command {
  constructor(bot) {
    super(bot, { name: "play" });
  }

  run({ message }) {}
}

module.exports = playcommand;
