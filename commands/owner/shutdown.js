const Firework = require("@luvella/firework");

class shutdown extends Firework.Command {
    constructor(bot) {
        super(bot, {name: 'shutdown'});
    }

    run({message}) {
        if(message.author.id != 298567553180237824) return message.reply("You can't use the command! It's Developer only!")
        if(message.author.id != 540142383270985738) return message.reply("You can't use the command! It's Developer only!")
             await msg.delete().catch();
        await msg.channel.send(`Good night 🌙`)
        await process.exit().catch((e) => { console.error(e); });
    }
}

module.exports = shutdown;
