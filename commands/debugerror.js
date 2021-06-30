module.exports = {
    name: "throwerror",
    aliases: [''],
    description: "Debugging command for throwing errors",
    async execute(client, message) {
            throw new Error('Testing the error checking - debug only');
    }
  };