// survive-stop-guard.js -- C1 live-money safety job: re-arms (never lowers) a protective stop for every open lot the
// broker doesn't already have one working for; NEVER cancels, replaces, or places a market sell (owner-approved design,
// codex rejected the bigger version -- see docs/HANDOFF.md 2026-09-29 "Re-arm/whole-share sizing for stops"). Real orders
// are placed only through the injected/loaded live client's submitOrder(); this file never touches secrets directly.

const fs = require('fs');
const path = require('path');
const avPaths = require('../lib/paths.js');
const cityRegistry = require('./city-registry.js');
const budgetEnvelope = require('./survive-budget-envelope.js');
const executor = require('./survive-executor.js');
const marketData = require('./survive-market-data.js');
const ntfy = require('../platform/ntfy.js');
const c1Lock = require('./c1-execution-lock.js');

const SURVIVE_NTFY_TOPIC = executor.SURVIVE_NTFY_TOPIC;
const HEARTBEAT_PATH = avPaths.bus('city-state', 'stop-guard-last-run.json');

const MIN_MINUTES_TO_CLOSE = 10;
const TRAIL_PCT = 0.08;
const FALLBACK_STOP_PCT = 0.05;
const MAX_SPREAD_PCT = 0.01;
const BARS_TIMEOUT_MS = 15000;
// The supervisor holds the shared execution lock around reconcile/execute/author (network calls with their own
// timeouts); waiting 2 minutes rides out a normal wake, and the 10:05 ET run is the retry if this one gives up.
const LOCK_WAIT_MS = 120000;
const QUOTE_MAX_AGE_MS = 120000;
const QUOTE_MAX_FUTURE_MS = 60000;
// Alpaca order statuses (docs.alpaca.markets "Orders at Alpaca"), split three ways (codex round 4):
//   CONFIRMED -- 'new': routed and working at the broker, the only state that counts as "this lot is protected";
//   TERMINAL  -- the order is done and protects nothing;
//   anything else (pending_new, accepted, held, pending_cancel, pending_replace, stopped, partially_filled, unknown) is
//   UNCERTAIN: never counted as protection, never stacked on with a second order, always surfaced to the owner.
const CONFIRMED_ORDER_STATUSES = new Set(['new']);
const TERMINAL_ORDER_STATUSES = new Set(['filled', 'canceled', 'expired', 'rejected', 'done_for_day', 'replaced', 'suspended']);
const PROTECTIVE_ORDER_TYPES = new Set(['stop', 'stop_limit', 'trailing_stop']);
const CONFIRM_ATTEMPTS = 5;
const CONFIRM_POLL_MS = 1000;

function classifyOrderStatus(status) {
  const s = String(status || '');
  if (CONFIRMED_ORDER_STATUSES.has(s)) return 'confirmed';
  if (TERMINAL_ORDER_STATUSES.has(s)) return 'terminal';
  return 'uncertain';
}

// Round down to 2 decimals -- an epsilon guards against float artifacts (e.g. 95.59*100 landing on 9558.999999...).
function floor2(x) {
  return Math.floor(x * 100 + 1e-9) / 100;
}

// The ET calendar date for a timestamp/Date -- daily bars are ET-dated (see survive-market-data.js's header), so "today"
// and "the fill date" must both be read in the same timezone or the trail could silently include/exclude the wrong bar.
function nyDateStr(dateLike) {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' });
  return fmt.format(new Date(dateLike)); // "YYYY-MM-DD"
}

// Pure. initial = the highest level this lot has ever recorded (a prior stop-level event's `level`, or a prior
// stop-placed event's `stopPrice`, from survive-stop-guard OR survive-executor -- history is NEVER lowered), else a 5%
// fallback off the fill price. trailing = the highest COMPLETED-session close since the fill date (today's bar and
// anything at/after `now` is excluded), trailed by 8%. desired = max(initial, trailing), rounded down to 2 decimals.
function computeDesiredLevel({ lot, missionEvents, fillPrice, fillDate, bars, now }) {
  const histLevels = [];
  for (const e of missionEvents || []) {
    if (!e || e.lotId !== lot.lotId) continue;
    if (e.type === 'stop-level' && Number.isFinite(e.level)) histLevels.push(Number(e.level));
    if (e.type === 'stop-placed' && Number.isFinite(e.stopPrice)) histLevels.push(Number(e.stopPrice));
  }
  let initialLevel;
  let initialSource;
  if (histLevels.length) {
    initialLevel = floor2(Math.max(...histLevels));
    initialSource = 'history';
  } else {
    initialLevel = floor2(Number(fillPrice) * (1 - FALLBACK_STOP_PCT));
    initialSource = 'fallback';
  }

  let highWater = null;
  let trailing = null;
  if (fillDate && Array.isArray(bars) && bars.length) {
    const today = nyDateStr(now);
    const completed = bars.filter((b) => b && b.date >= fillDate && b.date < today && Number.isFinite(b.close));
    if (completed.length) {
      highWater = Math.max(...completed.map((b) => b.close));
      trailing = floor2(highWater * (1 - TRAIL_PCT));
    }
  }

  const desired = trailing != null ? Math.max(initialLevel, trailing) : initialLevel;
  const source = trailing != null && trailing > initialLevel ? 'trailing' : initialSource;
  return { desired: floor2(desired), initialLevel, highWater, trailing, source };
}

// Pure. A quote is only actionable when both sides are real, finite, positive, not crossed/zero-width, and tight
// (<=1% spread) -- never act (place or judge a stop against) a bad quote.
function validateQuote(quote) {
  if (!quote) return { valid: false, reason: 'no quote available' };
  const bid = Number(quote.bid);
  const ask = Number(quote.ask);
  if (!Number.isFinite(bid) || !Number.isFinite(ask)) return { valid: false, reason: 'non-finite bid/ask' };
  if (!(bid > 0)) return { valid: false, reason: 'bid is not positive' };
  if (!(ask > bid)) return { valid: false, reason: 'quote is crossed or zero-width' };
  const mid = (bid + ask) / 2;
  const spreadPct = (ask - bid) / mid;
  if (spreadPct > MAX_SPREAD_PCT) return { valid: false, reason: `spread ${(spreadPct * 100).toFixed(2)}% exceeds ${(MAX_SPREAD_PCT * 100).toFixed(0)}%` };
  return { valid: true, spreadPct };
}

// Pure. A quote is only fresh when Alpaca's own timestamp (raw.t) exists and sits within [now - 120 s, now + 60 s] of
// the clock read right after the quote came back -- an old quote (e.g. yesterday's on a thin IEX symbol) is never acted on.
function checkQuoteFreshness(quote, nowMs) {
  const t = quote && quote.raw ? Date.parse(quote.raw.t) : NaN;
  if (!Number.isFinite(t)) return { fresh: false, reason: 'quote has no timestamp' };
  if (!Number.isFinite(nowMs)) return { fresh: false, reason: 'no clock reading to judge the quote against' };
  const ageMs = nowMs - t;
  if (ageMs > QUOTE_MAX_AGE_MS) return { fresh: false, reason: `quote is ${Math.round(ageMs / 1000)} s old (max ${QUOTE_MAX_AGE_MS / 1000})` };
  if (-ageMs > QUOTE_MAX_FUTURE_MS) return { fresh: false, reason: `quote is stamped ${Math.round(-ageMs / 1000)} s in the future` };
  return { fresh: true, ageMs };
}

const CLIENT_ORDER_ID_MAX = 128;
function normalizeClientOrderId(raw) {
  const cleaned = String(raw).replace(/[^A-Za-z0-9._-]/g, '-');
  return cleaned.length <= CLIENT_ORDER_ID_MAX ? cleaned : cleaned.slice(-CLIENT_ORDER_ID_MAX);
}

// Pure decision function for one lot, given already-fetched data -- no I/O, no side effects. Returns one of:
//   { action: 'skip', reason }                              -- already protected / an open buy is present
//   { action: 'alert-skip', reason, priority, title, message } -- reconcile gap / mismatch / bad quote / price-at-stop
//   { action: 'place-stop', desired, initialLevel, highWater, source, clientOrderId, qty, symbol }
function planForLot({ citizenId, lot, missionEvents, fillEvent, positions, openOrders, quote, quoteCheckedAtMs, bars, now }) {
  const fillPrice = fillEvent ? Number(fillEvent.price) : (lot.qty ? lot.costUsd / lot.qty : null);
  const fillDate = fillEvent && fillEvent.ts ? nyDateStr(fillEvent.ts) : null;

  const brokerPos = (positions || []).find((p) => p.symbol === lot.symbol);
  const brokerQty = brokerPos ? Number(brokerPos.qty) : 0;
  if (!brokerPos || !(brokerQty > 0)) {
    return {
      action: 'alert-skip', reason: 'no-broker-position', priority: 4,
      title: `${citizenId} ${lot.symbol}: ledger open lot, no broker position`,
      message: `Ledger shows an open lot (${lot.lotId}) for ${lot.symbol} but the broker shows no position -- reconcile will book it. No action taken.`,
    };
  }
  if (Math.abs(brokerQty - Number(lot.qty)) > 1e-6) {
    return {
      action: 'alert-skip', reason: 'qty-mismatch', priority: 4,
      title: `${citizenId} ${lot.symbol}: share count mismatch`,
      message: `Ledger qty ${lot.qty} vs broker qty ${brokerQty} for ${lot.symbol} (lot ${lot.lotId}) -- possible split/partial fill. No action taken.`,
    };
  }

  const symbolOrders = (openOrders || []).filter((o) => o && o.symbol === lot.symbol);
  const sells = symbolOrders.filter((o) => o.side === 'sell');
  // Only a working stop-type sell covering the whole lot counts as protection. Any other open sell (a limit, an
  // undersized stop, a stop being canceled/replaced) means the lot is NOT verified protected -- and a new stop can't be
  // stacked on top of it (the shares are already reserved), so the owner must decide (codex round 4).
  const covering = sells.find((o) => PROTECTIVE_ORDER_TYPES.has(String(o.type)) && Number(o.qty) >= Number(lot.qty) - 1e-6
    && classifyOrderStatus(o.status) === 'confirmed');
  if (covering) return { action: 'skip', reason: 'already-protected' };
  if (sells.length) {
    const desc = sells.map((o) => `${o.type} ${o.qty} sh (${o.status})`).join('; ');
    return {
      action: 'alert-skip', reason: 'unverified-sell', priority: 5,
      title: `${citizenId} ${lot.symbol}: NOT verified protected -- other sell order open`,
      message: `Open sell order(s) for ${lot.symbol}: ${desc}. None is a working stop covering the whole lot (${lot.qty} sh, lot ${lot.lotId}), and a new stop can't be added on top. Owner decides.`,
    };
  }
  if (symbolOrders.some((o) => o.side === 'buy')) {
    return {
      action: 'alert-skip', reason: 'open-buy-order', priority: 4,
      title: `${citizenId} ${lot.symbol}: stop skipped, open buy order`,
      message: `An open buy order for ${lot.symbol} is working, so no stop was placed for lot ${lot.lotId} (${lot.qty} sh) this run -- the position is NOT verified protected.`,
    };
  }

  const levelInfo = computeDesiredLevel({ lot, missionEvents, fillPrice, fillDate, bars, now });

  const qv = validateQuote(quote);
  if (!qv.valid) {
    return {
      action: 'alert-skip', reason: 'invalid-quote', priority: 4,
      title: `${citizenId} ${lot.symbol}: quote invalid`,
      message: `Could not validate the live quote for ${lot.symbol} (${qv.reason}) -- refusing to act on a bad quote.`,
    };
  }
  const qf = checkQuoteFreshness(quote, quoteCheckedAtMs);
  if (!qf.fresh) {
    return {
      action: 'alert-skip', reason: 'stale-quote', priority: 4,
      title: `${citizenId} ${lot.symbol}: quote stale`,
      message: `The live quote for ${lot.symbol} is not fresh (${qf.reason}) -- refusing to judge a stop against it.`,
    };
  }

  if (levelInfo.desired >= quote.bid - 0.01) {
    return {
      action: 'alert-skip', reason: 'price-at-stop', priority: 5,
      title: `${citizenId} ${lot.symbol}: price is at/below the stop level`,
      message: `Desired stop $${levelInfo.desired.toFixed(2)} is at/above the live bid $${quote.bid} for ${lot.symbol} (lot ${lot.lotId}) at the open -- no stop can be placed. Owner decides.`,
    };
  }

  const dateStr = nyDateStr(now).replace(/-/g, '');
  const lotSuffix = String(lot.lotId).slice(-8);
  const clientOrderId = normalizeClientOrderId(`survive-${citizenId}-stop-${lotSuffix}-${dateStr}`);

  return {
    action: 'place-stop',
    desired: levelInfo.desired,
    initialLevel: levelInfo.initialLevel,
    highWater: levelInfo.highWater,
    source: levelInfo.source,
    clientOrderId,
    qty: lot.qty,
    symbol: lot.symbol,
  };
}

async function defaultGetBars(symbol, { start, now }) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), BARS_TIMEOUT_MS);
  try {
    return await marketData.getAdjustedDailyBars(symbol, {
      start,
      fetchFn: (url, opts) => fetch(url, { ...opts, signal: ac.signal }),
    });
  } finally {
    clearTimeout(timer);
  }
}

// run(opts): the only I/O-performing entry point. Every dependency is overridable for tests; production defaults use the
// real live client, real lock/heartbeat paths, and the real ntfy sender.
async function run(opts = {}) {
  const {
    client: injectedClient,
    now = new Date(),
    // The clock read right after each quote arrives (freshness check). Production: the real clock. Tests that pin
    // `now` get that fixed time unless they pass their own nowFn.
    nowFn = opts.now ? () => new Date(opts.now) : () => new Date(),
    dryRun = false,
    assumeOpen = false, // rehearsal only: pretend the market is open; refused unless dryRun
    lockName = c1Lock.DEFAULT_NAME,
    lockWaitMs = LOCK_WAIT_MS,
    confirmAttempts = CONFIRM_ATTEMPTS,
    confirmPollMs = CONFIRM_POLL_MS,
    heartbeatPath = HEARTBEAT_PATH,
    sendNtfy = ntfy.sendNtfy,
    getBars = defaultGetBars,
    log = (...a) => console.log(...a),
  } = opts;

  if (assumeOpen && !dryRun) throw new Error('--assume-open is only allowed with --dry-run');
  const actions = [];
  const dryRunLines = [];

  function makeDryRunClient(real) {
    return {
      getClock: async (...a) => {
        const c = await real.getClock(...a);
        return assumeOpen ? { ...c, is_open: true, next_close: new Date(now.getTime() + 6 * 3600e3).toISOString() } : c;
      },
      getLatestQuote: (...a) => real.getLatestQuote(...a),
      getPositions: (...a) => real.getPositions(...a),
      getOrders: (...a) => real.getOrders(...a),
      getOrderByClientOrderId: (...a) => (real.getOrderByClientOrderId ? real.getOrderByClientOrderId(...a) : Promise.resolve(null)),
      submitOrder: async (o) => {
        dryRunLines.push(`[dry-run] would submit stop order: ${JSON.stringify(o)}`);
        return { id: 'dry-run-not-sent', ...o, status: 'new' };
      },
    };
  }

  // Dry run always wraps a real client's READ calls (the CLI never passes `client`, so this is executor.loadClient() in
  // production -- read-only by construction) but lets a test inject its own fake in place of that real client.
  const baseClient = injectedClient || executor.loadClient();
  const client = dryRun ? makeDryRunClient(baseClient) : baseClient;

  async function alert(title, message, priority) {
    if (dryRun) {
      dryRunLines.push(`[dry-run] would alert (priority ${priority}): ${title} -- ${message}`);
      return;
    }
    try {
      await sendNtfy({ topic: SURVIVE_NTFY_TOPIC, title, message, priority });
    } catch (_) { /* best-effort */ }
  }

  // Never lets a failed append abort the run: the order already exists at the broker, so the alerts and heartbeat
  // that follow matter more than this record (codex round 6).
  async function writeStopLevelEvent(evt) {
    if (dryRun) {
      dryRunLines.push(`[dry-run] would append stop-level event: ${JSON.stringify(evt)}`);
      return;
    }
    try {
      executor.appendMissionEvent({ type: 'stop-level', ...evt });
    } catch (err) {
      await alert(`${evt.citizenId} ${evt.symbol}: stop level not recorded`,
        `Stop order ${evt.orderId} at $${evt.level} was submitted, but recording its stop-level event failed (${String((err && err.message) || err).slice(0, 200)}). Tomorrow's level may not ratchet from it.`, 4);
      actions.push({ citizenId: evt.citizenId, lotId: evt.lotId, symbol: evt.symbol, action: 'alert-record-failed' });
    }
  }

  function finish() {
    const heartbeat = { ts: new Date(now).toISOString(), actions };
    if (dryRun) {
      for (const line of dryRunLines) log(line);
      log(`[dry-run] plan: ${JSON.stringify(heartbeat, null, 2)}`);
    } else {
      try {
        fs.mkdirSync(path.dirname(heartbeatPath), { recursive: true });
        fs.writeFileSync(heartbeatPath, JSON.stringify(heartbeat, null, 2));
      } catch (err) {
        log(`stop-guard: failed to write heartbeat: ${err.message}`);
      }
    }
    return { actions };
  }

  // 1. market clock -- closed, or too close to the next close, means no action at all.
  let clock;
  try {
    clock = await client.getClock();
  } catch (err) {
    log(`stop-guard: could not read the market clock (${err.message}) -- no action`);
    await alert('stop-guard: market clock unreadable',
      `Reading the Alpaca market clock failed (${String((err && err.message) || err).slice(0, 200)}) -- no stop checked or placed this run.`, 4);
    actions.push({ action: 'alert-clock-failed' });
    return finish();
  }
  if (!clock || !clock.is_open) {
    log('stop-guard: market is closed -- no action');
    return finish();
  }
  const minutesToClose = (new Date(clock.next_close) - new Date(now)) / 60000;
  if (!(minutesToClose >= MIN_MINUTES_TO_CLOSE)) {
    log(`stop-guard: next_close is ${minutesToClose.toFixed(1)} minutes away (< ${MIN_MINUTES_TO_CLOSE}) -- no action`);
    return finish();
  }

  // 2. the execution lock shared with survive-supervisor.js (see c1-execution-lock.js) -- held for the whole run so the
  // supervisor can't reconcile/execute/author while positions and orders are read and a stop is submitted. Dry run is
  // read-only by construction and never takes it.
  let held = null;
  if (!dryRun) {
    held = await c1Lock.acquire({ name: lockName, wait_ms: lockWaitMs });
    if (!held) {
      await alert(
        'stop-guard: execution lock busy',
        `The C1 execution lock was still held after ${Math.round(lockWaitMs / 1000)} s (the supervisor mid-wake?) -- no stop checked or placed this run.`,
        4
      );
      actions.push({ action: 'alert-lock-busy' });
      return finish();
    }
  }

  try {
    await doWork();
  } finally {
    if (held) held.release();
  }
  return finish();

  async function doWork() {
    let citizens;
    try {
      citizens = cityRegistry.listCitizens();
    } catch (err) {
      await alert('stop-guard: citizen registry unreadable',
        `Listing citizens failed (${String((err && err.message) || err).slice(0, 200)}) -- no stop checked or placed this run.`, 4);
      actions.push({ action: 'alert-registry-failed' });
      return;
    }

    for (const citizen of citizens) {
      const citizenId = citizen.citizenId;
      let ledger;
      try {
        ledger = budgetEnvelope.computeLifetimeLedger(citizenId);
      } catch (err) {
        await alert(`${citizenId}: stop-guard could not read the ledger`,
          `Reading ${citizenId}'s ledger failed (${String((err && err.message) || err).slice(0, 200)}) -- its open lots (if any) were NOT checked or protected this run.`, 4);
        actions.push({ citizenId, action: 'alert-ledger-failed' });
        continue;
      }
      if (!ledger.openLots || !ledger.openLots.length) continue;

      // Only a pending TRADE (enter/exit) can race a stop; a pending hold/no-action cannot, and decisions wait up to 2h
      // between being made and executed, so skipping on every pending decision left positions unprotected for whole
      // mornings (found in the 2026-09-29 rehearsal). A lookup that fails, or a decision that can't be read, is treated
      // as a trade: skip -- and, since skipping leaves the lot unprotected today, always tell the owner.
      let unresolved;
      try {
        unresolved = executor.findLatestUnresolvedDecision(citizenId);
      } catch (err) {
        await alert(
          `${citizenId}: stop-guard could not check pending decisions`,
          `Looking up ${citizenId}'s pending decision failed (${String((err && err.message) || err).slice(0, 200)}) -- no stop checked or placed for its open lots this run.`,
          4
        );
        actions.push({ citizenId, action: 'alert-decision-lookup-failed' });
        continue;
      }
      let pendingAction = 'unknown';
      if (unresolved) {
        try { pendingAction = String(executor.extractSurviveDecision(unresolved.taskId).decision || 'unknown'); } catch (_) { pendingAction = 'unknown'; }
        if (pendingAction === 'hold' || pendingAction === 'no-action') {
          log(`stop-guard: ${citizenId}: pending decision ${unresolved.missionId} is '${pendingAction}' -- protecting as normal`);
          unresolved = null;
        }
      }
      if (unresolved) {
        await alert(
          `${citizenId}: stop skipped, pending '${pendingAction}' decision`,
          `${citizenId} has a pending '${pendingAction}' decision (${unresolved.missionId}) that the supervisor has not executed yet -- no stop placed for its open lots this run.`,
          4
        );
        actions.push({ citizenId, missionId: unresolved.missionId, action: 'alert-pending-trade', pendingAction });
        continue;
      }

      const missionEvents = executor.readMissionEvents(citizenId);
      const rawEvents = budgetEnvelope.readCitizenEvents(citizenId);

      // Order matters (codex round-3 review): the slow bars fetch comes FIRST, then the broker's positions/orders, then
      // each lot's quote right before its plan/submit -- so no slow call sits between the quote and the order.
      const lotInputs = [];
      for (const lot of ledger.openLots) {
        const fillEvent = rawEvents.filter((e) => e.type === 'order-fill-buy' && e.lotId === lot.lotId).pop() || null;
        let bars = null;
        const fillDate = fillEvent && fillEvent.ts ? nyDateStr(fillEvent.ts) : null;
        if (fillDate) {
          try {
            bars = await getBars(lot.symbol, { start: fillDate, now });
          } catch (err) {
            log(`stop-guard: ${citizenId} ${lot.symbol}: bars fetch failed (${err.message}) -- using the initial level only`);
            bars = null;
          }
        }
        lotInputs.push({ lot, fillEvent, bars });
      }

      let positions;
      let openOrders;
      try {
        positions = await client.getPositions();
        openOrders = await client.getOrders('open');
      } catch (err) {
        await alert(
          `${citizenId}: stop-guard could not read the broker`,
          `Reading positions/open orders failed (${String((err && err.message) || err).slice(0, 200)}) -- ${citizenId}'s ${ledger.openLots.length} open lot(s) were NOT checked or protected this run.`,
          4
        );
        actions.push({ citizenId, action: 'alert-broker-read-failed' });
        continue;
      }

      for (const { lot, fillEvent, bars } of lotInputs) {
        let quote = null;
        try {
          quote = await client.getLatestQuote(lot.symbol);
        } catch (_) {
          quote = null;
        }
        const quoteCheckedAtMs = nowFn().getTime();

        const plan = planForLot({ citizenId, lot, missionEvents, fillEvent, positions, openOrders, quote, quoteCheckedAtMs, bars, now });

        if (dryRun) dryRunLines.push(`[dry-run] plan for ${citizenId} ${lot.symbol} (lot ${lot.lotId}): ${JSON.stringify(plan)}`);

        if (plan.action === 'skip') {
          log(`stop-guard: ${citizenId} ${lot.symbol}: ${plan.reason} -- no action`);
          continue;
        }
        if (plan.action === 'alert-skip') {
          await alert(plan.title, plan.message, plan.priority);
          actions.push({ citizenId, lotId: lot.lotId, symbol: lot.symbol, action: `alert-${plan.reason}` });
          continue;
        }

        // plan.action === 'place-stop'
        let order;
        let submitErr = null;
        try {
          order = await client.submitOrder({
            citizenId, symbol: plan.symbol, direction: 'short', qty: plan.qty, orderType: 'stop',
            stopPrice: plan.desired, timeInForce: 'day', intent: 'close', clientOrderId: plan.clientOrderId,
          });
        } catch (err) {
          submitErr = err;
          let found = null;
          if (!dryRun) {
            try { found = await client.getOrderByClientOrderId(plan.clientOrderId); } catch (_) { found = null; }
          }
          if (!(found && found.id)) {
            await alert(
              `${citizenId} ${lot.symbol}: stop placement failed`,
              `submitOrder failed for ${lot.symbol} (lot ${lot.lotId}): ${String((err && err.message) || err).slice(0, 300)}`,
              4
            );
            actions.push({ citizenId, lotId: lot.lotId, symbol: lot.symbol, action: 'alert-submit-failed' });
            continue;
          }
          order = found;
        }

        // The same status rules for a fresh submission and for an order found by client id: only 'new' is protection.
        let status = order && order.status;
        for (let i = 0; classifyOrderStatus(status) === 'uncertain' && i < confirmAttempts && !dryRun; i++) {
          await new Promise((r) => setTimeout(r, confirmPollMs));
          try { status = (await client.getOrder(order.id)).status; } catch (_) { /* keep the last known status */ }
        }
        const verdict = classifyOrderStatus(status);
        if (verdict === 'terminal' || !(order && order.id)) {
          const why = submitErr ? `a new stop was refused (${String(submitErr.message || submitErr).slice(0, 200)}) and ` : '';
          await alert(
            `${citizenId} ${lot.symbol}: UNPROTECTED -- today's stop is ${status || 'in an unknown state'}`,
            `For ${lot.symbol} (lot ${lot.lotId}) ${why}today's stop (client id ${plan.clientOrderId}, order ${order && order.id}) has status '${status}', not working. The lot has no stop. Owner decides.`,
            5
          );
          actions.push({ citizenId, lotId: lot.lotId, symbol: lot.symbol, action: 'alert-unprotected', orderId: order && order.id, orderStatus: status });
          continue;
        }
        if (verdict === 'uncertain') {
          // Record the level (so it is never lowered and a re-run sees the order) but do not claim protection.
          await writeStopLevelEvent({
            citizenId, lotId: lot.lotId, symbol: lot.symbol, level: plan.desired, initialLevel: plan.initialLevel,
            highWater: plan.highWater, trailPct: TRAIL_PCT * 100, source: plan.source, orderId: order.id,
            clientOrderId: plan.clientOrderId, date: nyDateStr(now), unconfirmedStatus: String(status),
          });
          await alert(
            `${citizenId} ${lot.symbol}: stop unconfirmed (status ${status})`,
            `The stop at $${plan.desired} for ${lot.symbol} (lot ${lot.lotId}, order ${order.id}) is still '${status}' after ${confirmAttempts} checks -- not confirmed working. Check it in the Alpaca dashboard.`,
            4
          );
          actions.push({ citizenId, lotId: lot.lotId, symbol: lot.symbol, action: 'stop-unconfirmed', level: plan.desired, orderId: order.id, orderStatus: status });
          continue;
        }

        await writeStopLevelEvent({
          citizenId, lotId: lot.lotId, symbol: lot.symbol, level: plan.desired, initialLevel: plan.initialLevel,
          highWater: plan.highWater, trailPct: TRAIL_PCT * 100, source: plan.source, orderId: order.id,
          clientOrderId: plan.clientOrderId, date: nyDateStr(now),
        });
        actions.push({ citizenId, lotId: lot.lotId, symbol: lot.symbol, action: 'stop-placed', level: plan.desired, orderId: order.id, clientOrderId: plan.clientOrderId });
        log(`stop-guard: ${citizenId} ${lot.symbol}: stop placed at $${plan.desired} (order ${order.id})`);
      }
    }
  }
}

module.exports = {
  floor2,
  nyDateStr,
  computeDesiredLevel,
  validateQuote,
  normalizeClientOrderId,
  planForLot,
  run,
  checkQuoteFreshness,
  classifyOrderStatus,
  HEARTBEAT_PATH,
  MIN_MINUTES_TO_CLOSE,
  TRAIL_PCT,
  FALLBACK_STOP_PCT,
};

// CLI: node survive-stop-guard.js [--dry-run [--assume-open]]
if (require.main === module) {
  const dryRun = process.argv.includes('--dry-run');
  run({ dryRun, assumeOpen: process.argv.includes('--assume-open') }).then((r) => {
    if (!dryRun) console.log(JSON.stringify(r, null, 2));
  }).catch((err) => {
    console.error('FAILED:', err.message);
    process.exit(1);
  });
}
