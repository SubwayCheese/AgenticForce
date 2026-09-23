// survive-executor.js -- the deterministic execution layer for the
// "survive" branch (ARCHITECTURE.md section 19). Mirrors
// execute-portfolio-setup.js's own "LLM decides, deterministic code
// executes" separation exactly: a citizen's decision task emits a
// structured JSON block; this file is the ONLY thing that ever calls
// survive-alpaca-live-client.js's submitOrder(). The LLM itself never has
// the ability to place a real order.
//
// KNOWN GAP, named honestly rather than silently omitted: unlike
// monitor-paper-trades.js's continuous stop-reconciliation loop for the
// existing fleet, this file does not yet re-arm a 'day' stop that expires,
// or reconcile a position the log thinks is open but a stop already
// closed. A future addition, not built in this pass -- flagged in
// ARCHITECTURE.md.

const avPaths = require('../lib/paths.js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const runTask = require('../platform/run-task.js');
const budgetEnvelope = require('./survive-budget-envelope.js');
const cityRegistry = require('./city-registry.js');
const ntfy = require('../platform/ntfy.js');
const { parseStopPrice } = require('../fleet/execute-portfolio-setup.js');

const VAULT_ROOT = avPaths.ROOT;
const TASKS_SURVIVE_DIR = path.join(VAULT_ROOT, 'tasks', 'survive');
let MISSIONS_LOG_PATH = path.join(VAULT_ROOT, 'bus', 'survive-missions.jsonl');
const SURVIVE_NTFY_TOPIC = 'AgentVaultSurvive'; // adjust before going live -- a dedicated topic, separate from the trading fleet's ClaudeTeam noise
const FALLBACK_STOP_PCT = 0.05; // no numeric level in the decision's invalidationCondition -- conservative 5% fallback off the fill price, same reasoning as execute-portfolio-setup.js's own equity fallback

function nowIso() {
  return new Date().toISOString();
}

// Test-only hook, same pattern as every other survive-*.jsonl module --
// added round 7 so city-security.js's tests can exercise readMissionEvents()
// against isolated data instead of the real bus/survive-missions.jsonl.
function _setMissionsLogPathForTesting(p) {
  MISSIONS_LOG_PATH = p;
}

function appendMissionEvent(record) {
  const entry = { ts: nowIso(), ...record };
  fs.appendFileSync(MISSIONS_LOG_PATH, JSON.stringify(entry) + '\n', 'utf8');
  return entry;
}

function readMissionEvents(citizenId) {
  if (!fs.existsSync(MISSIONS_LOG_PATH)) return [];
  return fs.readFileSync(MISSIONS_LOG_PATH, 'utf8').split('\n').filter((l) => l.trim()).map((l) => {
    try { return JSON.parse(l); } catch (_) { return null; }
  }).filter(Boolean).filter((e) => !citizenId || e.citizenId === citizenId);
}

// Rehearsal mode: dependency-injects the paper alpaca-client.js instead of
// the live one, so the whole chain gets proven against Alpaca's real paper
// API before any real dollar is at risk. Never a flag inside the live
// client itself -- orchestration-layer injection only.
function loadClient({ rehearsal } = {}) {
  return rehearsal ? require('../fleet/alpaca-client.js') : require('./survive-alpaca-live-client.js');
}

// Same fenced-JSON extraction discipline as execute-portfolio-setup.js's
// extractApprovedCandidates() -- reads the whole task file (payload +
// appended Result block), tries every ```json fence, uses the first that
// parses AND looks like a real decision block.
function extractSurviveDecision(taskId) {
  const taskPath = path.join(VAULT_ROOT, 'tasks', `${taskId}.md`);
  const text = fs.readFileSync(taskPath, 'utf8');
  const fenceRe = /```json\s*([\s\S]*?)```/g;
  let match;
  while ((match = fenceRe.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed && typeof parsed.decision === 'string') return parsed;
    } catch (_) { /* try next fence */ }
  }
  throw new Error(`No parseable decision JSON block found in ${taskPath}`);
}

function validateDecision(decision) {
  const allowed = ['enter', 'exit', 'hold', 'no-action'];
  if (!allowed.includes(decision.decision)) {
    throw new Error(`decision field must be one of ${allowed.join('/')}, got: ${decision.decision}`);
  }
  if (decision.decision === 'enter') {
    if (!decision.symbol || typeof decision.notionalUsd !== 'number' || decision.notionalUsd <= 0) {
      throw new Error(`'enter' decision requires a symbol and a positive numeric notionalUsd -- refusing to guess a malformed decision`);
    }
  }
}

async function alertPermanentShutdown(citizenId, ledger) {
  // Real gap found and fixed here: nothing previously marked a
  // permanently-shut-down citizen's registry status as 'kia' -- it would
  // silently keep showing as 'active' in listActiveCitizens()/
  // listActiveLeaders() everywhere that matters (mission authoring,
  // leader-council snapshots), even though the budget envelope already
  // correctly refuses it any further trades.
  try {
    cityRegistry.updateCitizenStatus(citizenId, 'kia', { note: `permanent shutdown: cash $${ledger.cashUsd.toFixed(2)}, no open position` });
  } catch (err) {
    console.error(`Failed to mark citizen ${citizenId} as kia in the registry: ${err.message}`);
  }
  try {
    await ntfy.sendNtfy({
      topic: SURVIVE_NTFY_TOPIC,
      title: `Citizen ${citizenId}: PERMANENT SHUTDOWN`,
      message: `Citizen ${citizenId}'s stake is exhausted (cash $${ledger.cashUsd.toFixed(2)}, no open position). This citizen will never trade again -- no automatic recovery exists in code. A new citizen requires a fresh genesis-funding event.`,
      priority: 5,
    });
  } catch (_) { /* best-effort */ }
}

async function alertReconciliationGap(citizenId, symbol) {
  try {
    await ntfy.sendNtfy({
      topic: SURVIVE_NTFY_TOPIC,
      title: `Citizen ${citizenId}: RECONCILIATION GAP -- ${symbol}`,
      message: `The real account no longer shows an open ${symbol} position for citizen ${citizenId}, but no matching closed sell order could be found to record the real exit price. The ledger still thinks this position is open (blocking all future missions for this citizen) -- this needs a human to look at the real account directly and record what actually happened.`,
      priority: 5,
    });
  } catch (_) { /* best-effort */ }
}

// Round 13b, real gap named in this file's own header since Phase A and
// never closed until now: a protective stop firing is Alpaca's own order
// engine acting server-side, completely independent of whether or when
// this code runs again. Nothing previously reconciled that -- the ledger
// would go on believing the position is still open forever (executeEntry()
// refuses a second position "one at a time"), permanently stalling a
// citizen even though the stop worked correctly and real settled cash is
// sitting in the account. Called from survive-supervisor.js's wake, FIRST,
// before anything else touches that citizen this cycle -- a stale ledger
// should never be allowed to drive a fresh decision.
async function reconcilePosition({ client, citizenId }) {
  const ledger = budgetEnvelope.computeLifetimeLedger(citizenId);
  if (!ledger.hasOpenPosition) return { reconciled: false, reason: 'no-open-position-in-ledger' };
  const openLot = ledger.openLots[0]; // one position at a time, enforced at entry

  let realPositions;
  try { realPositions = await client.getPositions(); } catch (err) {
    return { reconciled: false, reason: `could not fetch real positions: ${err.message}`, transient: true };
  }
  if (realPositions.some((p) => p.symbol === openLot.symbol)) {
    return { reconciled: false, reason: 'still open on the real account -- ledger is correct' };
  }

  // Ledger says open, the real account says closed -- find the REAL
  // closing fill so the recorded exit price is real, not guessed.
  let orders;
  try { orders = await client.getOrders('closed'); } catch (err) {
    return { reconciled: false, reason: `could not fetch closed orders to reconcile: ${err.message}`, transient: true };
  }
  const closingOrder = orders
    .filter((o) => o.symbol === openLot.symbol && o.side === 'sell' && o.status === 'filled' && Number(o.filled_qty) > 0)
    .sort((a, b) => new Date(b.filled_at) - new Date(a.filled_at))[0];
  if (!closingOrder) {
    await alertReconciliationGap(citizenId, openLot.symbol);
    return { reconciled: false, reason: 'position closed on the real account but no matching closed sell order was found -- refusing to guess a price, alerted for a human to look' };
  }

  const fillPrice = Number(closingOrder.filled_avg_price);
  const filledQty = Number(closingOrder.filled_qty);
  const grossUsd = fillPrice * filledQty;
  budgetEnvelope.recordOrderFill({ citizenId, type: 'order-fill-sell', lotId: openLot.lotId, symbol: openLot.symbol, qty: filledQty, price: fillPrice, grossUsd, feeUsd: 0, orderId: closingOrder.id, missionId: 'reconciled' });
  const pnlUsd = grossUsd - openLot.costUsd;
  appendMissionEvent({ type: 'mission-exited', citizenId, missionId: 'reconciled', symbol: openLot.symbol, lotId: openLot.lotId, orderId: closingOrder.id, pnlUsd, reconciled: true });
  appendMissionEvent({ type: 'mission-resolved', citizenId, missionId: 'reconciled', outcome: 'exited', reason: 'reconciled: position closed on the real account (likely the protective stop firing) with no matching exit previously recorded' });

  const profitSplit = budgetEnvelope.recordRealizedProfitSplit(citizenId, pnlUsd, { mechanism: 'alpaca-live-equity', sourceRef: 'reconciled' });
  const shutdown = budgetEnvelope.maybeTripPermanentShutdown(citizenId, { triggeredBy: 'reconciliation' });
  if (shutdown.justShutDown) await alertPermanentShutdown(citizenId, shutdown.ledger);

  try {
    const splitNote = profitSplit.split ? ` (kept $${profitSplit.citizenShareUsd.toFixed(2)}, reserve +$${profitSplit.reserveCut.toFixed(2)}, bank +$${profitSplit.bankCut.toFixed(2)})` : '';
    await ntfy.sendNtfy({ topic: SURVIVE_NTFY_TOPIC, title: `Citizen ${citizenId}: ${openLot.symbol} reconciled (closed outside the normal flow)`, message: `Likely the protective stop firing. P&L $${pnlUsd.toFixed(2)} @ $${fillPrice}.${splitNote}`, priority: 4 });
  } catch (_) { /* best-effort */ }

  return { reconciled: true, pnlUsd, fillPrice, filledQty, profitSplit, shutdown };
}

async function alertMissingStop(citizenId, symbol, reason) {
  try {
    await ntfy.sendNtfy({
      topic: SURVIVE_NTFY_TOPIC,
      title: `${symbol}: filled with NO protective stop (citizen ${citizenId})`,
      message: `${symbol} entered successfully but no stop could be placed: ${reason}. Real, unprotected live position -- place a stop manually.`,
      priority: 5,
    });
  } catch (_) { /* best-effort */ }
}

// Picks the protective stop level. Found live 2026-09-23 (mission010): the old code took the FIRST dollar figure in the
// model-written exit condition, which was the entry bid ($100.61) -- not below the market, so Alpaca rejected the stop
// (422 "stop price must be less than current price", checked against the live BID) and a real position sat unprotected.
// Free text is an unreliable source (a structured stopPrice field in the decision JSON would be better), so this is
// deliberately conservative: a $ amount counts only when phrased as a stop ("below $95", "stop at $95", "falls to $95");
// a percentage counts only when measured off the entry/bid ("5% below entry"); malformed numbers (negative, ranges,
// exponents) are rejected. Candidates must be below the live bid and within 30% of it; the TIGHTEST valid one wins
// (a level 0-2bp under the bid is clamped to 2bp under); otherwise the 5% fallback off the fill, clamped into bounds.
// Every returned price is re-validated after rounding: finite, > 0, 2 decimals, strictly below the market.
const MIN_STOP_GAP = 0.0002;
const MAX_STOP_DISTANCE = 0.30;
const QUOTE_TIMEOUT_MS = 5000;
const STOP_DOLLAR_RE = /(?:\b(?:below|under|beneath|falls? to|drops? to|declines? to|stop(?:[- ]loss)?(?:\s+(?:at|of))?)\s+)\$\s*(\d+(?:,\d{3})*(?:\.\d+)?)(?![\d.,]*[eE]-?\d)(?!\s*-\s*\$?\d)/gi;
const STOP_PERCENT_RE = /(?<![\d.\-eE])(\d*\.?\d+)\s*%(?![\d.])\s*(?:below|under|lower than|down from)\s+(?:the\s+)?(?:\$\s*[\d,.]+\s+)?(entry|fill|purchase|cost|buy|bid|price|open)/gi;
function resolveStopPrice(condition, { fill, bid }) {
  const text = String(condition || '');
  const market = bid > 0 ? bid : fill;
  if (!(market > 0)) return { price: null, source: null };
  const ceiling = market * (1 - MIN_STOP_GAP);
  const floor = market * (1 - MAX_STOP_DISTANCE);
  const round2 = (x) => Number(x.toFixed(2));
  const ok = (x) => Number.isFinite(x) && x > 0 && x < market;
  const cands = [];
  for (const m of text.matchAll(STOP_PERCENT_RE)) {
    const pct = Number(m[1]);
    const base = /^(bid|price)$/i.test(m[2]) && bid > 0 ? bid : fill; // "2% below bid" is measured off the live bid
    if (pct > 0 && pct <= 50 && base > 0) cands.push({ price: round2(base * (1 - pct / 100)), source: 'thesis-percentage' });
  }
  // A $ amount inside a percentage clause ("5% below $100 entry") is that clause's reference, not a stop level.
  for (const m of text.replace(STOP_PERCENT_RE, ' ').matchAll(STOP_DOLLAR_RE)) {
    const v = Number(m[1].replace(/,/g, ''));
    if (v > 0) cands.push({ price: round2(v), source: 'thesis-derived' });
  }
  const clampTop = (c) => (c.price > ceiling && c.price <= market ? { ...c, price: Math.floor(ceiling * 100) / 100 } : c);
  const valid = cands.map(clampTop).filter((c) => ok(c.price) && c.price <= ceiling && c.price >= floor).sort((a, b) => b.price - a.price);
  if (valid.length) return { price: valid[0].price, source: valid[0].source };
  if (!(fill > 0)) return { price: null, source: null };
  const fallback = Math.min(Math.max(round2(fill * (1 - FALLBACK_STOP_PCT)), round2(floor)), Math.floor(ceiling * 100) / 100);
  return ok(fallback) ? { price: fallback, source: 'fallback-percentage' } : { price: null, source: null };
}

async function freshBid(client, symbol) {
  try {
    const q = await Promise.race([client.getLatestQuote(symbol), new Promise((_, rej) => setTimeout(() => rej(new Error('quote timeout')), QUOTE_TIMEOUT_MS))]);
    return q && q.bid > 0 ? q.bid : null;
  } catch (_) { return null; }
}

async function placeProtectiveStop({ client, citizenId, missionId, lotId, symbol, filledQty, invalidationCondition, referencePrice }) {
  const bid = await freshBid(client, symbol);
  let { price: stopPrice, source: stopPriceSource } = resolveStopPrice(invalidationCondition, { fill: referencePrice, bid });
  if (!stopPrice) {
    await alertMissingStop(citizenId, symbol, 'no stop price could be derived from invalidationCondition or estimated from a reference price');
    return { stopPlaced: false, reason: 'no-stop-price' };
  }
  const baseClientOrderId = `survive-${citizenId}-${missionId}-stop`;
  try {
    const order = await client.submitOrder({ citizenId, symbol, direction: 'short', qty: filledQty, orderType: 'stop', stopPrice, timeInForce: 'gtc', intent: 'close', clientOrderId: baseClientOrderId });
    appendMissionEvent({ type: 'stop-placed', citizenId, missionId, lotId, symbol, stopPrice, stopPriceSource, orderId: order.id, timeInForce: 'gtc' });
    return { stopPlaced: true, stopPrice, stopPriceSource, timeInForce: 'gtc' };
  } catch (err) {
    // Fractional-qty GTC stop rejection -- same real Alpaca limit
    // execute-portfolio-setup.js already documented. Retry as 'day'.
    try {
      // The first attempt may have been rejected because the market moved (or the quote was stale): recompute from a
      // fresh bid and never retry a price ABOVE the first one, so the retry can only get safer.
      const bid2 = await freshBid(client, symbol);
      const again = bid2 ? resolveStopPrice(invalidationCondition, { fill: referencePrice, bid: bid2 }) : { price: null };
      if (again.price && again.price < stopPrice) { stopPrice = again.price; stopPriceSource = again.source; }
      const order = await client.submitOrder({ citizenId, symbol, direction: 'short', qty: filledQty, orderType: 'stop', stopPrice, timeInForce: 'day', intent: 'close', clientOrderId: `${baseClientOrderId}-day` });
      appendMissionEvent({ type: 'stop-placed', citizenId, missionId, lotId, symbol, stopPrice, stopPriceSource, orderId: order.id, timeInForce: 'day' });
      return { stopPlaced: true, stopPrice, stopPriceSource, timeInForce: 'day' };
    } catch (err2) {
      await alertMissingStop(citizenId, symbol, `both GTC and day stop placement failed: ${err2.message}`);
      return { stopPlaced: false, reason: err2.message };
    }
  }
}

async function executeEntry({ client, citizenId, missionId, decision }) {
  const registryCitizen = cityRegistry.getCitizen(citizenId);
  if (registryCitizen && registryCitizen.quarantined) {
    appendMissionEvent({ type: 'mission-resolved', citizenId, missionId, outcome: 'blocked', reason: `citizen is quarantined: ${registryCitizen.quarantineReason || 'no reason recorded'}` });
    return { outcome: 'blocked', reason: 'quarantined' };
  }
  const ledger = budgetEnvelope.computeLifetimeLedger(citizenId);
  if (ledger.hasOpenPosition) {
    appendMissionEvent({ type: 'mission-resolved', citizenId, missionId, outcome: 'blocked', reason: 'citizen already has an open position -- one position at a time' });
    return { outcome: 'blocked', reason: 'already-open' };
  }
  const gate = await budgetEnvelope.checkLifetimeBudgetEnvelope(citizenId, { newOrderNotionalUsd: decision.notionalUsd });
  if (!gate.ok) {
    appendMissionEvent({ type: 'mission-resolved', citizenId, missionId, outcome: 'blocked', reason: gate.reasons.join('; ') });
    return { outcome: 'blocked', reason: gate.reasons.join('; ') };
  }

  const lotId = `survive_${citizenId}_${crypto.randomUUID()}`;
  const orderType = decision.orderType === 'limit' ? 'limit' : 'market';
  const entryOrder = await client.submitOrder({
    citizenId, symbol: decision.symbol, direction: 'long', notional: decision.notionalUsd,
    orderType, limitPrice: orderType === 'limit' ? decision.limitPrice : undefined,
    timeInForce: 'day', intent: 'open', clientOrderId: `survive-${citizenId}-${missionId}-entry`,
  });
  let filled = entryOrder;
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    filled = await client.getOrder(entryOrder.id);
    if (filled.status === 'filled') break;
  }
  if (filled.status !== 'filled') {
    // Round 12, real bug found via the first-ever real execution proof
    // (against the paper API, market closed at the time): a market order
    // Alpaca itself already terminated (canceled/rejected/expired -- it
    // can't queue a plain market order for a closed session) was being
    // reported as a generic "fill-timeout", which is honestly wrong --
    // nothing timed out, Alpaca made a real, final decision on it. Only
    // call this a timeout if the order is genuinely still open/pending
    // after the retry window; a terminal non-fill status gets its real
    // name and the most likely cause named plainly.
    const terminalStatuses = new Set(['canceled', 'rejected', 'expired']);
    let finalStatus = filled.status;
    if (!terminalStatuses.has(finalStatus)) {
      try { await client.cancelOrder(entryOrder.id); } catch (_) { /* best-effort */ }
      // Alpaca's own auto-cancel of an unfillable market order (e.g. the
      // market is closed) was observed landing ~1-2s after this file's
      // original 10s poll window -- one more check, after our own cancel
      // request, catches the real terminal status instead of guessing.
      try { await new Promise((r) => setTimeout(r, 1000)); finalStatus = (await client.getOrder(entryOrder.id)).status; } catch (_) { /* keep prior status */ }
    }
    const reason = terminalStatuses.has(finalStatus)
      ? `entry order was ${finalStatus} by Alpaca (not a timeout) -- most likely cause: the market is closed and a plain market order cannot queue for a future session`
      : `entry did not fill within the retry window (status: ${finalStatus})`;
    appendMissionEvent({ type: 'mission-resolved', citizenId, missionId, outcome: 'error', reason });
    return { outcome: 'error', reason: terminalStatuses.has(finalStatus) ? finalStatus : 'fill-timeout' };
  }
  const fillPrice = Number(filled.filled_avg_price);
  const filledQty = Number(filled.filled_qty);
  const grossUsd = fillPrice * filledQty;

  budgetEnvelope.recordOrderFill({ citizenId, type: 'order-fill-buy', lotId, symbol: decision.symbol, qty: filledQty, price: fillPrice, grossUsd, feeUsd: 0, orderId: entryOrder.id, missionId });
  appendMissionEvent({ type: 'mission-entered', citizenId, missionId, symbol: decision.symbol, lotId, notionalUsd: grossUsd, orderId: entryOrder.id });
  // No-op once already set -- records which mechanism this citizen
  // actually uses the first time it acts (a founder picks freely; a
  // clone/bank-funded spawn already has this set at registration).
  try { cityRegistry.recordCitizenMechanismIfUnset(citizenId, 'alpaca-live-equity'); } catch (_) { /* non-critical, don't fail the entry over this */ }

  const stopResult = await placeProtectiveStop({ client, citizenId, missionId, lotId, symbol: decision.symbol, filledQty, invalidationCondition: decision.invalidationCondition, referencePrice: fillPrice });

  appendMissionEvent({ type: 'mission-resolved', citizenId, missionId, outcome: 'entered', reason: null });
  try {
    await ntfy.sendNtfy({ topic: SURVIVE_NTFY_TOPIC, title: `Citizen ${citizenId}: entered ${decision.symbol}`, message: `$${grossUsd.toFixed(2)} @ $${fillPrice}. ${decision.rationale || ''}`.trim(), priority: 3 });
  } catch (_) { /* best-effort */ }
  return { outcome: 'entered', lotId, fillPrice, filledQty, stopResult };
}

async function executeExit({ client, citizenId, missionId }) {
  const registryCitizen = cityRegistry.getCitizen(citizenId);
  if (registryCitizen && registryCitizen.quarantined) {
    appendMissionEvent({ type: 'mission-resolved', citizenId, missionId, outcome: 'blocked', reason: `citizen is quarantined: ${registryCitizen.quarantineReason || 'no reason recorded'}` });
    return { outcome: 'blocked', reason: 'quarantined' };
  }
  const ledger = budgetEnvelope.computeLifetimeLedger(citizenId);
  if (!ledger.hasOpenPosition) {
    appendMissionEvent({ type: 'mission-resolved', citizenId, missionId, outcome: 'blocked', reason: 'no open position to exit' });
    return { outcome: 'blocked', reason: 'no-open-position' };
  }
  const openLot = ledger.openLots[0]; // one position at a time, enforced at entry
  try {
    const orders = await client.getOrders('open');
    const relatedStop = orders.find((o) => o.symbol === openLot.symbol && (o.type === 'stop' || o.type === 'stop_limit'));
    if (relatedStop) await client.cancelOrder(relatedStop.id);
  } catch (_) { /* best-effort -- proceed to flatten regardless */ }

  const exitOrder = await client.submitOrder({ citizenId, symbol: openLot.symbol, direction: 'short', qty: openLot.qty, orderType: 'market', timeInForce: 'day', intent: 'close', clientOrderId: `survive-${citizenId}-${missionId}-exit` });
  let filled = exitOrder;
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    filled = await client.getOrder(exitOrder.id);
    if (filled.status === 'filled') break;
  }
  if (filled.status !== 'filled') {
    appendMissionEvent({ type: 'mission-resolved', citizenId, missionId, outcome: 'error', reason: `exit did not fill within the retry window (status: ${filled.status})` });
    return { outcome: 'error', reason: 'exit-fill-timeout' };
  }
  const fillPrice = Number(filled.filled_avg_price);
  const filledQty = Number(filled.filled_qty || openLot.qty);
  const grossUsd = fillPrice * filledQty;
  budgetEnvelope.recordOrderFill({ citizenId, type: 'order-fill-sell', lotId: openLot.lotId, symbol: openLot.symbol, qty: filledQty, price: fillPrice, grossUsd, feeUsd: 0, orderId: exitOrder.id, missionId });
  const pnlUsd = grossUsd - openLot.costUsd;
  appendMissionEvent({ type: 'mission-exited', citizenId, missionId, symbol: openLot.symbol, lotId: openLot.lotId, orderId: exitOrder.id, pnlUsd });
  appendMissionEvent({ type: 'mission-resolved', citizenId, missionId, outcome: 'exited', reason: null });

  // Mechanism-agnostic 65/20/15 profit split (round 4) -- a no-op if
  // pnlUsd <= 0 (nothing to share on a loss). This is mechanism #1's own
  // "I just realized profit" call site; any future mechanism's executor
  // calls the identical shared function at its own equivalent moment.
  const profitSplit = budgetEnvelope.recordRealizedProfitSplit(citizenId, pnlUsd, { mechanism: 'alpaca-live-equity', sourceRef: missionId });

  const shutdown = budgetEnvelope.maybeTripPermanentShutdown(citizenId, { triggeredBy: 'post-exit-check' });
  if (shutdown.justShutDown) await alertPermanentShutdown(citizenId, shutdown.ledger);
  try {
    const splitNote = profitSplit.split ? ` (kept $${profitSplit.citizenShareUsd.toFixed(2)}, reserve +$${profitSplit.reserveCut.toFixed(2)}, bank +$${profitSplit.bankCut.toFixed(2)})` : '';
    await ntfy.sendNtfy({ topic: SURVIVE_NTFY_TOPIC, title: `Citizen ${citizenId}: exited ${openLot.symbol}`, message: `P&L $${pnlUsd.toFixed(2)} @ $${fillPrice}.${splitNote}`, priority: 3 });
  } catch (_) { /* best-effort */ }
  return { outcome: 'exited', pnlUsd, profitSplit, shutdown };
}

// Finds the highest-numbered `survive_c<citizenId>_mission<NNN>_decision`
// task that is status:done and has no mission-resolved event yet.
function findLatestUnresolvedDecision(citizenId) {
  if (!fs.existsSync(TASKS_SURVIVE_DIR)) return null;
  const re = new RegExp(`^survive_c${citizenId}_mission(\\d+)_decision\\.md$`);
  const candidates = fs.readdirSync(TASKS_SURVIVE_DIR)
    .map((f) => { const m = re.exec(f); return m ? { file: f, missionNum: Number(m[1]) } : null; })
    .filter(Boolean)
    .sort((a, b) => b.missionNum - a.missionNum);
  const resolvedMissionIds = new Set(readMissionEvents(citizenId).filter((e) => e.type === 'mission-resolved').map((e) => e.missionId));
  for (const c of candidates) {
    const missionId = `mission${String(c.missionNum).padStart(3, '0')}`;
    if (resolvedMissionIds.has(missionId)) continue;
    const taskId = `survive/survive_c${citizenId}_${missionId}_decision`;
    const task = runTask.readTaskFile(taskId);
    if (!task || task.status !== 'done' || !task.output) continue;
    return { taskId, missionId };
  }
  return null;
}

// Called from survive-supervisor.js's per-citizen wake.
async function runForCitizen(citizenId, { rehearsal = false } = {}) {
  const found = findLatestUnresolvedDecision(citizenId);
  if (!found) return { ranAnything: false };
  const { taskId, missionId } = found;

  let decision;
  try {
    decision = extractSurviveDecision(taskId);
    validateDecision(decision);
  } catch (err) {
    appendMissionEvent({ type: 'mission-resolved', citizenId, missionId, outcome: 'error', reason: `could not parse/validate decision: ${err.message}` });
    return { ranAnything: true, outcome: 'error', reason: err.message };
  }

  if (decision.decision === 'hold' || decision.decision === 'no-action') {
    appendMissionEvent({ type: 'mission-resolved', citizenId, missionId, outcome: 'no-action', reason: decision.rationale || null });
    return { ranAnything: true, outcome: 'no-action' };
  }

  const client = loadClient({ rehearsal });
  if (decision.decision === 'enter') {
    const result = await executeEntry({ client, citizenId, missionId, decision });
    return { ranAnything: true, ...result };
  }
  if (decision.decision === 'exit') {
    const result = await executeExit({ client, citizenId, missionId });
    return { ranAnything: true, ...result };
  }
  appendMissionEvent({ type: 'mission-resolved', citizenId, missionId, outcome: 'error', reason: `unrecognized decision value: ${decision.decision}` });
  return { ranAnything: true, outcome: 'error', reason: 'unrecognized-decision' };
}

module.exports = {
  MISSIONS_LOG_PATH,
  appendMissionEvent,
  readMissionEvents,
  extractSurviveDecision,
  validateDecision,
  findLatestUnresolvedDecision,
  runForCitizen,
  executeExit,
  placeProtectiveStop,
  resolveStopPrice,
  reconcilePosition,
  loadClient,
  SURVIVE_NTFY_TOPIC,
  _setMissionsLogPathForTesting,
};

// CLI: node survive-executor.js run <citizenId> [--rehearsal]
if (require.main === module) {
  const [cmd, citizenId] = process.argv.slice(2);
  const rehearsal = process.argv.includes('--rehearsal');
  if (cmd === 'run' && citizenId) {
    runForCitizen(citizenId, { rehearsal }).then((r) => console.log(JSON.stringify(r, null, 2))).catch((err) => { console.error('FAILED:', err.message); process.exit(1); });
  } else {
    console.error('Usage: node survive-executor.js run <citizenId> [--rehearsal]');
    process.exit(1);
  }
}
