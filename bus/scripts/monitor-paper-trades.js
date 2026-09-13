// General-purpose exit monitor for research-driven paper positions logged in
// bus/paper-trades.jsonl. Two exit mechanisms exist for a position opened by
// this pipeline:
//   1. Price-level invalidation -- enforced by a real GTC stop order placed
//      directly on the Alpaca account (see place-safety-net-stops.js for how
//      that was done for the first 3 positions). This script does NOT
//      duplicate that check; Alpaca's own order engine handles it
//      server-side, independent of whether this script ever runs.
//   2. Time-based invalidation ("exit after N sessions if not triggered") --
//      NOT expressible as a stop order. This script's actual job: for each
//      open research-driven position, count trading sessions elapsed since
//      entry, and if the position has outlived its stated horizon, close it.
//
// Default mode is a DRY-RUN REPORT ONLY -- it never places an order unless
// invoked with --execute. This is deliberate: the first time this runs
// against real positions, a human should see what it WOULD do before it
// actually places closing trades. Session-count math is a simple Mon-Fri
// weekday count between the entry date and today -- it does NOT know about
// market holidays, so it can overcount by 1-2 sessions around a holiday.
// Documented limitation, not silently assumed away.
//
// Crypto positions (logged with assetClass:"crypto") use a SEPARATE
// calendar-hour clock instead of the weekday session count -- crypto trades
// 24/7 (confirmed live: /v2/clock is equities-only, no crypto session-hours
// concept exists), so "trading session" doesn't apply. See hoursElapsed()/
// parseHourDeadline() below.
//
// A THIRD category, added 2026-09-09: equity same-day exits (round-3 v3's
// own phrasing: "...exit at today's close if not stopped out.") -- this is
// NOT a session count (deadline=1 would be wrong: entered mid-session, the
// position should ride until THAT session's close, not "1 session elapsed"
// which could already be true moments after entry). Triggers when either
// the calendar date has rolled past entry day, or it's still entry day but
// the market has since closed -- checked against the real /v2/clock, not
// inferred from wall-clock time alone.
//
// Usage:
//   node monitor-paper-trades.js            (report only, no orders placed)
//   node monitor-paper-trades.js --execute   (also closes any position whose
//                                              time horizon has elapsed, and
//                                              reconciles any position the
//                                              log thinks is open but the
//                                              account shows already closed
//                                              -- e.g. a stop order fired)

const fs = require('fs');
const path = require('path');
const alpaca = require('./alpaca-client.js');
const cryptoSymbols = require('./crypto-symbols.js');
const { placeProtectiveStop, openLots, deriveExitClientOrderId } = require('./execute-portfolio-setup.js');

const LOG_PATH = path.join(__dirname, '..', 'paper-trades.jsonl');

function readLog() {
  if (!fs.existsSync(LOG_PATH)) return [];
  return fs.readFileSync(LOG_PATH, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function appendLog(record) {
  fs.appendFileSync(LOG_PATH, JSON.stringify(record) + '\n');
}

// Weekday (Mon-Fri) count strictly between entryDate and now, i.e. how many
// full trading sessions have elapsed since entry. Does not account for
// market holidays (documented limitation above).
function sessionsElapsed(entryTs) {
  const entry = new Date(entryTs);
  const now = new Date();
  let count = 0;
  const cursor = new Date(entry.getFullYear(), entry.getMonth(), entry.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  cursor.setDate(cursor.getDate() + 1); // start counting the day AFTER entry
  while (cursor <= today) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) count++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

// Pulls the session-count deadline out of invalidationCondition (preferred,
// e.g. "...or exit after 10 sessions...") or falls back to the upper bound
// of timeHorizon (e.g. "5-10 trading sessions" -> 10). EQUITY ONLY -- see
// hoursElapsed()/parseHourDeadline() below for the crypto equivalent. Kept
// as a separate function/unit rather than overloading this one with
// ambiguous units -- a session/hour mix-up would be a silent correctness bug.
function parseSessionDeadline(record) {
  const fromInvalidation = /exit after (\d+) sessions/i.exec(record.invalidationCondition || '');
  if (fromInvalidation) return Number(fromInvalidation[1]);
  const numbers = (record.timeHorizon || '').match(/\d+/g);
  if (numbers && numbers.length) return Math.max(...numbers.map(Number));
  return null;
}

// Crypto trades 24/7 (confirmed live -- /v2/clock is equities-only, every
// crypto asset stays tradable with no separate session-hours concept) --
// "trading session" doesn't map, so crypto positions use a plain calendar-hour
// clock instead of sessionsElapsed()'s weekday count.
function hoursElapsed(entryTs) {
  return (Date.now() - new Date(entryTs).getTime()) / (60 * 60 * 1000);
}

// "...or exit after 48 hours..." -- the crypto-side round-3 template phrases
// its time-exit in hours, never sessions, so this looks for that unit only.
function parseHourDeadline(record) {
  const fromInvalidation = /exit after (\d+) hours/i.exec(record.invalidationCondition || '');
  if (fromInvalidation) return Number(fromInvalidation[1]);
  const numbers = (record.timeHorizon || '').match(/\d+/g);
  if (numbers && numbers.length) return Math.max(...numbers.map(Number));
  return null;
}

// "...exit at today's close..." / "...exit at the close if not stopped
// out..." -- round-3's own phrasing for a same-day setup. Negative lookahead
// on "of" is real and load-bearing, not defensive filler: TSLA's actual
// multi-day phrasing is "...exit at the close of the fifth trading session
// after entry" -- a naive match on "exit at the close" alone false-positived
// on this and would have misclassified a real multi-day position as
// same-day (caught in testing before this shipped, not in production).
function isSameDayExit(record) {
  return /exit at (?:today's close|the close)(?!\s+of\s)/i.test(record.invalidationCondition || '');
}

// ET calendar-date string (YYYY-MM-DD) for a given Date -- so "different
// date" comparisons are correct regardless of what timezone this script
// happens to run in.
function etDateString(date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

// True once the entry's own trading session has genuinely ended: either
// today (ET) is already a later calendar date than entry day, or it's still
// entry day but the market has since closed. Never true while still inside
// the same session the position was entered in.
function sameDayTriggered(entryTs, marketClock) {
  const entryDate = etDateString(new Date(entryTs));
  const todayDate = etDateString(new Date());
  if (todayDate !== entryDate) return true;
  return !!(marketClock && marketClock.available && !marketClock.isOpen);
}

// Stable per-LOT key. New rows carry a real immutable lotId; historical rows
// don't have one at all, so they fall back to the one thing that was already
// unique per entry row (symbol + entry timestamp). Never throws on a legacy
// record -- that backward compatibility is the whole point.
function lotKey(record) {
  return record.lotId || `${record.symbol}::${record.ts}`;
}

async function getMarketClock() {
  try {
    const clock = await alpaca.apiRequest('GET', '/clock');
    return { available: true, isOpen: !!clock.is_open };
  } catch (err) {
    return { available: false, error: String((err && err.message) || err) };
  }
}

async function main() {
  const execute = process.argv.includes('--execute');
  const log = readLog();
  const entries = log.filter((r) => r.type === 'research-driven-entry');
  // Was: a flat Set of exited SYMBOLS, which is the same symbol-not-position
  // blind spot the 2026-09-11 VZ double-entry exposed -- one exit record for
  // a symbol marked EVERY entry in that symbol as closed, so a second open
  // lot would silently stop being monitored. openLots() replays the
  // entry/exit log into actual open lots instead, pairing by lotId where
  // present and falling back to oldest-open-for-that-symbol for the
  // historical rows that predate lot ids.
  const openLotKeys = new Set(openLots(log).map(lotKey));
  const marketClock = await getMarketClock();

  const livePositions = await alpaca.getPositions();
  // Alpaca's /v2/positions returns crypto symbols WITHOUT the slash
  // ("BTCUSD"), confirmed live -- a real asymmetry against orders/activities,
  // which use "BTC/USD". Every symbol this pipeline logs (paper-trades.jsonl,
  // round-3 output) is the Alpaca ORDER format (slash), per contract -- so
  // normalize crypto position keys to that same format here, or lookups by
  // logged symbol would silently miss a genuinely open crypto position and
  // misreport it as already closed.
  const livePositionMap = new Map(livePositions.map((p) => {
    const key = cryptoSymbols.isCryptoSymbol(p.symbol) ? cryptoSymbols.toAlpacaSymbol(p.symbol) : p.symbol;
    return [key, p];
  }));
  const openOrders = await alpaca.getOrders('open');

  console.log(`Mode: ${execute ? 'EXECUTE (will place closing orders for triggered positions)' : 'DRY RUN (report only, pass --execute to act)'}`);
  console.log('');

  for (const entry of entries) {
    if (!openLotKeys.has(lotKey(entry))) {
      console.log(`${entry.symbol}: lot ${lotKey(entry)} already has a matching exit record, skipping.`);
      continue;
    }

    const live = livePositionMap.get(entry.symbol);
    const isCrypto = entry.assetClass === 'crypto';
    const isSameDay = !isCrypto && isSameDayExit(entry);
    const deadline = isCrypto ? parseHourDeadline(entry) : parseSessionDeadline(entry);
    const elapsed = isCrypto ? hoursElapsed(entry.ts) : sessionsElapsed(entry.ts);
    const unit = isCrypto ? 'hours' : 'sessions';

    if (!live) {
      // Log thinks it's open, account shows it's closed -- almost certainly
      // the GTC stop order fired. Reconcile by finding the closing fill.
      console.log(`${entry.symbol}: NOT in live positions -- appears already closed (stop order likely triggered). Reconciling...`);
      if (execute) {
        const orders = await alpaca.getOrders('closed');
        const closingFill = orders.find((o) => o.symbol === entry.symbol && o.filled_avg_price && o.side === (entry.direction === 'short' ? 'buy' : 'sell'));
        appendLog({
          ts: new Date().toISOString(),
          type: 'research-driven-exit',
          // Carried from the entry so this exit closes THAT lot specifically
          // rather than "whatever this symbol is". Null for legacy entries,
          // which openLots() still pairs by symbol.
          lotId: entry.lotId || null,
          sourceTask: entry.sourceTask || null,
          symbol: entry.symbol,
          assetClass: entry.assetClass || 'equity',
          reason: 'reconciled: position no longer open on account (stop order or manual close), no matching exit record existed',
          closingOrderId: closingFill ? closingFill.id : null,
          exitFillPrice: closingFill ? Number(closingFill.filled_avg_price) : null,
        });
        console.log(`  Reconciliation exit record written.`);
      } else {
        console.log(`  (dry run -- would write a reconciliation exit record; re-run with --execute)`);
      }
      continue;
    }

    const currentPrice = Number(live.current_price);
    const unrealizedPl = Number(live.unrealized_pl);
    const elapsedDisplay = isCrypto ? elapsed.toFixed(1) : elapsed;
    const sameDayHit = isSameDay && sameDayTriggered(entry.ts, marketClock);
    const timeHit = deadline !== null && elapsed >= deadline;
    if (isSameDay) {
      console.log(`${entry.symbol}: OPEN (same-day exit). Entry day ${etDateString(new Date(entry.ts))}, today ${etDateString(new Date())}, market ${marketClock.available ? (marketClock.isOpen ? 'open' : 'closed') : 'unknown'}. Current price $${currentPrice}, unrealized P&L $${unrealizedPl.toFixed(2)}.`);
    } else {
      console.log(`${entry.symbol}: OPEN. ${unit[0].toUpperCase()}${unit.slice(1)} elapsed: ${elapsedDisplay}${deadline ? ` / ${deadline}` : ' (no deadline parsed)'}. Current price $${currentPrice}, unrealized P&L $${unrealizedPl.toFixed(2)}.`);
    }

    // SAFETY NET, added 2026-09-11 after a real live incident (multi-agent
    // self-review, risk-manager lens): confirmed VZ and MSFT open on the real
    // paper account with NO protective stop order at all and no alert ever
    // fired -- execute-portfolio-setup.js's stop placement threw on a
    // fractional-qty GTC rejection with no try/catch around it. That call
    // site is fixed now (placeProtectiveStop() retries as 'day', always
    // alerts on total failure), but a 'day' stop still expires every close,
    // so this check re-verifies EVERY still-open position has a live stop on
    // every --execute pass, not just once at entry time -- the durable fix,
    // not a one-time patch.
    const hasLiveStop = openOrders.some((o) => o.symbol === entry.symbol && (o.type === 'stop' || o.type === 'stop_limit') && o.status !== 'canceled');
    if (!hasLiveStop) {
      console.log(`  WARNING: ${entry.symbol} is open with NO live stop order -- attempting to re-arm now.`);
      if (execute) {
        const filledQty = Math.abs(Number(live.qty));
        // Prefer the real fill price from the entry record over the live
        // current price for the fallback-percentage-stop case (matches
        // execute-portfolio-setup.js's own call site) -- falls back to the
        // live price only if the entry record predates actualFillPrice
        // being logged.
        const referencePrice = entry.actualFillPrice || Number(live.avg_entry_price) || Number(live.current_price) || null;
        const result = await placeProtectiveStop({ symbol: entry.symbol, direction: entry.direction, filledQty, invalidationCondition: entry.invalidationCondition, isCrypto, sourceTask: entry.sourceTask, lotId: entry.lotId || null, referencePrice });
        console.log(`  Re-arm result: stopPlaced=${result.stopPlaced}${result.timeInForce ? `, timeInForce=${result.timeInForce}` : ''}${result.reason ? `, reason=${result.reason}` : ''}`);
      } else {
        console.log(`  (dry run -- would attempt to re-arm a protective stop; re-run with --execute)`);
      }
    }

    if (timeHit || sameDayHit) {
      console.log(`  ${sameDayHit ? 'SAME-DAY EXIT TRIGGERED (entry session has ended)' : `TIME-BASED EXIT TRIGGERED (${elapsedDisplay} >= ${deadline} ${unit})`}.`);
      if (execute) {
        // Cancel the associated GTC stop, if any, before flattening manually
        // -- otherwise a stale stop order is left pointing at a position
        // that no longer exists.
        // Crypto stops are placed as stop_limit (plain "stop" is rejected by
        // Alpaca for crypto -- see execute-portfolio-setup.js), so match both.
        const relatedStop = openOrders.find((o) => o.symbol === entry.symbol && (o.type === 'stop' || o.type === 'stop_limit'));
        if (relatedStop) {
          console.log(`  Cancelling associated stop order ${relatedStop.id}...`);
          await alpaca.cancelOrder(relatedStop.id);
        }
        // entry.direction is always "long" for a crypto row (spot/long-only,
        // enforced upstream in alpaca-client.js's submitOrder), so this is
        // always the sell-to-close branch for crypto -- the short-closing
        // branch below is intentionally unreachable for crypto rows, not
        // dead code by accident.
        const closingDirection = entry.direction === 'short' ? 'long' : 'short';
        const qty = Math.abs(Number(live.qty));
        // Crypto rejects "day" (equity-only value, confirmed live: 422
        // "invalid crypto time_in_force") -- crypto closes use "gtc".
        const closeTimeInForce = isCrypto ? 'gtc' : 'day';
        console.log(`  Submitting market ${closingDirection} order to flatten ${qty} unit(s)...`);
        const order = await alpaca.submitOrder({ symbol: entry.symbol, direction: closingDirection, qty, orderType: 'market', timeInForce: closeTimeInForce, intent: 'close', clientOrderId: deriveExitClientOrderId(lotKey(entry)) });
        let filled = order;
        for (let i = 0; i < 10; i++) {
          await new Promise((r) => setTimeout(r, 1000));
          filled = await alpaca.getOrder(order.id);
          if (filled.status === 'filled') break;
        }
        appendLog({
          ts: new Date().toISOString(),
          type: 'research-driven-exit',
          lotId: entry.lotId || null,
          sourceTask: entry.sourceTask || null,
          symbol: entry.symbol,
          assetClass: entry.assetClass || 'equity',
          reason: sameDayHit
            ? `same-day exit: entry session (${etDateString(new Date(entry.ts))}) has ended`
            : `time-based exit: ${elapsedDisplay} ${unit} elapsed, deadline was ${deadline}`,
          closingOrderId: order.id,
          exitFillPrice: filled.filled_avg_price ? Number(filled.filled_avg_price) : null,
        });
        console.log(`  Closed. Exit fill: $${filled.filled_avg_price}`);
      } else {
        console.log(`  (dry run -- would cancel any related stop order, close the position, and log the exit; re-run with --execute)`);
      }
    }
  }
}

main().catch((err) => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
