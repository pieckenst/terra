module.exports = {
    name: "sqrt",
    aliases: [''],
    description: "Calculates a square root",
    async execute(client, message, args) {
        if (args > 5000 || args < 0) {
            const embederrormath = {
              "title": "Oops!",
               "description": "```An error occurred while executing the command```",
               "color": 9555352,
               "fields": [
                 {
                   "name": "Invalid Value",
                   "value": "```Value must be between 1 and 5000```"
                 }
               ]
            };
            message.channel.send({ embed:embederrormath });
            return
	    }
        else{
            result = Math.sqrt(args)
            const embed = {
              "title": "Mathematics",
              "description": "```Square Root```",
              "color": 9555352,
              "fields": [
                {
                  "name": "You entered",
                  "value": `\`\`\`fix\n${args}\n\`\`\``
                },
                {
                  "name": "You got",
                  "value": `\`\`\`fix\n${result}\n\`\`\``
                }
              ]
            };
            message.channel.send({ embed });
	    }
    }
  };