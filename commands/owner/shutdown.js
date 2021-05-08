const Firework = require("@luvella/firework");  // firework thing
// class your command name extends Firework.Command {
class testcommand extends Firework.Command {
    constructor(bot) {
        super(bot, {name: 'shutdown'}); // instead of test your command name
    }

    run({message}) {
      
    }
}

module.exports = shutdown;    // instead of test command put any class name you want
