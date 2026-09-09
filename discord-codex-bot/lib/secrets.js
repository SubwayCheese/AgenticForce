// Central place that loads .env and the local (gitignored) token cache files.
// Nothing in this file ever logs a secret value -- callers should follow the same discipline.

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const TOKENS_DIR = path.join(__dirname, '..', 'tokens');
if (!fs.existsSync(TOKENS_DIR)) fs.mkdirSync(TOKENS_DIR, { recursive: true });

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var ${name} -- check discord-codex-bot/.env`);
  return v;
}

function readJsonFile(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return fallback;
    throw err;
  }
}

function writeJsonFile(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

module.exports = {
  TOKENS_DIR,
  requireEnv,
  readJsonFile,
  writeJsonFile,
  googleTokenPath: path.join(TOKENS_DIR, 'google-token.json'),
  msalCachePath: path.join(TOKENS_DIR, 'msal-cache.json'),
};
