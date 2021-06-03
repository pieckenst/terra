// const Eris = require("eris") // eris depend
const Firework = require("@luvella/firework"); // firework thing
require("dotenv").config();
const token = process.env.token;
// let bot = new Eris(token); // eris client
const bot = new Firework.Client(token); // firework client thing
const prefix = "cryst.";

bot.on("ready", () => {
  console.log("[CRYSTARIUM] Bot started and ready");
});

bot.once("ready", async () => {
  await bot.editStatus({
    name: "CRYSTARIUM ALPHA TEST - Framework: Eris , Language : JS",
  });
});

bot.loadCommands("./commands");

bot.on("messageCreate", async (message) => {
  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(" ");
  const command = args.shift().toLowerCase();

  const cmd = bot.getCommand(command); // works with the name and aliases as well
  if (!cmd) return;

  cmd.run({ message });
});

bot.connect();
