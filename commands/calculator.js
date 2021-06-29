const discord = require("discord.js");
const disbut = require("discord-buttons");
const math = require("mathjs");

module.exports = {
  name: "calculator",
  description: "Bring up a calculator using Buttons!",
  async execute(client, message, args) {
    const button = new Array([], [], [], [], []);
    const row = [];
    const text = [
      "Exit",
      "(",
      ")",
      "/",
      "7",
      "8",
      "9",
      "*",
      "4",
      "5",
      "6",
      "-",
      "1",
      "2",
      "3",
      "+",
      ".",
      "0",
      "00",
      "=",
    ];
    let current = 0;

    for (let i = 0; i < text.length; i++) {
      if (button[current].length === 4) current++;
      button[current].push(createButton(text[i]));
      if (i === text.length - 1) {
        for (const btn of button) row.push(addRow(btn));
      }
    }

    const embed = new discord.MessageEmbed()
      .setColor("BLUE")
      .setDescription("0");

    message.channel
      .send({
        components: row,
        embed: embed,
      })
      .then((msg) => {
        let isWrong = false;
        const time = 600000;
        let value = "";
        const embed1 = new discord.MessageEmbed().setColor("BLUE");

        function createCollector(val, result = false) {
          const filter = (buttons1) =>
            buttons1.clicker.user.id === message.author.id &&
            buttons1.id === "cal" + val;
          const collect = msg.createButtonCollector(filter, { time: time });

          collect.on("collect", async (x) => {
            x.defer();

            if (result === true) {
              value = mathEval(value);
              result = value;
            } else if (isWrong) {
              value = val;
              isWrong = false;
            } else if (result === "new") {
              const exitembed = {
                title: "Exiting calculator",
                description: "```Exiting calculator on request ```",
                color: 14187389,
                footer: {
                  text: "Terra",
                },
              };
              msg.edit({
                component: null,
                embed: exitembed,
              });
              return;
            } else if (result === "0") value = val;
            else if (result) {
              isWrong = true;
              value = mathEval(value);
            } else value += val;

            embed1.setDescription("```" + value + "```");
            msg.edit({
              components: row,
              embed: embed1,
            });
          });
        }

        for (const txt of text) {
          let result;
          if (txt === "Exit") result = "new";
          else if (txt === "=") result = true;
          else result = false;
          createCollector(txt, result);
        }

        setTimeout(() => {
          embed1
            .setDescription("Your time to use the calculator is running out...")
            .setColor("RED");
          msg.edit({
            embed: embed1,
          });
        }, time);
      });

    function addRow(btns) {
      const row1 = new disbut.MessageActionRow();

      for (const btn of btns) {
        row1.addComponent(btn);
      }
      return row1;
    }

    function createButton(label, style = "grey") {
      if (label === "Exit") style = "red";
      else if (label === ".") style = "grey";
      else if (label === "=") style = "green";
      else if (isNaN(label)) style = "blurple";

      const btn = new disbut.MessageButton()

        .setLabel(label)
        .setStyle(style)
        .setID("cal" + label);

      return btn;
    }

    function mathEval(input) {
      try {
        const res = math.evaluate(input);
        return res;
      } catch {
        return "An error occured while evaluating your calculation!";
      }
    }
  },
};
