// File agent, OneDrive side, via Microsoft Graph REST API. Auth uses MSAL Node with a
// file-backed token cache (populated once by `npm run authorize-onedrive`); this module just
// silently refreshes from that cache and calls Graph directly with plain fetch.

const msal = require('@azure/msal-node');
const fetch = require('node-fetch');
const { requireEnv, readJsonFile, writeJsonFile, msalCachePath } = require('./secrets');

const GRAPH_ROOT = 'https://graph.microsoft.com/v1.0';
const SCOPES = ['Files.ReadWrite', 'offline_access', 'User.Read'];

function fileCachePlugin() {
  return {
    beforeCacheAccess: async (ctx) => {
      const data = readJsonFile(msalCachePath);
      if (data) ctx.tokenCache.deserialize(JSON.stringify(data));
    },
    afterCacheAccess: async (ctx) => {
      if (ctx.cacheHasChanged) {
        writeJsonFile(msalCachePath, JSON.parse(ctx.tokenCache.serialize()));
      }
    },
  };
}

function getMsalApp() {
  return new msal.PublicClientApplication({
    auth: {
      clientId: requireEnv('MS_CLIENT_ID'),
      authority: `https://login.microsoftonline.com/${process.env.MS_TENANT || 'consumers'}`,
    },
    cache: { cachePlugin: fileCachePlugin() },
  });
}

async function getAccessToken() {
  const app = getMsalApp();
  const cache = app.getTokenCache();
  const accounts = await cache.getAllAccounts();
  if (accounts.length === 0) {
    throw new Error('No OneDrive account found -- run `npm run authorize-onedrive` once first.');
  }
  const result = await app.acquireTokenSilent({ account: accounts[0], scopes: SCOPES });
  return result.accessToken;
}

async function graphRequest(pathAndQuery, options = {}) {
  const token = await getAccessToken();
  const res = await fetch(`${GRAPH_ROOT}${pathAndQuery}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...(options.headers || {}) },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Graph API ${res.status} on ${pathAndQuery}: ${body.slice(0, 500)}`);
  }
  return res;
}

async function uploadBuffer(buffer, filename, mimeType) {
  // Simple upload (fine up to 4MB, which covers typical Discord attachments); larger files
  // would need Graph's resumable upload-session API, deliberately not built yet.
  const res = await graphRequest(
    `/me/drive/root:/${encodeURIComponent(filename)}:/content`,
    { method: 'PUT', headers: { 'Content-Type': mimeType || 'application/octet-stream' }, body: buffer }
  );
  return res.json(); // includes id, name, webUrl
}

async function findByName(name) {
  const res = await graphRequest(`/me/drive/root/search(q='${encodeURIComponent(name)}')?$top=5`);
  const data = await res.json();
  return data.value || [];
}

async function downloadById(itemId) {
  const res = await graphRequest(`/me/drive/items/${itemId}/content`);
  return Buffer.from(await res.arrayBuffer());
}

module.exports = { getMsalApp, SCOPES, uploadBuffer, findByName, downloadById };
