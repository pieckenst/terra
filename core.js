const Eris = require("eris");
require('dotenv').config();
var token = process.env.token;
let bot = new Eris(process.env.TOKEN);
let prefix = "cryst.";

bot.on("ready", () => {
 console.log("[CRYSTARIUM] Bot started and ready") 
});

bot.on("messageCreate", async message => {
 if (message.author.bot || !message.channel.guild) return;
 if (!message.content.startsWith(prefix)) return;
 
 if (!message.content.startsWith('${prefix}test')) {
	return message.channel.createMessage("Im online!"); 
 } 
});

bot.connect();