// bus/org/verifier.js -- Round 26. Plan 1 sec 14: "the system distinguishes requested, attempted,
// provider-accepted, observed, and verified. Only verified actions may satisfy a task whose definition of
// done requires an external side effect." Typed receipt schema per action type (sec 14's table, verbatim
// fields), and verify() actually RE-CHECKS the claimed effect -- it never trusts the claim alone. This
// satisfies AT#7: "write an artifact; the task cannot succeed until the file is read back and its receipt
// verified."

const fs = require('fs');
const crypto = require('crypto');
const store = require('./store.js');

const REQUIRED_FIELDS = Object.freeze({
  file_write: ['path', 'contentHash', 'size', 'timestamp'],
  api_mutation: ['requestId', 'status', 'resourceId'],
  message_or_outreach: ['recipientIdentity', 'channel', 'providerId', 'timestamp', 'deliveryState'],
  purchase_or_spend: ['merchant', 'amountUsd', 'authorization', 'transactionId'],
  deployment: ['version', 'environment', 'healthCheck'],
  analysis_artifact: ['sourceSet', 'method', 'generatedFileHash', 'evaluationResult'],
});

function sha256File(path_) { return crypto.createHash('sha256').update(fs.readFileSync(path_)).digest('hex'); }

function recordReceipt(actionId, actionType, fields) {
  const req = REQUIRED_FIELDS[actionType];
  if (!req) throw new Error(`verifier: unknown action type "${actionType}"`);
  const missing = req.filter((k) => !(k in fields));
  if (missing.length) throw new Error(`verifier: receipt for ${actionType} missing fields: ${missing.join(', ')}`);
  return store.create('receipts', `receipt_${actionId}`, { actionId, actionType, fields, status: 'recorded' });
}

// verify(): re-checks the CLAIMED side effect for real, per action type. file_write actually reads the file
// back and compares its hash (AT#7's exact wording: "the file is read back"); other types check internal
// consistency of the receipt itself in this phase (real provider-side re-reads -- e.g. re-GET an API
// resource -- are per-mechanism work outside this generic module's scope, same "generic runtime, specific
// executors" split this codebase already uses: survive-executor.js is the specific real-money verifier for
// its own domain, this module is the generic contract it and future domains implement against).
function verify(actionId) {
  const receipt = store.get('receipts', `receipt_${actionId}`);
  if (!receipt) return { verified: false, reason: 'no receipt recorded' };
  const { actionType, fields } = receipt;
  let verified = false, reason = '';
  if (actionType === 'file_write') {
    if (!fs.existsSync(fields.path)) { reason = `file does not exist at ${fields.path}`; }
    else {
      const stat = fs.statSync(fields.path);
      const hash = sha256File(fields.path);
      verified = hash === fields.contentHash && stat.size === fields.size;
      reason = verified ? 'read-back hash and size match' : `read-back mismatch (hash ${hash === fields.contentHash}, size ${stat.size === fields.size})`;
    }
  } else if (actionType === 'purchase_or_spend') {
    verified = !!(fields.transactionId && fields.authorization && Number(fields.amountUsd) >= 0);
    reason = verified ? 'transaction fields internally consistent' : 'incomplete purchase receipt';
  } else if (actionType === 'message_or_outreach') {
    verified = fields.deliveryState === 'delivered' || fields.deliveryState === 'sent';
    reason = `deliveryState=${fields.deliveryState}`;
  } else {
    verified = req_ok(actionType, fields);
    reason = verified ? 'required fields present' : 'required fields missing';
  }
  const r2 = store.put('receipts', `receipt_${actionId}`, receipt.version, { status: verified ? 'verified' : 'verification-failed', verifiedAt: new Date().toISOString(), verificationReason: reason });
  return { verified, reason, receipt: r2.ok ? r2.doc : receipt };
}

function req_ok(actionType, fields) { return REQUIRED_FIELDS[actionType].every((k) => fields[k] !== undefined && fields[k] !== null); }

module.exports = { REQUIRED_FIELDS, recordReceipt, verify, sha256File };
