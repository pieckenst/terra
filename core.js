const fs = require("fs");
const Discord = require("discord.js");

const { Manager } = require("erela.js");
const Spotify  = require("erela.js-spotify");
const { prefix } = require("./config.json");
const config = require('./config.json');
require("dotenv").config();
var token = process.env.token;
const disbut = require("discord-buttons");

const client = new Discord.Client({ intents: Discord.Intents.All });
client.commands = new Discord.Collection();
client.cooldowns = new Discord.Collection();
const clientID = config.clientID; 
const clientSecret = config.clientSecret;
disbut(client);

const commandFiles = fs
  .readdirSync("./commands")
  .filter((file) => file.endsWith(".js"));

for (const file of commandFiles) {
  const command = require(`./commands/${file}`);
  // set a new item in the Collection
  // with the key as the command name and the value as the exported module
  client.commands.set(command.name, command);
  console.log(`[UPSTART] Loaded ${file} `);
}

client.manager = new Manager({
	plugins: [
		
		new Spotify({
		  clientID,
		  clientSecret
		})
	  ],
  nodes: [{
    host: config.host,
	port: config.port,
	password: config.password,
    retryDelay: 5000,
  }],
  autoPlay: true,
  send: (id, payload) => {
    const guild = client.guilds.cache.get(id);
    if (guild) guild.shard.send(payload);
  }
})
  .on("nodeConnect", node => console.log(`Node "${node.options.identifier}" has connected.`))
  .on("nodeError", (node, error) => console.log(
    `Node "${node.options.identifier}" encountered an error: ${error.message}.`
  ))
  .on("trackStart", (player, track) => {
    const channel = client.channels.cache.get(player.textChannel);
    const embed = new Discord.MessageEmbed()
    .setColor('RANDOM')
    .setAuthor(` | NOW PLAYING`, client.user.displayAvatarURL({
      dynamic: true
    }))
    .setDescription(`[${track.title}](${track.uri})`)
    .addField(`Requested By : `,`${track.requester}` , true)
  
    return channel.send(embed);
  })
  .on("trackStuck", (player, track) => {
    const channel = client.channels.cache.get(player.textChannel);
    const embed = new Discord.MessageEmbed()
    .setColor('RANDOM')
    .setAuthor(`Track Stuck:`, client.user.displayAvatarURL({
      dynamic: true
    }))
    .setDescription(`${track.title}`)
   
    return channel.send(embed);
  })
  .on("queueEnd", player => {
    const channel = client.channels.cache.get(player.textChannel);
    const embed2 = new Discord.MessageEmbed()
    .setColor('RANDOM')
    .setAuthor(`Queue has ended`, client.user.displayAvatarURL({
      dynamic: true
    }))
 
    channel.send(embed2);
    player.destroy();
  });

client.once("ready", () => {
  client.manager.init(client.user.id);
  console.log(
    `[UPSTART] Started the bot || Service logged in as ${client.user.tag} `
  );
  client.user.setPresence({
    status: "online",
    activity: {
      name: "In development : Using discord.js",
      type: "WATCHING",
    },
  });
  console.log("[UPSTART] Status setup complete");
});

client.on("raw", d => client.manager.updateVoiceState(d));

client.on('message', message => {
	if (!message.content.startsWith(prefix) || message.author.bot) return;

	const args = message.content.slice(prefix.length).trim().split(/ +/);
	const commandName = args.shift().toLowerCase();

	const command = client.commands.get(commandName)
		|| client.commands.find(cmd => cmd.aliases && cmd.aliases.includes(commandName));

	if (!command) return;

	if (command.guildOnly && message.channel.type === 'dm') {
		return message.reply('I can\'t execute that command inside DMs!');
	}
	
	if (message.content === prefix) {
		const embederrorpref = {
              "title": "Oops!",
              "description": "```There is a problem here```",
              "color": 0xff0000,
              "fields": [
                {
                  "name": "You message is just the bot prefix",
                  "value": "```Please pass down a command```"
                }
              ]
            };
		return message.reply({ embed:embederrorpref });
	}

	if (command.permissions) {
		const authorPerms = message.channel.permissionsFor(message.author);
		if (!authorPerms || !authorPerms.has(command.permissions)) {
			const embederrorp = {
              "title": "Oops!",
              "description": "```You cannot execute this command!```",
              "color": 0xff0000,
              "fields": [
                {
                  "name": "You require this permission ",
                  "value": `\`\`\`fix\n${command.permissions}\n\`\`\``
                }
              ]
            };
		    return message.reply({ embed:embederrorp });
		}
	}

	if (command.args && !args.length) {
		let reply = `You didn't provide any arguments, ${message.author}!`;

		if (command.usage) {
			reply += `\nThe proper usage would be: \`${prefix}${command.name} ${command.usage}\``;
		}

		return message.channel.send(reply);
	}

	const { cooldowns } = client;

	if (!cooldowns.has(command.name)) {
		cooldowns.set(command.name, new Discord.Collection());
	}

	const now = Date.now();
	const timestamps = cooldowns.get(command.name);
	const cooldownAmount = (command.cooldown || 3) * 1000;

	if (timestamps.has(message.author.id)) {
		const expirationTime = timestamps.get(message.author.id) + cooldownAmount;

		if (now < expirationTime) {
			const timeLeft = (expirationTime - now) / 1000;
			return message.reply(`please wait ${timeLeft.toFixed(1)} more second(s) before reusing the \`${command.name}\` command.`);
		}
	}

	timestamps.set(message.author.id, now);
	setTimeout(() => timestamps.delete(message.author.id), cooldownAmount);

	try {
		command.execute(client, message, args );
	} catch (error) {
		console.error(error)
		const embederror = {
              "title": "Oops!",
              "description": "```An error occurred while executing the command```",
              "color": 0xff0000,
              "fields": [
                {
                  "name": "Exception that occured",
                  "value": `\`\`\`fix\n${error}\n\`\`\``
                }
              ]
            };
		return message.reply({ embed:embederror });
	}
});



client.on("clickButton", async (button) => {});

client.login(token);
