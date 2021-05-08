const Eris = require("eris");
require('dotenv').config();
var token = process.env.token;
let bot = new Eris(process.env.TOKEN);
let prefix = "cryst.";

bot.on("ready", () => {
 console.log("[CRYSTARIUM] Bot started and ready")
});

bot.once("ready", async () => {
  await bot.editStatus({ name: `CRYSTARIUM ALPHA TEST - Framework: Eris , Language : JS`});
});

bot.on("messageCreate", async message => {
 if (message.author.bot || !message.channel.guild) return;
 if (!message.content.startsWith(prefix)) return;

 if (!message.content.startsWith('${prefix}test')) {

    let embed = {
      title: "Crystarium",
      description: "Eris embeds testing in discord bot",
      color: 7894174,
      timestamp: "2021-05-08T15:42:58.309Z",
      footer: {
         text: "Internal javascript bot testing - made with eris framework by Middlle#7488"
       },
      fields: [
       {
        name: "Watch the progress on github",
        value: "https://github.com/pieckenst/crystarium"
       },
       {
        name: "Otherwise this command is simply embed testing",
        value: "embed text "
       },
       {
        name: "Inline 1",
        value: "inline text one",
        inline: true
       },
       {
        name: "Inline 2",
        value: "inline text two",
        inline: true
       }
	  ]
    };

 return message.channel.createMessage({embed :embed});
 }
});

bot.connect();
