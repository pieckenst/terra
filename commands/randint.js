module.exports = {
    name: "randint",
    aliases: [''],
    description: "Random number from range between two entered numbers",
    async execute(client, message, args) {
            function randomIntFromInterval(min, max) { // min and max included 
              return Math.floor(Math.random() * (max - min + 1) + min)
            }
            result = randomIntFromInterval(args[0],args[1])
            const embed = {
              "title": "Mathematics",
              "description": "```Random Number```",
              "color": 9555352,
              "fields": [
                {
                  "name": "Number One",
                  "value": `\`\`\`fix\n${args[0]}\n\`\`\``
                },
				{
                  "name": "Number Two",
                  "value": `\`\`\`fix\n${args[1]}\n\`\`\``
                },
                {
                  "name": "You got",
                  "value": `\`\`\`fix\n${result}\n\`\`\``
                }
              ]
            };
            message.channel.send({ embed });
    }
  };