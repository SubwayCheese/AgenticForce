// research-swarm-worker.js -- Round 17. The real concurrency primitive.
// Deliberately NEVER calls agent-engine.js's dispatch()/dispatchWrite()
// -- both use execFileSync, which blocks the JS event loop and would
// silently re-serialize every "concurrent" worker (a real bug caught
// during planning, before this file was written). Only reuses
// loadAgentConfig() (confirmed pure/synchronous -- reads one JSON file,
// no child process) and does its own child_process.spawn dispatch.

const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { loadAgentConfig } = require('./agent-engine.js');

const VAULT_ROOT = path.resolve(__dirname, '..', '..');
const DISPATCH_TIMEOUT_MS = 10 * 60 * 1000; // 10min -- generous for a real research prompt, bounded so one hang can't eat a whole cycle's worker slot

function dispatchCodexAsync(prompt, { timeoutMs = DISPATCH_TIMEOUT_MS } = {}) {
  return new Promise((resolve) => {
    const cfg = loadAgentConfig('codex');
    const outputFile = path.join(os.tmpdir(), `research-swarm-${crypto.randomBytes(4).toString('hex')}.txt`);
    const args = cfg.modes.readOnly.args.map((a) => a.split('{outputFile}').join(outputFile));
    // Round 17 fix (cross-review, CRITICAL, reproduced live on this real
    // Pi via `systemctl show-environment`): a systemd unit does not
    // inherit the interactive shell PATH that ~/.local/bin/codex relies
    // on today -- the existing daemon only works because it happens to
    // have been launched from an interactive shell, not systemd. Resolve
    // an explicit PATH so spawn() can find the real binary either way.
    const env = { ...process.env, PATH: `${os.homedir()}/.local/bin:${process.env.PATH || ''}` };

    let settled = false;
    let timer;
    const finish = (result) => { if (settled) return; settled = true; clearTimeout(timer); resolve(result); };

    let child;
    try {
      child = spawn(cfg.binary, args, { cwd: VAULT_ROOT, stdio: ['pipe', 'pipe', 'pipe'], env });
    } catch (err) {
      finish({ exitCode: 1, output: '', stderr: `spawn threw synchronously: ${err.message}` });
      return;
    }

    // Round 17 fix (cross-review, CRITICAL, reproduced live): spawn()
    // failures (bad binary, ENOENT) arrive asynchronously via the
    // 'error' event, not a synchronous throw -- with no listener, Node
    // raises an uncaught exception and kills the whole cycle script on
    // the very first bad dispatch. The try/catch above alone does not
    // cover this.
    child.on('error', (err) => finish({ exitCode: 1, output: '', stderr: `spawn error: ${err.message}` }));

    child.stdin.write(prompt);
    child.stdin.end();
    let stderr = '';
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('close', (code) => {
      const output = fs.existsSync(outputFile) ? fs.readFileSync(outputFile, 'utf8').trim() : '';
      try { fs.unlinkSync(outputFile); } catch (_) { /* best-effort */ }
      finish({ exitCode: code, output, stderr });
    });

    // Round 17 fix (cross-review, MEDIUM): bounds a hung child so it
    // occupies at most one worker slot for at most timeoutMs, not the
    // whole cycle.
    timer = setTimeout(() => {
      try { child.kill('SIGKILL'); } catch (_) { /* already gone */ }
      finish({ exitCode: 1, output: '', stderr: 'dispatch timed out' });
    }, timeoutMs);
  });
}

// Bounded-concurrency pool: `concurrency` async worker loops pull from a
// shared index; each `await handler(...)` yields the event loop while
// its real child process runs, so up to `concurrency` real OS processes
// are genuinely alive at once. Empirically verified during cross-review
// against 6 real 2s child processes at concurrency 3: 4.07s elapsed,
// matching true parallelism, not the ~12s a serialized version would take.
async function runPool(items, concurrency, handler) {
  let idx = 0;
  const results = [];
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await handler(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

module.exports = { dispatchCodexAsync, runPool, DISPATCH_TIMEOUT_MS };
