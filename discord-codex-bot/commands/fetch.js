const { AttachmentBuilder } = require('discord.js');
const googleDrive = require('../lib/google-drive');
const onedrive = require('../lib/onedrive');

// Conservative default; a non-boosted Discord server's real cap is 8MB but this leaves headroom.
const MAX_DISCORD_UPLOAD_BYTES = 7.5 * 1024 * 1024;

module.exports = {
  name: 'fetch',
  async execute(interaction) {
    const name = interaction.options.getString('name', true);
    const destination = interaction.options.getString('destination', true);
    await interaction.deferReply();

    const client = destination === 'google' ? googleDrive : onedrive;
    const driveLabel = destination === 'google' ? 'Google Drive' : 'OneDrive';

    let matches;
    try {
      matches = await client.findByName(name);
    } catch (err) {
      await interaction.editReply(`Search in ${driveLabel} failed: ${err.message}`);
      return;
    }

    if (!matches.length) {
      await interaction.editReply(`No file matching "${name}" found in ${driveLabel}.`);
      return;
    }

    const best = matches[0];
    const fileId = best.id;
    const fileName = best.name;
    const webLink = best.webViewLink || best.webUrl;

    let buffer;
    try {
      buffer = await client.downloadById(fileId);
    } catch (err) {
      await interaction.editReply(`Found "${fileName}" in ${driveLabel} but couldn't download it: ${err.message}`);
      return;
    }

    if (buffer.length > MAX_DISCORD_UPLOAD_BYTES) {
      await interaction.editReply(
        `Found **${fileName}** in ${driveLabel}, but it's too large to post here (${(buffer.length / 1024 / 1024).toFixed(1)}MB). Link: ${webLink || '(none)'}`
      );
      return;
    }

    const file = new AttachmentBuilder(buffer, { name: fileName });
    await interaction.editReply({ content: `From ${driveLabel}: **${fileName}**`, files: [file] });
  },
};
