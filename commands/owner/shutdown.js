const Firework = require("@luvella/firework");  // firework thing
// class your command name extends Firework.Command {
class testcommand extends Firework.Command {
    constructor(bot) {
        super(bot, {name: 'shutdown'}); // instead of test your command name
    }

    run({message}) {
             await msg.delete().catch();
        await msg.channel.send(`Good night 🌙`)
        await process.exit().catch((e) => { console.error(e); });
    }
}

module.exports = Shutdown;    // instead of test command put any class name you want
