// Run once: `npm run authorize-onedrive`. Uses the OAuth device-code flow (no local redirect
// server needed) -- prints a short code, you enter it at microsoft.com/devicelogin, and the
// resulting account + refreshable token gets cached to tokens/msal-cache.json.

const { getMsalApp, SCOPES } = require('../lib/onedrive');

async function main() {
  const app = getMsalApp();
  const result = await app.acquireTokenByDeviceCode({
    scopes: SCOPES,
    deviceCodeCallback: (response) => {
      console.log('\n' + response.message + '\n');
    },
  });
  console.log(`Authorized as ${result.account.username}. Token cache saved.`);
}

main().catch((err) => {
  console.error('authorize-onedrive failed:', err.message);
  process.exit(1);
});
