// Plan 1 AT#7 (verifier), AT#4 (blocker classification), AT#5 (semantic anti-stall).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

function freshStore() {
  const store = require('../../org/store.js');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'org-verify-'));
  store._setStoreDirForTesting(dir);
  return store;
}

// AT#7: write an artifact; the task cannot succeed until the file is read back and its receipt verified.
test('verifier: a file_write receipt only verifies if the file, read back, actually matches the claimed hash/size (AT#7)', () => {
  freshStore();
  const verifier = require('../../org/verifier.js');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'org-artifact-'));
  const filePath = path.join(dir, 'out.txt');
  fs.writeFileSync(filePath, 'hello world');
  const hash = verifier.sha256File(filePath);
  verifier.recordReceipt('act-1', 'file_write', { path: filePath, contentHash: hash, size: fs.statSync(filePath).size, timestamp: new Date().toISOString() });
  const v1 = verifier.verify('act-1');
  assert.equal(v1.verified, true);

  // Now the claim is WRONG (file changed after the receipt was recorded) -- verify() must catch it by
  // actually reading the file, not by trusting the receipt.
  fs.writeFileSync(filePath, 'tampered content');
  verifier.recordReceipt('act-2', 'file_write', { path: filePath, contentHash: hash, size: 11, timestamp: new Date().toISOString() });
  const v2 = verifier.verify('act-2');
  assert.equal(v2.verified, false);
  assert.match(v2.reason, /mismatch/);
});

test('verifier: a claimed file_write for a file that was never actually written fails verification', () => {
  freshStore();
  const verifier = require('../../org/verifier.js');
  verifier.recordReceipt('act-3', 'file_write', { path: '/nonexistent/path/x.txt', contentHash: 'deadbeef', size: 0, timestamp: new Date().toISOString() });
  assert.equal(verifier.verify('act-3').verified, false);
});

test('recordReceipt refuses an incomplete receipt for its action type', () => {
  freshStore();
  const verifier = require('../../org/verifier.js');
  assert.throws(() => verifier.recordReceipt('act-4', 'purchase_or_spend', { merchant: 'x' }), /missing fields/);
});

// AT#4: force a missing-account blocker; the system proposes authorized alternatives or a targeted handoff.
test('blocker-classifier: an account/identity blocker is classified and routed to the account-alternative recovery pattern (AT#4)', () => {
  const bc = require('../../org/blocker-classifier.js');
  const r = bc.classify('Cannot proceed: no account exists for this provider and KYC identity verification is required', { attemptsSoFar: 0 });
  assert.equal(r.class, 'ACCOUNT_OR_IDENTITY');
  assert.match(r.recovery, /authorized existing account|human handoff|channel that does not require/);
});

test('blocker-classifier: distinguishes other blocker classes correctly', () => {
  const bc = require('../../org/blocker-classifier.js');
  assert.equal(bc.classify('Request failed with a 500 error, connection refused').class, 'TECHNICAL_FAILURE');
  assert.equal(bc.classify('Permission denied: not authorized for this action').class, 'PERMISSION_BOUNDARY');
  assert.equal(bc.classify('Waiting for approval from the platform review queue').class, 'EXTERNAL_WAIT');
  assert.equal(bc.classify('total nonsense with no matching signal at all zzz').class, 'NO_VIABLE_PATH');
});

test('blocker-classifier: shouldExhaust fires only once the recovery-attempt cap is reached', () => {
  const bc = require('../../org/blocker-classifier.js');
  assert.equal(bc.shouldExhaust(bc.MAX_RECOVERY_ATTEMPTS - 1), false);
  assert.equal(bc.shouldExhaust(bc.MAX_RECOVERY_ATTEMPTS), true);
});

// AT#5: three semantically equivalent failed plans trigger the anti-stall intervention.
test('watchdog: three near-identical plan attempts trigger the anti-stall novelty check (AT#5)', () => {
  const wd = require('../../org/watchdog.js');
  const attempts = ['Try calling the payments API to charge the customer', 'Attempt calling payments API to charge customer'];
  const r1 = wd.checkNovelty(attempts, 'Try calling the payments API to charge the customer');
  assert.equal(r1.equivalentCount >= 2, true);
  assert.equal(r1.trigger, true, 'this would be the 3rd near-identical attempt');
});

test('watchdog: a genuinely different plan is recognized as novel, not flagged', () => {
  const wd = require('../../org/watchdog.js');
  const attempts = ['Try calling the payments API to charge the customer'];
  const r = wd.checkNovelty(attempts, 'Send a manual invoice via email instead and request wire transfer');
  assert.equal(r.novel, true);
  assert.equal(r.trigger, false);
});

test('watchdog.sweep(): recovers expired leases and reports stale projects, using store.js primitives only', () => {
  const store = freshStore();
  const wd = require('../../org/watchdog.js');
  store.createTask('t1', {});
  store.acquireLease('t1', 'dead-worker', 5);
  const r = wd.sweep({ now: Date.now() + 1000 });
  assert.deepEqual(r.recoveredLeases, ['t1']);
});
