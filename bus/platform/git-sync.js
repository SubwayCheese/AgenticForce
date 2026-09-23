#!/usr/bin/env node
// git-sync.js -- Pi-only autonomous vault sync. Commits and pushes
// whatever the trading pilot (or anything else running on the Pi)
// changed, so the Windows/Obsidian side can `git pull` and see real
// results without the Pi needing a human to approve each commit.
//
// Deliberately SEPARATE from the interactive-session commit discipline
// used everywhere else in this vault ("only commit when explicitly
// asked") -- that rule is about an interactive Claude Code session not
// acting on the user's behalf without asking each time. This script is
// the opposite context on purpose: the whole point of the Pi is running
// unattended, so ITS commits need to happen without a per-commit ask,
// the same way trade execution does (see feedback_paper_trade_autonomy
// memory) -- this is the git-level equivalent of that same standing
// decision, not a separate one.
//
// Usage: node git-sync.js   (one run; call on a schedule -- see
// bus/deploy/pi/ for the systemd timer, a separate cadence from
// pilot-supervisor.js's own timer since this is a general vault-sync
// concern, not trading-pilot-specific)

const avPaths = require('../lib/paths.js');
const { execFileSync } = require('child_process');
const path = require('path');

const VAULT_ROOT = avPaths.ROOT;

function run(args) {
  return execFileSync('git', args, { cwd: VAULT_ROOT, encoding: 'utf8' });
}

function hasRemote() {
  try {
    const remotes = run(['remote']);
    return remotes.split('\n').filter((l) => l.trim()).length > 0;
  } catch (_) {
    return false;
  }
}

function hasChanges() {
  const status = run(['status', '--porcelain']);
  return status.trim().length > 0;
}

function main() {
  if (!hasRemote()) {
    console.log('[git-sync] No git remote configured -- nothing to push to. Skipping (see bus/deploy/pi/README.md).');
    return;
  }
  if (!hasChanges()) {
    console.log('[git-sync] No changes to sync.');
    return;
  }

  const ts = new Date().toISOString();
  console.log(`[git-sync] Changes detected, committing (${ts})...`);
  run(['add', '-A']);
  // Excludes bus/secrets.local.json the same way every interactive commit
  // this session did -- it's gitignored, `git add -A` never stages it.
  run(['commit', '-m', `Autonomous vault sync (Pi) -- ${ts}\n\nCo-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`]);

  try {
    run(['pull', '--rebase', '--autostash']);
  } catch (err) {
    console.log(`[git-sync] pull --rebase failed (real conflict, or offline) -- NOT pushing until resolved: ${err.message.split('\n')[0]}`);
    return;
  }

  try {
    run(['push']);
    console.log('[git-sync] Pushed.');
  } catch (err) {
    console.log(`[git-sync] push failed -- will retry next sync: ${err.message.split('\n')[0]}`);
  }
}

if (require.main === module) {
  main();
}

module.exports = { main, hasRemote, hasChanges };
