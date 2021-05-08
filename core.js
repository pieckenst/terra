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
      title: "This is online btw",
      description: "Eris embeds ",
      color: 7894174,
      timestamp: "2021-05-08T15:42:58.309Z",
      footer: {
         text: "Hello there"
       },
      fields: [
       {
        name: "Test 1",
        value: "embed text 1"
       },
       {
        name: "test 2",
        value: "embed text 2"
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
