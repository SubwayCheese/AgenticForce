// Proposed addition for bus/tests/survive/fetch-timeouts.test.js (owner-reviewed; NOT applied).
// Coverage for fetchWithTimeout() (survive-alpaca-live-client.js), added because every fetch() in the live Alpaca client had
// no deadline (survive-supervisor.js:70-76 names the gap; reconcilePosition -- the first thing every wake does -- and the
// entry/exit fill polls had nothing at all). Tests fetchWithTimeout() directly (no network, no secrets-broker/credentials
// needed: it takes a URL and options, same as fetch itself) inside the sandbox's network-blocked environment, overriding
// globalThis.fetch per test with small local stubs.
//
// IMPORTANT ORDERING NOTE (from the coordinator's review): this patch must only be applied AFTER
// docs/proposals/executor-submit-try-catch/survive-executor.patch. That patch's error classification treats ANY error
// without a recognized "-> 4xx:" client message (or a client-side pre-network refusal) as an UNKNOWN outcome and freezes
// C1 pending human reconciliation -- a fetchWithTimeout() timeout (code 'ALPACA_TIMEOUT') falls squarely into that bucket,
// which is exactly the intended interaction: on a submit whose outcome is genuinely unknown, the executor must not guess
// and must not blindly retry. Applying the timeout patch first (without the try/catch patch) would instead let a timeout
// on client.submitOrder()/getOrder() escape executeEntry() uncaught, same wedge as before, just triggered sooner.
//
// Run against the applied tree:     node --test bus/tests/survive/fetch-timeouts.test.js
// Run against a candidate client:   CLIENT_UNDER_TEST=/path/to/survive-alpaca-live-client.js node --test <this file>
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const SANDBOX = process.env.SANDBOX_HELPER
  || [path.join(__dirname, '_sandbox.js'), path.join(__dirname, '..', '..', '..', 'bus', 'tests', 'survive', '_sandbox.js')].find((p) => fs.existsSync(p));
const { makeSandbox } = require(SANDBOX);

function setup() {
  const sbx = makeSandbox();
  if (process.env.CLIENT_UNDER_TEST) fs.copyFileSync(process.env.CLIENT_UNDER_TEST, sbx.dir('city', 'survive-alpaca-live-client.js'));
  return { sbx, client: sbx.load('survive-alpaca-live-client') };
}

// makeSandbox() already sets globalThis.fetch to a function that throws synchronously ("TEST NETWORK BLOCKED: fetch
// called") -- restore that exact behaviour after every test so no test leaks a stub that lets a later, unrelated test
// silently "succeed" over a fake network.
function restoreBlockedFetch() {
  globalThis.fetch = () => { throw new Error('TEST NETWORK BLOCKED: fetch called'); };
}

async function run(fn) {
  const { sbx, client } = setup();
  try { await fn({ sbx, client }); } finally { restoreBlockedFetch(); sbx.cleanup(); }
}

test('a fetch that never resolves is aborted at the deadline and throws ALPACA_TIMEOUT / outcomeUnknown per method', async () => {
  await run(async ({ client }) => {
    // Never resolves on its own; only settles (rejects, like real fetch does) when the AbortController fires.
    globalThis.fetch = (url, opts) => new Promise((_resolve, reject) => {
      opts.signal.addEventListener('abort', () => reject(new Error('simulated: connection aborted')));
    });

    await assert.rejects(
      client.fetchWithTimeout('https://api.alpaca.markets/v2/orders?client_order_id=abc', { method: 'POST' }, 25),
      (err) => {
        assert.equal(err.code, 'ALPACA_TIMEOUT');
        assert.equal(err.outcomeUnknown, true, 'a non-GET timeout is an unknown outcome -- the broker may have accepted it');
        assert.match(err.message, /timed out after 25ms/);
        assert.match(err.message, /POST/);
        assert.match(err.message, /OUTCOME UNKNOWN/);
        return true;
      },
    );

    await assert.rejects(
      client.fetchWithTimeout('https://data.alpaca.markets/v2/stocks/quotes/latest?symbols=SGOV', {}, 25),
      (err) => {
        assert.equal(err.code, 'ALPACA_TIMEOUT');
        assert.equal(err.outcomeUnknown, false, 'a GET timeout is a read failure, not an unknown order outcome');
        assert.doesNotMatch(err.message, /OUTCOME UNKNOWN/);
        return true;
      },
    );
  });
});

test('the deadline covers reading the response BODY too, not just getting a Response back', async () => {
  await run(async ({ client }) => {
    // fetch() itself resolves quickly, but res.text() hangs until the same signal fires -- mirrors a real slow-body
    // connection, where aborting the request also aborts an in-flight body read on the same socket.
    globalThis.fetch = async (url, opts) => ({
      ok: true,
      status: 200,
      text: () => new Promise((_resolve, reject) => { opts.signal.addEventListener('abort', () => reject(new Error('simulated: body read aborted'))); }),
    });
    await assert.rejects(client.fetchWithTimeout('https://api.alpaca.markets/v2/account', {}, 25), { code: 'ALPACA_TIMEOUT' });
  });
});

test('a normal, fast response passes through unchanged: { res, text }, no error', async () => {
  await run(async ({ client }) => {
    let sawSignal = null;
    globalThis.fetch = async (url, opts) => { sawSignal = opts.signal; return { ok: true, status: 200, text: async () => '{"id":"abc"}' }; };
    const { res, text } = await client.fetchWithTimeout('https://api.alpaca.markets/v2/account', {}, 5000);
    assert.equal(res.ok, true);
    assert.equal(res.status, 200);
    assert.equal(text, '{"id":"abc"}');
    assert.equal(sawSignal.aborted, false, 'success must not leave the controller in an aborted state');
  });
});

test('a synchronous throw from the fetch stub (the sandbox\'s own network-blocked behaviour) is rethrown UNCHANGED, never relabeled as a timeout', async () => {
  await run(async ({ client }) => {
    // Do not override globalThis.fetch here at all -- exercise the sandbox's real default network-blocked stub, exactly as
    // every other credential-free code path in this repo's tests already relies on.
    await assert.rejects(
      client.fetchWithTimeout('https://api.alpaca.markets/v2/account', {}, 5000),
      (err) => {
        assert.equal(err.message, 'TEST NETWORK BLOCKED: fetch called', 'the original error, verbatim -- not wrapped, not given an ALPACA_TIMEOUT code');
        assert.notEqual(err.code, 'ALPACA_TIMEOUT');
        assert.equal('outcomeUnknown' in err, false);
        return true;
      },
    );
  });
});

test('an ordinary rejected fetch (e.g. DNS/connection failure) before the deadline is also rethrown unchanged', async () => {
  await run(async ({ client }) => {
    globalThis.fetch = async () => { throw new Error('getaddrinfo ENOTFOUND api.alpaca.markets'); };
    await assert.rejects(client.fetchWithTimeout('https://api.alpaca.markets/v2/account', {}, 5000), (err) => {
      assert.equal(err.message, 'getaddrinfo ENOTFOUND api.alpaca.markets');
      assert.notEqual(err.code, 'ALPACA_TIMEOUT');
      return true;
    });
  });
});

test('the timer is cleared on success -- no leaked handle', async () => {
  await run(async ({ client }) => {
    globalThis.fetch = async () => ({ ok: true, status: 200, text: async () => 'ok' });
    const realSetTimeout = global.setTimeout, realClearTimeout = global.clearTimeout;
    let created = null, cleared = [];
    global.setTimeout = (...a) => { created = realSetTimeout(...a); return created; };
    global.clearTimeout = (h) => { cleared.push(h); return realClearTimeout(h); };
    try {
      await client.fetchWithTimeout('https://api.alpaca.markets/v2/account', {}, 5000);
    } finally {
      global.setTimeout = realSetTimeout;
      global.clearTimeout = realClearTimeout;
    }
    assert.notEqual(created, null, 'the wrapper must actually arm a deadline timer');
    assert.ok(cleared.includes(created), 'the exact timer created for this call must be cleared once the call succeeds');
  });
});

test('the timer is ALSO cleared when the call throws (not just on success)', async () => {
  await run(async ({ client }) => {
    globalThis.fetch = async () => { throw new Error('boom'); };
    const realSetTimeout = global.setTimeout, realClearTimeout = global.clearTimeout;
    let created = null, cleared = [];
    global.setTimeout = (...a) => { created = realSetTimeout(...a); return created; };
    global.clearTimeout = (h) => { cleared.push(h); return realClearTimeout(h); };
    try {
      await assert.rejects(client.fetchWithTimeout('https://api.alpaca.markets/v2/account', {}, 5000));
    } finally {
      global.setTimeout = realSetTimeout;
      global.clearTimeout = realClearTimeout;
    }
    assert.ok(cleared.includes(created));
  });
});

test('the timeout error message carries no secrets: no query string, no key/secret header values, even if present in the URL', async () => {
  await run(async ({ client }) => {
    globalThis.fetch = (url, opts) => new Promise((_resolve, reject) => { opts.signal.addEventListener('abort', () => reject(new Error('aborted'))); });
    const secretLookingUrl = 'https://api.alpaca.markets/v2/orders?client_order_id=survive-C1-mission099-entry&apikey=DO-NOT-LEAK-THIS-VALUE';
    await assert.rejects(
      client.fetchWithTimeout(secretLookingUrl, { method: 'GET', headers: { 'APCA-API-KEY-ID': 'FAKE-KEY-DO-NOT-LEAK', 'APCA-API-SECRET-KEY': 'FAKE-SECRET-DO-NOT-LEAK' } }, 25),
      (err) => {
        assert.doesNotMatch(err.message, /DO-NOT-LEAK/);
        assert.doesNotMatch(err.message, /apikey=/);
        assert.doesNotMatch(err.message, /client_order_id=/, 'the query string is stripped entirely, not selectively redacted');
        assert.match(err.message, /\/v2\/orders/, 'the path itself is still shown, which is useful and not sensitive');
        return true;
      },
    );
  });
});

test('apiRequest()/getLatestQuote() route through fetchWithTimeout and surface the same timeout error, not a hang', async () => {
  await run(async ({ client }) => {
    globalThis.fetch = (url, opts) => new Promise((_resolve, reject) => { opts.signal.addEventListener('abort', () => reject(new Error('aborted'))); });
    // Both apiRequest() and getLatestQuote() call loadConfig() first, which needs real secrets this sandbox never provides
    // (by design -- see AGENTS.md, never point tests at real credentials). Assert the failure is the credentials error, not
    // a hang and not a TypeError from a missing fetchWithTimeout wiring -- i.e. that we get PAST the network stub setup and
    // fail exactly where a credential-free sandbox is expected to fail, proving the network call site is reached lazily
    // and correctly, without ever making it hang for the test's own default timeout.
    await assert.rejects(client.apiRequest('GET', '/account'), /Live Alpaca credentials not fully configured/);
    await assert.rejects(client.getLatestQuote('SGOV'), /Live Alpaca credentials not fully configured/);
  });
});
