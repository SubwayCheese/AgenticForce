// ntfy.js -- shared notification helper for the /bus/ protocol.
//
// Publish mechanism: plain HTTPS POST to the public ntfy.sh service
// (https://ntfy.sh/<topic>), no auth -- this is what "topic already
// created on my end" means in practice for ntfy: there is no server-side
// creation step for a public topic, just subscribing to the topic name in
// the ntfy app. IMPORTANT PRIVACY NOTE: ntfy.sh topics are public by
// default -- anyone who knows or guesses the topic name "ClaudeTeam" can
// subscribe and read these messages, unless access controls are set up on
// an ntfy.sh account or a self-hosted server. Flagging this; not
// something this script can fix on its own.
//
// Found and fixed a real, silent bug before this became load-bearing:
// ntfy content-sniffs the POST body, and ANY message containing certain
// non-ASCII characters (confirmed: em dash U+2014) gets reinterpreted as
// a file upload instead of delivered as message text -- the phone
// notification shows "You received a file: attachment.txt" with the real
// text hidden behind a download link, and the HTTP response is still 200,
// so nothing about the request itself signals failure. sanitizeForNtfy()
// strips this class of problem before every send.

const https = require('https');

function sanitizeForNtfy(text) {
  return String(text == null ? '' : text)
    .replace(/[–—]/g, '-') // en dash, em dash -> hyphen
    .replace(/[‘’]/g, "'") // smart single quotes
    .replace(/[“”]/g, '"') // smart double quotes
    .replace(/[^\x00-\x7F]/g, '?'); // any other non-ASCII -> safe fallback
}

function sendNtfy({ topic = 'ClaudeTeam', message, title, priority, tags } = {}) {
  return new Promise((resolve, reject) => {
    if (!message) {
      reject(new Error('sendNtfy requires a message'));
      return;
    }
    const body = sanitizeForNtfy(message);
    const headers = { 'Content-Type': 'text/plain; charset=utf-8' };
    if (title) headers['Title'] = sanitizeForNtfy(title);
    if (priority) headers['Priority'] = String(priority);
    if (tags) headers['Tags'] = tags;

    const req = https.request(
      { hostname: 'ntfy.sh', path: '/' + encodeURIComponent(topic), method: 'POST', headers },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

module.exports = { sendNtfy, sanitizeForNtfy };
