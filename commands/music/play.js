const Firework = require("@luvella/firework"); // firework thing

class testcommand extends Firework.Command {
  constructor(bot) {
    super(bot, { name: "test" });
  }

  run({ message }) {}
}

module.exports = testcommand;
