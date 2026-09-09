const { askCodex } = require('../lib/codex-dispatch');
const { buildPinnedContext } = require('../lib/pinned-context');
const { splitForDiscord } = require('../lib/discord-format');

module.exports = {
  name: 'ask',
  async execute(interaction) {
    const question = interaction.options.getString('question', true);
    await interaction.deferReply();

    const { context, note } = await buildPinnedContext(interaction.channel);

    let answer;
    try {
      answer = await askCodex(question, context);
    } catch (err) {
      await interaction.editReply(`Codex dispatch failed: ${err.message}`);
      return;
    }

    const finalText = note ? `${answer}\n\n${note}` : answer;
    const chunks = splitForDiscord(finalText);
    await interaction.editReply(chunks[0]);
    for (let i = 1; i < chunks.length; i++) {
      await interaction.followUp(chunks[i]);
    }
  },
};
