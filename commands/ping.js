module.exports = {
    name: 'ping',
    description: 'Preforms a ping test on discord',
    execute(client ,message, args){
        const msg = await message.channel.send('Pinging...')
        const ping = "```js\nLatency Ping is : " + Math.floor(msg.createdTimestamp - message.createdTimestamp) + " ms" + "\nAPI Ping : " + Math.round(client.ws.ping) + " ms" + "```"
        msg.edit(ping)
    }
}
