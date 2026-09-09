// File agent, Google Drive side. Plain API calls (no LLM in the loop) -- this is a normal,
// unsandboxed Node process, so real network access is just... network access, no workaround needed.

const { google } = require('googleapis');
const { Readable } = require('stream');
const { requireEnv, readJsonFile, writeJsonFile, googleTokenPath } = require('./secrets');

function getOAuth2Client() {
  const client = new google.auth.OAuth2(
    requireEnv('GOOGLE_CLIENT_ID'),
    requireEnv('GOOGLE_CLIENT_SECRET'),
    'http://localhost:53682/oauth2callback'
  );
  const saved = readJsonFile(googleTokenPath);
  if (!saved || !saved.refresh_token) {
    throw new Error('No Google refresh token found -- run `npm run authorize-google` once first.');
  }
  client.setCredentials({ refresh_token: saved.refresh_token });
  client.on('tokens', (tokens) => {
    // googleapis calls this whenever it silently refreshes the access token; persist any new
    // refresh_token if Google ever rotates it (rare, but cheap to handle correctly).
    if (tokens.refresh_token) {
      writeJsonFile(googleTokenPath, { ...saved, ...tokens });
    }
  });
  return client;
}

function driveClient() {
  return google.drive({ version: 'v3', auth: getOAuth2Client() });
}

async function uploadBuffer(buffer, filename, mimeType) {
  const drive = driveClient();
  const res = await drive.files.create({
    requestBody: { name: filename },
    media: { mimeType: mimeType || 'application/octet-stream', body: Readable.from(buffer) },
    fields: 'id, name, webViewLink',
  });
  return res.data; // { id, name, webViewLink }
}

async function findByName(name) {
  const drive = driveClient();
  const escaped = name.replace(/'/g, "\\'");
  const res = await drive.files.list({
    q: `name contains '${escaped}' and trashed = false`,
    fields: 'files(id, name, mimeType, webViewLink, modifiedTime)',
    orderBy: 'modifiedTime desc',
    pageSize: 5,
  });
  return res.data.files || [];
}

// Text-bearing types worth full-text searching/summarizing -- excludes images, spreadsheets,
// presentations, etc. so /summarize's Drive modes don't sweep in unrelated file kinds.
const TEXT_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.google-apps.document', // Google Docs
];

// query: optional fullText search string. folderId: optional, scopes to that folder's direct
// children. No query = pure folder listing (used by /summarize's `all` mode). Requests `parents`
// (not requested anywhere else in this file today) so results can be attributed to a folder.
async function searchFiles({ query, folderId, pageSize = 10 } = {}) {
  const drive = driveClient();
  const clauses = ['trashed = false'];
  if (query) clauses.push(`fullText contains '${query.replace(/'/g, "\\'")}'`);
  if (folderId) clauses.push(`'${folderId}' in parents`);
  clauses.push(`(${TEXT_MIME_TYPES.map((t) => `mimeType = '${t}'`).join(' or ')})`);
  const res = await drive.files.list({
    q: clauses.join(' and '),
    fields: 'files(id, name, mimeType, webViewLink, modifiedTime, parents)',
    orderBy: 'modifiedTime desc',
    pageSize,
  });
  return res.data.files || [];
}

async function downloadById(fileId) {
  const drive = driveClient();
  const res = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'arraybuffer' });
  return Buffer.from(res.data);
}

module.exports = { getOAuth2Client, uploadBuffer, findByName, searchFiles, downloadById };
