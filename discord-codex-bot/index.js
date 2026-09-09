const { Client, GatewayIntentBits, Events } = require('discord.js');
const { requireEnv } = require('./lib/secrets');

const commands = new Map(
  [require('./commands/ask'), require('./commands/save'), require('./commands/fetch'), require('./commands/summarize')].map((c) => [c.name, c])
);

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, (c) => {
  console.log(`Logged in as ${c.user.tag}. Commands loaded: ${[...commands.keys()].join(', ')}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const command = commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (err) {
    console.error(`Error running /${interaction.commandName}:`, err);
    const payload = { content: `Something went wrong running /${interaction.commandName}: ${err.message}` };
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(payload).catch(() => {});
    } else {
      await interaction.reply({ ...payload, ephemeral: true }).catch(() => {});
    }
  }
});

client.login(requireEnv('DISCORD_BOT_TOKEN'));
