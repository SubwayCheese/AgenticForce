// Run once: `npm run authorize-google`. Opens a browser to Google's consent screen, catches the
// redirect on a temporary local server, exchanges the code for a refresh token, and saves it to
// tokens/google-token.json. Never run this unattended -- it needs you to actually log in.

const http = require('http');
const { URL } = require('url');
const { google } = require('googleapis');
const { requireEnv, writeJsonFile, googleTokenPath } = require('../lib/secrets');

const REDIRECT_URI = 'http://localhost:53682/oauth2callback';
// Widened from drive.file to drive.readonly so /summarize's Drive-wide modes (all/query) can
// see meeting notes the user already has in Drive, not just files this bot created itself.
// Real permission change -- requires re-running `npm run authorize-google` for real consent.
const SCOPES = ['https://www.googleapis.com/auth/drive.readonly'];

async function main() {
  const client = new google.auth.OAuth2(
    requireEnv('GOOGLE_CLIENT_ID'),
    requireEnv('GOOGLE_CLIENT_SECRET'),
    REDIRECT_URI
  );

  const authUrl = client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent', // forces a refresh_token to be issued even on repeat authorizations
    scope: SCOPES,
  });

  console.log('\nOpen this URL in a browser and sign in / grant access:\n');
  console.log(authUrl);
  console.log('\nWaiting for the redirect back to localhost...\n');

  const code = await new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, REDIRECT_URI);
      if (url.pathname !== '/oauth2callback') { res.end('ok'); return; }
      const authCode = url.searchParams.get('code');
      res.end(authCode ? 'Authorized -- you can close this tab and return to the terminal.' : 'Missing code.');
      server.close();
      authCode ? resolve(authCode) : reject(new Error('No code in redirect'));
    });
    server.listen(53682);
  });

  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error('Google did not return a refresh_token. Revoke prior access at https://myaccount.google.com/permissions and re-run this script.');
  }
  writeJsonFile(googleTokenPath, tokens);
  console.log(`Saved refresh token to ${googleTokenPath}`);
}

main().catch((err) => {
  console.error('authorize-google failed:', err.message);
  process.exit(1);
});
