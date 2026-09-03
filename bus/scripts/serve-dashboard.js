#!/usr/bin/env node
// serve-dashboard.js -- Phase 3, piece 5 (added 2026-09-03). The one
// missing piece that makes bus/dashboard.html actually viewable: it
// fetch()es a relative status.json, which fails outright under a
// file:// origin (Chrome blocks cross-origin file:// fetches by
// design) -- confirmed, not assumed, by actually trying it before
// writing this. There was no HTTP server anywhere in these scripts
// until now, so this file had likely never been seen working.
//
// Deliberately minimal: Node's built-in http module only, no new
// dependency for three static-ish routes. Manual, on-demand lifecycle
// (run it when you want to look, Ctrl+C when done) -- not wired into
// run-queue-daemon.js or any other standing process; this is a
// look-when-you-want-to tool, not infrastructure something else
// depends on.
//
// Usage: node serve-dashboard.js  (or double-click start-dashboard.bat
// on this machine, which also opens the browser)
// Port overridable via PORT env var; defaults to 8877 (arbitrary,
// chosen to avoid the common dev-server defaults like 3000/5173/8080).

const http = require('http');
const fs = require('fs');
const path = require('path');
const { buildSnapshot, buildAgentGraph } = require('./dashboard-status.js');

const VAULT_ROOT = path.resolve(__dirname, '..', '..');
const DASHBOARD_HTML_PATH = path.join(VAULT_ROOT, 'bus', 'dashboard.html');
const AGENTS_HTML_PATH = path.join(VAULT_ROOT, 'bus', 'agents.html');
const MARKETS_HTML_PATH = path.join(VAULT_ROOT, 'bus', 'markets.html');
const BACKLOG_STATUS_PATH = path.join(VAULT_ROOT, 'bus', 'status.json');
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 8877;

function send(res, status, contentType, body) {
  res.writeHead(status, {
    'Content-Type': contentType,
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];

  if (url === '/' || url === '/dashboard.html') {
    fs.readFile(DASHBOARD_HTML_PATH, 'utf8', (err, html) => {
      if (err) return send(res, 500, 'text/plain', `Failed to read dashboard.html: ${err.message}`);
      send(res, 200, 'text/html; charset=utf-8', html);
    });
    return;
  }

  if (url === '/status.json') {
    try {
      const snapshot = buildSnapshot();
      send(res, 200, 'application/json', JSON.stringify(snapshot));
    } catch (err) {
      // Surfaced to the dashboard's own feed via its fetch-catch, not
      // hidden -- matches dashboard.html's existing poll-failure
      // handling, which already expects a fetch to be able to fail.
      send(res, 500, 'application/json', JSON.stringify({ error: String((err && err.message) || err) }));
    }
    return;
  }

  // Agent hierarchy graph (added 2026-09-03, a direct follow-on to the
  // dashboard) -- same fresh-per-request pattern as /status.json.
  if (url === '/agents.html') {
    fs.readFile(AGENTS_HTML_PATH, 'utf8', (err, html) => {
      if (err) return send(res, 500, 'text/plain', `Failed to read agents.html: ${err.message}`);
      send(res, 200, 'text/html; charset=utf-8', html);
    });
    return;
  }

  if (url === '/agent-graph.json') {
    try {
      const graph = buildAgentGraph();
      send(res, 200, 'application/json', JSON.stringify(graph));
    } catch (err) {
      send(res, 500, 'application/json', JSON.stringify({ error: String((err && err.message) || err) }));
    }
    return;
  }

  // Markets page (added 2026-09-03) -- embeds real TradingView charts
  // for the Core Watchlist. Purely static; unlike /agents.html this has
  // no companion JSON endpoint, since the watchlist ticker list lives
  // as a small JS array inside the page itself, not computed server-side.
  if (url === '/markets.html') {
    fs.readFile(MARKETS_HTML_PATH, 'utf8', (err, html) => {
      if (err) return send(res, 500, 'text/plain', `Failed to read markets.html: ${err.message}`);
      send(res, 200, 'text/html; charset=utf-8', html);
    });
    return;
  }

  // The pre-existing run-backlog.js live-progress file (2026-08-31) --
  // passed through raw here rather than through buildSnapshot(), since
  // dashboard-status.js already reads and freshness-checks it
  // (getBacklogRunStatus()) and embeds the result in /status.json's
  // own backlogRun field. This second endpoint exists only so the
  // front end can distinguish "no backlog run" from "fetch itself
  // failed" independently of the main snapshot, matching the two
  // separately-rendered panels.
  if (url === '/backlog-status.json') {
    fs.readFile(BACKLOG_STATUS_PATH, 'utf8', (err, text) => {
      if (err) return send(res, 200, 'application/json', '{}');
      send(res, 200, 'application/json', text);
    });
    return;
  }

  send(res, 404, 'text/plain', 'Not found');
});

server.listen(PORT, () => {
  console.log(`/bus/ dashboard serving at http://localhost:${PORT}/`);
  console.log('Ctrl+C to stop. This is manual/on-demand -- not a standing process.');
});
