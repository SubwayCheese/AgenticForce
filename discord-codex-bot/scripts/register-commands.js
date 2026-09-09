// Run once (and again any time command definitions change): `npm run register-commands`.
// Registers to a single guild instantly if DISCORD_GUILD_ID is set (fast, good for
// development); otherwise registers globally (can take up to ~1 hour to propagate).

const { REST, Routes, SlashCommandBuilder } = require('discord.js');
const { requireEnv } = require('../lib/secrets');

const commands = [
  new SlashCommandBuilder()
    .setName('ask')
    .setDescription('Ask the engineering/writing help agent (Codex, with live web search)')
    .addStringOption((opt) =>
      opt.setName('question').setDescription('What do you want help with?').setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('save')
    .setDescription('Save an attached file to Google Drive or OneDrive')
    .addAttachmentOption((opt) =>
      opt.setName('file').setDescription('File to save').setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName('destination').setDescription('Where to save it').setRequired(true)
        .addChoices({ name: 'Google Drive', value: 'google' }, { name: 'OneDrive', value: 'onedrive' })
    ),

  new SlashCommandBuilder()
    .setName('fetch')
    .setDescription('Fetch a file by name from Google Drive or OneDrive and post it here')
    .addStringOption((opt) =>
      opt.setName('name').setDescription('File name (or part of it) to search for').setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName('destination').setDescription('Which drive to search').setRequired(true)
        .addChoices({ name: 'Google Drive', value: 'google' }, { name: 'OneDrive', value: 'onedrive' })
    ),
  new SlashCommandBuilder()
    .setName('summarize')
    .setDescription('Summarize a meeting transcript -- provide exactly one of file/query/all')
    .addAttachmentOption((opt) =>
      opt.setName('file').setDescription('PDF or DOCX transcript to summarize').setRequired(false)
    )
    .addStringOption((opt) =>
      opt.setName('query').setDescription('Search Drive meeting notes and answer a question').setRequired(false)
    )
    .addBooleanOption((opt) =>
      opt.setName('all').setDescription('Summarize every file in the configured meeting-notes folder').setRequired(false)
    ),
].map((c) => c.toJSON());

async function main() {
  const token = requireEnv('DISCORD_BOT_TOKEN');
  const clientId = requireEnv('DISCORD_CLIENT_ID');
  const guildId = process.env.DISCORD_GUILD_ID;

  const rest = new REST({ version: '10' }).setToken(token);
  const route = guildId
    ? Routes.applicationGuildCommands(clientId, guildId)
    : Routes.applicationCommands(clientId);

  await rest.put(route, { body: commands });
  console.log(`Registered ${commands.length} command(s) ${guildId ? `to guild ${guildId}` : 'globally'}.`);
}

main().catch((err) => {
  console.error('register-commands failed:', err.message);
  process.exit(1);
});
