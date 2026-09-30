// c1-execution-lock.js -- OS-backed mutual-exclusion lock for every step that can move real money for C1 (the "survive"
// live-Alpaca citizen). Backed by a Linux abstract-namespace UNIX domain socket (a leading NUL byte in the path):
// binding it is how the lock is "held", and the kernel itself frees the name the INSTANT the holding process exits,
// for ANY reason -- normal exit, an uncaught throw, or SIGKILL. There is no lock file, no PID to record, no
// staleness to judge and no reclaim path to get wrong (see the 2026-09-29 review finding on the old file lock: a
// stale-lock reclaim was a real TOCTOU race -- two instances could both decide the same dead PID meant "free" and
// both proceed). EADDRINUSE on listen() means another process currently holds the name.
//
// Used by survive-stop-guard.js (holds it for its whole run) and survive-supervisor.js (holds it around the
// per-citizen reconcile/execute/author section) so the two can never run their money-moving steps concurrently.
'use strict';

const net = require('net');

const DEFAULT_NAME = 'agentvault-c1-execution';
const POLL_MS = 250;

// One bind attempt. Resolves to { release() } on success, or null if the name is in use (or any other bind error --
// fail closed: "could not prove we hold it" must never be treated as holding it).
function tryOnce(addr) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.on('error', () => resolve(null)); // EADDRINUSE, or any other bind failure -- both mean "did not acquire"
    server.listen(addr, () => {
      server.unref(); // holding the name must never, by itself, keep a oneshot process alive
      let released = false;
      resolve({
        release() {
          if (released) return;
          released = true;
          try { server.close(); } catch (_) { /* best-effort -- process exit frees it either way */ }
        },
      });
    });
  });
}

// acquire({ wait_ms = 0, name = DEFAULT_NAME }) -> Promise<{ release() } | null>
// wait_ms = 0 (the default): a single attempt, no retries -- callers on the "busy -> log and skip" path want this.
// wait_ms > 0: retries on a short poll until an attempt succeeds or the deadline passes, then gives up (returns null).
async function acquire({ wait_ms = 0, name = DEFAULT_NAME } = {}) {
  const addr = `\0${name}`;
  const { performance } = require('perf_hooks'); // monotonic: a wall-clock jump can't stretch or cut the wait
  const deadline = performance.now() + Math.max(0, wait_ms);
  for (;;) {
    const held = await tryOnce(addr);
    if (held) return held;
    if (performance.now() >= deadline) return null;
    await new Promise((r) => setTimeout(r, Math.min(POLL_MS, Math.max(0, deadline - performance.now()))));
  }
}

module.exports = { acquire, DEFAULT_NAME };
