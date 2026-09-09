const fetch = require('node-fetch');
const googleDrive = require('../lib/google-drive');
const onedrive = require('../lib/onedrive');

module.exports = {
  name: 'save',
  async execute(interaction) {
    const attachment = interaction.options.getAttachment('file', true);
    const destination = interaction.options.getString('destination', true);
    await interaction.deferReply();

    let buffer;
    try {
      const res = await fetch(attachment.url);
      if (!res.ok) throw new Error(`Discord returned ${res.status} fetching the attachment`);
      buffer = Buffer.from(await res.arrayBuffer());
    } catch (err) {
      await interaction.editReply(`Couldn't download the attachment from Discord: ${err.message}`);
      return;
    }

    try {
      if (destination === 'google') {
        const file = await googleDrive.uploadBuffer(buffer, attachment.name, attachment.contentType);
        await interaction.editReply(`Saved to Google Drive: **${file.name}**\n${file.webViewLink || ''}`);
      } else {
        const file = await onedrive.uploadBuffer(buffer, attachment.name, attachment.contentType);
        await interaction.editReply(`Saved to OneDrive: **${file.name}**\n${file.webUrl || ''}`);
      }
    } catch (err) {
      await interaction.editReply(`Upload to ${destination === 'google' ? 'Google Drive' : 'OneDrive'} failed: ${err.message}`);
    }
  },
};
