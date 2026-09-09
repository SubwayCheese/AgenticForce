// Shared Discord text-length helpers. splitForDiscord moved here verbatim from commands/ask.js
// so /summarize can reuse the same last-newline-before-limit splitting logic.

const DISCORD_MSG_LIMIT = 2000;

function splitForDiscord(text) {
  if (text.length <= DISCORD_MSG_LIMIT) return [text];
  const chunks = [];
  let rest = text;
  while (rest.length > DISCORD_MSG_LIMIT) {
    let cut = rest.lastIndexOf('\n', DISCORD_MSG_LIMIT);
    if (cut < DISCORD_MSG_LIMIT * 0.5) cut = DISCORD_MSG_LIMIT;
    chunks.push(rest.slice(0, cut));
    rest = rest.slice(cut).replace(/^\n/, '');
  }
  if (rest) chunks.push(rest);
  return chunks;
}

// For /summarize's short in-Discord preview -- unlike splitForDiscord (which returns every
// chunk so nothing is lost), this deliberately drops the remainder and says so, since the full
// text is always also delivered as a file attachment.
function truncatePreview(text, maxLen) {
  if (text.length <= maxLen) return text;
  let cut = text.lastIndexOf('\n', maxLen);
  if (cut < maxLen * 0.5) cut = maxLen;
  return `${text.slice(0, cut)}\n\n*(preview truncated — see attached file for the full summary)*`;
}

module.exports = { DISCORD_MSG_LIMIT, splitForDiscord, truncatePreview };
