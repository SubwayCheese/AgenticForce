// Canonical executor for a portfolio-approval round-3 task's approvedCandidates
// array (the "higher agent" design -- see fleet_pilot_20260908_synthesis_r3_portfolio_v2
// and ARCHITECTURE.md's paper-trading section for the full pipeline: 50-stock
// scan -> top 15-20 shortlist -> round1 (thesis) -> round2 (challenge) ->
// round3 (portfolio approval, multiple independent candidates, not a single
// winner)).
//
// Supersedes the two-step process used for the first real run
// (scratch-execute-portfolio-r3v2.js entry, then a SEPARATE
// place-safety-net-stops.js run ~90 minutes later for the stop). That gap
// left 3 positions open with zero downside protection long enough that the
// user had to manually close them at a loss. This script closes that gap
// structurally: for EACH approved candidate, the entry order and its
// protective GTC stop order are placed back-to-back in the same run, with no
// human-timed step in between.
//
// It does NOT handle the time-based ("exit after N sessions") half of the
// exit rule -- that's monitor-paper-trades.js's job, run separately (see
// that file's header for why a stop order can't express a time-based exit).
//
// 2026-09-11, post multi-agent self-review -- three pre-trade gates now run
// before any order is submitted, in this order (see each section below for
// the real incident it closes):
//   1. DATA INTEGRITY -- refuse a candidate whose own text says its levels
//      are inherited/not-derived/stale (the real VZ trigger that Codex
//      itself flagged as "not analytically derived" and still got filled).
//   2. POSITION IDENTITY -- refuse a second position in a symbol already
//      held, checked against BOTH this ledger and the live Alpaca account
//      (the real VZ double-entry: two fills ~2h apart, two different
//      round-3 cycles, because the old idempotency key was (sourceTask,
//      symbol) and nothing ever asked "do we already hold this").
//   3. BROKER IDEMPOTENCY -- a deterministic client_order_id on the entry so
//      a duplicate dispatch of the SAME candidate can't double-fill even if
//      both gates above were somehow bypassed.
// Every entry also mints an immutable lot id that travels with the position
// through its stop and its exit, and records a real modeledEntry again
// (see deriveModeledEntry()) so performance-scorecard.js can measure
// slippage.
//
// Usage: node execute-portfolio-setup.js <taskId>
//   Reads tasks/<taskId>.md, extracts the ```json ... ``` block containing
//   approvedCandidates, and for each candidate: places the entry (market),
//   confirms the fill, parses the stop price out of invalidationCondition,
//   and places the protective stop (GTC) immediately after.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const alpaca = require('./alpaca-client.js');
const cryptoSymbols = require('./crypto-symbols.js');
const fleetStatus = require('./fleet-status.js');
const cryptoStatus = require('./crypto-status.js');
const runTask = require('./run-task.js');
const ntfy = require('./ntfy.js');

const VAULT_ROOT = path.join(__dirname, '..', '..');
const LOG_PATH = path.join(__dirname, '..', 'paper-trades.jsonl');

// Sizing used ONLY on the --auto path (pilot-supervisor.js's unattended
// runs). Originally $15/leg (2026-09-10, "micro trades" -- many small,
// frequent, low-stakes learning trades, not a few large convictions).
// Raised to $1,000/leg on 2026-09-13 per direct user instruction: this is
// paper money on a ~$100k fake balance, and $15/leg was small enough that
// transaction-cost drag and entry slippage often dominated a trade's
// entire P&L (confirmed real in performance-scorecard.js's output --
// mean entry slippage exceeded the mean P&L on the measurable trades).
// $1,000/leg is still well under 1% of account equity per leg but gives
// a real signal-to-noise improvement. See portfolio-risk-envelope.js's
// MAX_TOTAL_NOTIONAL_AT_RISK_USD/MAX_DAILY_REALIZED_LOSS_USD -- scaled
// proportionally the same day, don't change one without the other. The
// function name/variable name below still says "micro" -- kept as-is
// rather than a repo-wide rename for a constant-value change; the
// function's actual behavior (single flat dollar target across every
// asset class/price range) is unchanged, only the number is different.
// The manual <taskId> path below is completely unaffected and keeps its
// existing fail-loud/10-share-default behavior.
const AUTO_MICRO_NOTIONAL_PER_LEG = 1000; // dollars/leg

function appendLog(record) {
  fs.appendFileSync(LOG_PATH, JSON.stringify(record) + '\n');
}

function readTradeLog() {
  if (!fs.existsSync(LOG_PATH)) return [];
  return fs.readFileSync(LOG_PATH, 'utf8').split('\n').filter((l) => l.trim()).map((l) => {
    try { return JSON.parse(l); } catch (_) { return null; }
  }).filter(Boolean);
}

// Real gap fixed here regardless of autonomy: nothing previously checked
// whether a candidate had already been executed before placing a new
// order, so re-running this script twice against the same round-3 task
// would double-enter positions. Applies to BOTH the manual and --auto
// paths.
//
// NOTE (2026-09-11, multi-agent self-review): this check is keyed on
// (sourceTask, symbol) and that is EXACTLY the root cause of the real VZ
// double-entry incident -- paper-trades.jsonl lines 16/17 are two VZ longs
// ~2h apart from two DIFFERENT round-3 cycles
// (fleet_pilot_20260910_synthesis_r3_portfolio_v2 and
// fleet_pilot_20260911_synthesis_r3_portfolio), so this returned false both
// times and both orders filled. It is kept as-is (same-candidate replay
// guard, still useful and still cheap) but it is NO LONGER the only guard:
// assertNoExistingPosition() below is the position-identity check that
// actually closes that hole, and it is keyed on the SYMBOL/position, not on
// which task happened to propose it.
function alreadyExecuted(sourceTask, symbol) {
  const entries = readTradeLog();
  return entries.some((r) => r.type === 'research-driven-entry' && r.sourceTask === sourceTask && r.symbol === symbol);
}

// ---------------------------------------------------------------------------
// POSITION / LOT IDENTITY (roadmap item 1)
// ---------------------------------------------------------------------------
// The review's root-cause finding: this pipeline tracked by SYMBOL, never by
// individual position. Every entry now mints an immutable lot id that travels
// with that position across every record it will ever produce (entry ->
// stop-order-placed -> research-driven-exit -> trading-journal row), so a
// position has an identity independent of its symbol and of whichever task
// proposed it.
//
// Backward compatibility is mandatory here: every historical record predates
// lot ids and will have `lotId: undefined`. Every reader below treats a
// missing lot id as "unknown, fall back to symbol matching" and must never
// crash on one.
function newLotId() {
  return crypto.randomUUID();
}

// Alpaca's /v2/positions returns crypto WITHOUT the slash ("BTCUSD") while
// everything this pipeline logs uses the order format ("BTC/USD") -- the same
// real asymmetry monitor-paper-trades.js already normalizes for. One place,
// so a duplicate check can't silently miss an open crypto position.
function positionKey(symbol) {
  if (!symbol) return '';
  try {
    if (cryptoSymbols.isCryptoSymbol(symbol)) return cryptoSymbols.toAlpacaSymbol(symbol);
  } catch (_) { /* not crypto, fall through */ }
  return String(symbol).toUpperCase();
}

// Replays the append-only trade log into the set of lots that are still open.
// Entry rows open a lot; exit rows close one. Matching rule, in order:
//   1. exit.lotId === entry.lotId  (the new, unambiguous path)
//   2. legacy fallback: oldest still-open lot for the same symbol -- which is
//      exactly what trading-journal.js's existing symbol-based pairing does,
//      so historical data keeps pairing the way it always has.
function openLots(records) {
  const rows = (records || readTradeLog())
    .filter((r) => r && (r.type === 'research-driven-entry' || r.type === 'research-driven-exit'))
    .slice()
    .sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
  const open = [];
  for (const r of rows) {
    if (r.type === 'research-driven-entry') {
      open.push(r);
      continue;
    }
    const key = positionKey(r.symbol);
    // An exit that NAMES a lot may only close that lot. Falling back to
    // symbol matching when the named lot isn't open would close somebody
    // else's position on paper -- with two concurrent VZ lots that is
    // precisely the wrong one 50% of the time. Symbol matching is reserved
    // for exits that carry no lot id at all, i.e. the historical rows.
    const idx = r.lotId
      ? open.findIndex((e) => e.lotId === r.lotId)
      : open.findIndex((e) => positionKey(e.symbol) === key);
    if (idx !== -1) open.splice(idx, 1);
  }
  return open;
}

function findOpenLotForSymbol(symbol, records) {
  const key = positionKey(symbol);
  return openLots(records).find((e) => positionKey(e.symbol) === key) || null;
}

// The actual pre-trade gate the risk-manager asked for: never open a second
// position in a symbol this account already holds. Two independent sources,
// because either one alone has a real failure mode:
//   - the LEDGER catches a duplicate even when the broker call fails, and
//     catches a position opened seconds ago whose fill hasn't settled;
//   - the BROKER is the source of truth for anything this log doesn't know
//     about (a manual fill, a partially-reconciled state).
// Fails CLOSED: if the positions lookup itself errors we do NOT enter, we
// skip and retry on the next wake. A blind entry is the expensive mistake
// here; a delayed entry is not.
//
// A deliberate scale-in/pyramiding mechanism is explicitly OUT OF SCOPE --
// this blocks duplicates outright. If scale-in is ever wanted it needs its
// own opt-in flag plus aggregate-exposure sizing, not a relaxation here.
async function assertNoExistingPosition(symbol) {
  const ledgerLot = findOpenLotForSymbol(symbol);
  if (ledgerLot) {
    return {
      blocked: true,
      source: 'ledger',
      detail: `paper-trades.jsonl already has an OPEN ${ledgerLot.symbol} lot (lotId ${ledgerLot.lotId || 'legacy/none'}, entered ${ledgerLot.ts} from ${ledgerLot.sourceTask}) with no matching exit record`,
    };
  }
  let positions;
  try {
    positions = await alpaca.getPositions();
  } catch (err) {
    return { blocked: true, source: 'lookup-failed', detail: `could not verify current positions before entering (${err.message}) -- failing closed rather than entering blind`, transient: true };
  }
  const key = positionKey(symbol);
  const held = (positions || []).find((p) => positionKey(p.symbol) === key);
  if (held) {
    return {
      blocked: true,
      source: 'broker',
      detail: `Alpaca already reports an open ${held.symbol} position (qty ${held.qty}, avg entry $${held.avg_entry_price}) that this log does not show as open`,
    };
  }
  return { blocked: false };
}

// ---------------------------------------------------------------------------
// BROKER-LEVEL IDEMPOTENCY (roadmap item 2)
// ---------------------------------------------------------------------------
// Second layer, underneath assertNoExistingPosition(). The entry id is
// DETERMINISTIC in (sourceTask, symbol): a genuine duplicate dispatch of the
// same candidate -- two supervisor wakes racing, a retry after an ambiguous
// timeout -- computes the same client_order_id, and Alpaca refuses the second
// POST instead of filling it. It deliberately does NOT include the lot id,
// which is freshly minted per call and would make every dispatch look new.
//
// Note what this layer can and cannot do, so it isn't over-trusted: it stops
// the SAME candidate being dispatched twice. It cannot stop two different
// round-3 cycles proposing the same symbol (the real VZ case) -- those are
// different sourceTasks and therefore legitimately different order ids. That
// case is assertNoExistingPosition()'s job. The two layers are complementary,
// neither is a substitute for the other.
function deriveEntryClientOrderId(sourceTask, symbol) {
  return `av-entry-${sourceTask || 'unknown'}-${positionKey(symbol)}`;
}

// Stops are different on purpose: monitor-paper-trades.js legitimately
// RE-ARMS a stop on a position it already stopped once (a fractional-qty
// stop can only be placed 'day', which expires every close). Pinning a stop
// to a fixed id would make that re-arm fail at the broker and leave a real
// position unprotected -- the exact incident this whole file exists to
// prevent. So the stop id is idempotent only within a single minute and a
// single time-in-force attempt: enough to stop a tight retry loop from
// double-stopping a lot, never enough to block tomorrow's re-arm.
function deriveStopClientOrderId(lotId, symbol, timeInForce, when = new Date()) {
  const minuteStamp = when.toISOString().slice(0, 16).replace(/[-:T]/g, '');
  return `av-stop-${lotId || positionKey(symbol)}-${minuteStamp}-${timeInForce}`;
}

// Closing a lot: deterministic per lot per DAY. Deterministic because a
// duplicate close is genuinely dangerous (closing an already-flat long a
// second time opens a short); per-day rather than forever because a close
// that never filled must still be retryable on a later run instead of being
// permanently refused by the broker.
function deriveExitClientOrderId(lotKeyOrId, when = new Date()) {
  const dayStamp = when.toISOString().slice(0, 10).replace(/-/g, '');
  return `av-exit-${lotKeyOrId}-${dayStamp}`;
}

// ---------------------------------------------------------------------------
// DATA-INTEGRITY GATE (roadmap item 3)
// ---------------------------------------------------------------------------
// Real incident this closes: tasks/fleet_pilot_20260911_synthesis_r3_portfolio.md
// approved VZ as a conditional candidate whose own bullCase says "A defined
// INHERITED price trigger and invalidation permit a limited tactical
// confirmation setup", with a riskWarning stating outright that "VZ's
// trigger/invalidation levels are inherited and not analytically derived in
// this ledger" -- and that trigger still reached a real order. The synthesis
// agent flagged its own output as non-derived and nothing downstream read
// the flag.
//
// This is an honest BEST-EFFORT TEXT DEFENSE, not a structural fix. It scans
// the candidate's own prose for the language a synthesis agent actually uses
// when it is telling us the number isn't underwritten. It will miss novel
// phrasings and it can false-positive on a bearCase that merely discusses
// staleness -- both are acceptable in this direction (refusing a trade is
// cheap, taking an unfounded one is not).
//
// FOLLOW-UP, genuinely out of scope here and left for whoever owns
// generate-pilot-tasks.js next: the clean fix is a STRUCTURED field in the
// round-3 output contract -- e.g. require every candidate to emit
// `"levelsDerivedThisCycle": true|false` plus `"derivationSource"` -- and
// have this gate read that boolean instead of grepping prose. The prompt
// template owns that contract, this file does not. Until that exists, this
// pattern list is the only thing standing between a self-flagged
// non-derived level and a real fill.
const NON_DERIVED_RED_FLAGS = [
  { pattern: /\binherited\b/i, label: 'level described as inherited from a previous cycle rather than derived in this one' },
  { pattern: /not\s+analytically\s+derived/i, label: 'explicitly stated as not analytically derived' },
  { pattern: /not\s+derived\s+(?:from|in)\b/i, label: 'explicitly stated as not derived' },
  { pattern: /lacks?\s+(?:supplied\s+)?derivation/i, label: 'level stated to lack any derivation' },
  { pattern: /\bstale\b/i, label: 'underlying data described as stale' },
  { pattern: /\bcarried\s+over\s+from\b/i, label: 'level carried over from an earlier run rather than recomputed' },
];

// Walks every string anywhere in the candidate payload -- bullCase, bearCase,
// oneLineRationale, and conditionalSetup's entryCondition/invalidationCondition
// are the fields that matter today, but a recursive walk means a new prose
// field added to the round-3 contract later is covered automatically instead
// of silently bypassing the gate.
function collectCandidateText(value, pathParts = [], out = []) {
  if (typeof value === 'string') {
    out.push({ field: pathParts.join('.') || '(root)', text: value });
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => collectCandidateText(v, pathParts.concat(String(i)), out));
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) collectCandidateText(v, pathParts.concat(k), out);
  }
  return out;
}

function scanCandidateForRedFlags(candidate) {
  const findings = [];
  for (const { field, text } of collectCandidateText(candidate)) {
    for (const flag of NON_DERIVED_RED_FLAGS) {
      const m = flag.pattern.exec(text);
      if (!m) continue;
      const start = Math.max(0, m.index - 40);
      findings.push({ field, label: flag.label, matched: m[0], excerpt: text.slice(start, m.index + m[0].length + 60).trim() });
    }
  }
  return findings;
}

async function alertDataIntegrityBlock(symbol, sourceTask, findings) {
  const summary = findings.map((f) => `${f.field}: "${f.matched}" (${f.label})`).join('; ');
  console.log(`  BLOCKED (data integrity): ${symbol} from ${sourceTask} -- the candidate's own text flags its levels as not derived this cycle. ${summary}`);
  for (const f of findings) console.log(`    ${f.field}: ...${f.excerpt}...`);
  try {
    await ntfy.sendNtfy({
      title: `${symbol}: entry BLOCKED, non-derived levels`,
      message: `${symbol} (from ${sourceTask}) was NOT entered: the candidate's own text flags its trigger/invalidation levels as not analytically derived this cycle. ${summary}. This is the VZ 2026-09-11 failure mode -- review the round-3 output before overriding.`,
      priority: 4,
    });
  } catch (_) { /* best-effort -- the console output above is the fallback signal */ }
}

// ---------------------------------------------------------------------------
// MODELED ENTRY (roadmap item 4's slippage input)
// ---------------------------------------------------------------------------
// Regression this fixes: the superseded scratch-execute-portfolio-r3v2.js
// recorded a REAL modeledEntry per setup (TSLA 367.77, GOOGL 339.14, CSCO
// 109.05 -- still visible in paper-trades.jsonl lines 2-4), and this
// canonical script replaced it with a hardcoded `modeledEntry: null`. Every
// entry since is unmeasurable for slippage, which is exactly the number the
// new performance-scorecard.js needs. Threading a real value through again.
//
// Precedence, most to least structured:
//   1. an explicit numeric field on the candidate or its conditionalSetup
//      (triggerPrice is the real one in today's round-3 contract -- for a
//      conditional candidate the trigger IS the intended entry level);
//   2. the first dollar figure in entryCondition -- parsed with exactly the
//      same pattern parseStopPrice() already uses on invalidationCondition,
//      deliberately reusing that proven approach rather than inventing a
//      second one;
//   3. null, honestly, when the candidate says "enter at market" and no
//      intended price exists to compare against.
function parseFirstDollarAmount(text) {
  const m = /\$([\d,]+\.?\d*)/.exec(text || '');
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

function deriveModeledEntry(candidate) {
  const setup = (candidate && candidate.conditionalSetup) || {};
  const numericFields = [
    ['candidate.modeledEntry', candidate && candidate.modeledEntry],
    ['conditionalSetup.modeledEntry', setup.modeledEntry],
    ['candidate.intendedEntry', candidate && candidate.intendedEntry],
    ['conditionalSetup.entryPrice', setup.entryPrice],
    ['candidate.triggerPrice', candidate && candidate.triggerPrice],
    ['conditionalSetup.triggerPrice', setup.triggerPrice],
  ];
  for (const [source, value] of numericFields) {
    if (typeof value === 'number' && Number.isFinite(value)) return { modeledEntry: value, modeledEntrySource: source };
  }
  const textFields = [
    ['conditionalSetup.entryCondition', setup.entryCondition],
    ['candidate.entryCondition', candidate && candidate.entryCondition],
    ['candidate.triggerPrice', typeof (candidate && candidate.triggerPrice) === 'string' ? candidate.triggerPrice : null],
  ];
  for (const [source, text] of textFields) {
    const parsed = parseFirstDollarAmount(text);
    if (parsed !== null) return { modeledEntry: parsed, modeledEntrySource: `${source} (parsed)` };
  }
  return { modeledEntry: null, modeledEntrySource: null };
}

// Finds the latest status:done round-3 task for a pilot that hasn't been
// executed yet (no research-driven-entry log rows referencing it at all).
// Reuses the same discovery functions the dashboards already trust.
function findLatestUnexecutedRound3(pilot) {
  const status = pilot === 'crypto' ? cryptoStatus : fleetStatus;
  const findDate = pilot === 'crypto' ? status.findLatestCryptoPipelineDate : status.findLatestPipelineDate;
  const date = findDate();
  if (!date) return null;
  const versions = status.discoverRound3Versions(date);
  if (!versions.length) return null;
  const latest = versions[versions.length - 1];
  const task = runTask.readTaskFile(latest.taskId);
  if (!task || task.status !== 'done' || !task.output) return null;

  const entries = readTradeLog();
  const alreadyRun = entries.some((r) => r.sourceTask === latest.taskId);
  if (alreadyRun) return null; // today's cycle already executed -- --auto is safe to call every supervisor wake

  return latest.taskId;
}

function extractApprovedCandidates(taskId) {
  const taskPath = path.join(VAULT_ROOT, 'tasks', `${taskId}.md`);
  const text = fs.readFileSync(taskPath, 'utf8');
  // Find every ```json ... ``` fenced block, use the first that parses and
  // contains an approvedCandidates array.
  const fenceRe = /```json\s*([\s\S]*?)```/g;
  let match;
  while ((match = fenceRe.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      if (Array.isArray(parsed.approvedCandidates)) return parsed.approvedCandidates;
    } catch (_) { /* try next fence */ }
  }
  throw new Error(`No parseable approvedCandidates JSON block found in ${taskPath}`);
}

// Pulls the first dollar figure out of an invalidationCondition string, e.g.
// "Invalidate if TSLA closes above $390.00, or exit..." -> 390.00
function parseStopPrice(invalidationCondition) {
  return parseFirstDollarAmount(invalidationCondition);
}

// Genuinely urgent, unlike the market-closed skip below (which self-heals
// on the next retry, nothing has been risked yet) -- this means a REAL
// position now exists on the account with no protective stop. Never let
// this fail silently into just a console.log.
async function alertUnprotectedPosition(symbol, sourceTask, reason) {
  try {
    await ntfy.sendNtfy({
      title: `${symbol}: filled with NO protective stop`,
      message: `${symbol} (from ${sourceTask}) entered successfully but no stop could be placed: ${reason}. Real, unprotected position on the paper account -- place a stop manually.`,
      priority: 5,
    });
  } catch (_) { /* best-effort -- the console.log above is the fallback signal */ }
}

// sizing: { qty } for equities, { notional } for crypto (dollar amount --
// crypto trades in fractional/continuous sizes, a share-count is the wrong
// unit; Alpaca confirmed live: BTC min order size ~0.0000126, ~$1).
// Real incident, 2026-09-10/11: a conditional trigger fired and confirmed
// STILL VALID while the equity market was closed (a "day" market order
// submitted after-hours sits "accepted", not "filled" -- Alpaca queues it
// for next open). executeOne() used to wait 10s, give up, and proceed
// anyway with a null fill price and NO STOP PLACED -- the exact
// entry-without-protection gap this whole script exists to prevent,
// except now the position wouldn't even exist yet to notice was
// unprotected. Cancelled that real pending order manually; this return
// value is the structural fix -- callers must check `.skipped` and NOT
// mark a trigger/candidate as resolved when it's true, so the next
// supervisor wake (once the market is actually open) retries for real.
async function executeOne(candidate, sourceTask, sizing) {
  const setup = candidate.conditionalSetup;
  const symbol = setup.symbol;
  const direction = setup.direction; // "long" | "short"
  const isCrypto = cryptoSymbols.isCryptoSymbol(symbol);
  const sizeLabel = sizing.qty != null ? `${sizing.qty}sh` : `$${sizing.notional} notional`;
  console.log(`\n=== ${symbol} (${direction}) ===`);

  if (alreadyExecuted(sourceTask, symbol)) {
    console.log(`  SKIPPED: ${sourceTask}::${symbol} already has a research-driven-entry in paper-trades.jsonl -- not re-entering.`);
    return { skipped: true, permanent: true, reason: 'already-executed' };
  }

  // ITEM 3 -- data-integrity gate. Runs BEFORE any position/market check so a
  // candidate that should never trade doesn't even consume a positions call.
  const redFlags = scanCandidateForRedFlags(candidate);
  if (redFlags.length) {
    await alertDataIntegrityBlock(symbol, sourceTask, redFlags);
    appendLog({
      ts: new Date().toISOString(),
      type: 'entry-blocked',
      blockReason: 'data-integrity',
      sourceTask,
      symbol,
      assetClass: isCrypto ? 'crypto' : 'equity',
      direction,
      findings: redFlags,
      note: "Candidate's own text flags its levels as inherited/not-derived/stale -- refused rather than executed. See NON_DERIVED_RED_FLAGS in execute-portfolio-setup.js.",
    });
    return { skipped: true, permanent: true, reason: 'data-integrity-block', findings: redFlags };
  }

  // ITEM 1 -- position identity. The check that would have refused the second
  // real VZ entry on 2026-09-11.
  const dup = await assertNoExistingPosition(symbol);
  if (dup.blocked) {
    console.log(`  SKIPPED: not entering a second ${symbol} position -- ${dup.detail}. (source: ${dup.source}; scale-in is deliberately not supported.)`);
    if (!dup.transient) {
      appendLog({
        ts: new Date().toISOString(),
        type: 'entry-blocked',
        blockReason: 'duplicate-position',
        detectedBy: dup.source,
        sourceTask,
        symbol,
        assetClass: isCrypto ? 'crypto' : 'equity',
        direction,
        detail: dup.detail,
        note: 'Position-identity check refused a duplicate entry. Closes the 2026-09-11 VZ double-entry failure mode (two entries, two different sourceTasks, ~2h apart).',
      });
    }
    return { skipped: true, permanent: !dup.transient, reason: dup.source === 'lookup-failed' ? 'position-lookup-failed' : 'duplicate-position', detail: dup.detail };
  }

  if (!isCrypto) {
    const clock = await alpaca.apiRequest('GET', '/clock');
    if (!clock.is_open) {
      console.log(`  SKIPPED: equity market is closed (next open ${clock.next_open}) -- a "day" market order would sit pending unfilled and unprotected until then. Not submitting now; retry once the market is open.`);
      return { skipped: true, reason: 'market-closed', nextOpen: clock.next_open };
    }
  }

  // Minted here, before the order goes out, so the lot has an identity even
  // if everything after this point fails -- the id is what ties this entry,
  // its stop, and its eventual exit together across three separate records.
  const lotId = newLotId();
  const { modeledEntry, modeledEntrySource } = deriveModeledEntry(candidate);
  const entryClientOrderId = deriveEntryClientOrderId(sourceTask, symbol);

  console.log(`Submitting entry: ${direction} ${sizeLabel} market... (lotId ${lotId}, client_order_id ${entryClientOrderId})`);
  if (modeledEntry !== null) console.log(`  Modeled/intended entry: $${modeledEntry} (from ${modeledEntrySource})`);
  // Crypto rejects "day" (equity-only value, confirmed live: 422 "invalid
  // crypto time_in_force") -- crypto entries use "gtc" instead.
  const entryTimeInForce = isCrypto ? 'gtc' : 'day';
  const entryOrder = await alpaca.submitOrder({ symbol, direction, ...sizing, orderType: 'market', timeInForce: entryTimeInForce, clientOrderId: entryClientOrderId });
  let filledEntry = entryOrder;
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    filledEntry = await alpaca.getOrder(entryOrder.id);
    if (filledEntry.status === 'filled') break;
  }
  if (filledEntry.status !== 'filled') {
    // Never leave an accepted-but-unfilled order sitting unprotected --
    // cancel it outright and report failure rather than proceeding with a
    // null fill price and no stop, exactly the gap this comment block
    // documents above.
    console.log(`  WARNING: entry did not fill within the retry window (status: ${filledEntry.status}) -- cancelling rather than leaving an unprotected pending order.`);
    try { await alpaca.cancelOrder(entryOrder.id); } catch (_) { /* best-effort */ }
    return { skipped: true, reason: 'fill-timeout' };
  }
  const actualFillPrice = filledEntry.filled_avg_price ? Number(filledEntry.filled_avg_price) : null;
  let filledQty = filledEntry.filled_qty ? Number(filledEntry.filled_qty) : (sizing.qty || null);
  console.log(`  Entry filled @ $${actualFillPrice}`);

  // Crypto fees are deducted IN-KIND from the asset itself, confirmed live:
  // an order's own filled_qty can be a hair larger than what's actually
  // available in the resulting position (e.g. 0.000124636 filled vs
  // 0.000124324 available). Sizing the protective stop off filled_qty can
  // therefore request more than the account holds and get rejected (403
  // "insufficient balance"). Re-fetch the live position and use ITS qty for
  // crypto, which reflects the fee deduction; equities have no such
  // in-kind-fee mechanic so filled_qty stays authoritative there.
  if (isCrypto) {
    const positions = await alpaca.getPositions();
    const live = positions.find((p) => cryptoSymbols.isCryptoSymbol(p.symbol) && cryptoSymbols.toAlpacaSymbol(p.symbol) === symbol);
    if (live) filledQty = Number(live.qty_available || live.qty);
  }

  appendLog({
    ts: new Date().toISOString(),
    type: 'research-driven-entry',
    lotId,
    sourceTask,
    symbol,
    assetClass: isCrypto ? 'crypto' : 'equity',
    direction,
    qty: filledQty,
    notional: sizing.notional || null,
    orderId: entryOrder.id,
    clientOrderId: entryClientOrderId,
    orderStatus: filledEntry.status,
    modeledEntry,
    modeledEntrySource,
    actualFillPrice,
    invalidationCondition: setup.invalidationCondition,
    timeHorizon: setup.timeHorizon,
    note: 'Placed via execute-portfolio-setup.js -- stop order placed immediately after, same run, no manual gap.',
  });

  const result = await placeProtectiveStop({ symbol, direction, filledQty, invalidationCondition: setup.invalidationCondition, isCrypto, sourceTask, lotId, referencePrice: actualFillPrice });
  return { skipped: false, executed: true, lotId, modeledEntry, ...result, actualFillPrice };
}

// Factored out 2026-09-11 -- REAL BUG FOUND LIVE (multi-agent self-review,
// risk-manager lens): the stop-placement submitOrder() call below had NO
// try/catch. Alpaca rejects GTC stop/stop_limit orders on a FRACTIONAL
// equity qty (confirmed live: 422 "stop/stop_limit fractional GTC orders
// are not enabled") -- every micro-sized equity long (qty always fractional
// at $15 notional, e.g. VZ 0.593044035) hit this and threw, which propagated
// straight past alertUnprotectedPosition() (only wired to the two explicit
// early-return checks above, not to this call) and out to the caller's own
// catch, which logs to console only -- no ntfy alert. Confirmed live: VZ (x2
// fills) and MSFT were open on the real paper account with NO stop order at
// all and no alert had ever fired. Fixed two ways: (1) wrapped in try/catch
// so ANY failure reaches alertUnprotectedPosition() now, not just the two
// pre-checks; (2) added a 'day' time-in-force retry specifically for the
// fractional-GTC case, since Alpaca does accept fractional stops under 'day'
// -- a real stop is better than none, even though a day order needs
// re-arming each session (monitor-paper-trades.js's new safety-net check,
// see below, is what actually re-arms it going forward, so this isn't a
// one-time patch that quietly stops working).
// `lotId` is optional and may legitimately be absent: monitor-paper-trades.js
// re-arms stops on positions entered before lot ids existed. Absent just means
// the stop record is symbol-keyed the way it always was, never an error.
// Real incident, 2026-09-12: ARB/USD and LTC/USD both entered and sat with
// ZERO protective stop for hours -- not a parser bug, their round-3
// invalidationCondition was genuinely qualitative with no numeric level at
// all ("Exit if re-verification shows ARB no longer above both newly
// calculated 50-day and 200-day averages"). parseStopPrice() correctly
// found nothing to extract; the old code just gave up. A thesis describing
// its exit qualitatively instead of with a hard price is not grounds to
// leave a real position completely unprotected -- fall back to a
// conservative fixed percentage off a real reference price (the fill price
// at entry time, or the live price on a later re-arm) when no numeric level
// exists. Tagged stopPriceSource so this is always distinguishable from a
// real thesis-derived level in the log.
const FALLBACK_STOP_PCT_CRYPTO = 0.08;
const FALLBACK_STOP_PCT_EQUITY = 0.05;

async function placeProtectiveStop({ symbol, direction, filledQty, invalidationCondition, isCrypto, sourceTask, lotId = null, referencePrice = null }) {
  let stopPrice = parseStopPrice(invalidationCondition);
  let stopPriceSource = 'thesis-derived';
  if (stopPrice === null) {
    if (!referencePrice) {
      console.log(`  WARNING: could not parse a stop price out of invalidationCondition ("${invalidationCondition}") and no reference price available for a fallback -- NO STOP PLACED. Handle manually.`);
      await alertUnprotectedPosition(symbol, sourceTask, 'no parseable stop price in invalidationCondition, and no reference price for a fallback');
      return { stopPlaced: false, reason: 'unparseable-stop-price' };
    }
    const pct = isCrypto ? FALLBACK_STOP_PCT_CRYPTO : FALLBACK_STOP_PCT_EQUITY;
    stopPrice = direction === 'short' ? referencePrice * (1 + pct) : referencePrice * (1 - pct);
    stopPriceSource = `fallback-${Math.round(pct * 100)}pct`;
    console.log(`  No numeric stop price in invalidationCondition ("${invalidationCondition}") -- falling back to a ${Math.round(pct * 100)}% stop off reference price $${referencePrice}: $${stopPrice.toFixed(6)}.`);
  }
  if (!filledQty) {
    console.log(`  WARNING: no filled quantity available to size the protective stop -- NO STOP PLACED. Handle manually.`);
    await alertUnprotectedPosition(symbol, sourceTask, 'no filled quantity available to size the stop');
    return { stopPlaced: false, reason: 'no-filled-qty' };
  }
  // A stop that CLOSES a short is a buy-stop (direction "long" in
  // submitOrder's convention); a stop that closes a long is a sell-stop.
  // A crypto entry is always "long" here (enforced upstream -- crypto is
  // spot/long-only), so this is always the sell-stop-closes-a-long case for
  // crypto rows, never the short-closing branch.
  const stopDirection = direction === 'short' ? 'long' : 'short';
  // Crypto rejects plain "stop" (confirmed live: 422 "invalid order type for
  // crypto order") -- Alpaca crypto only supports stop_limit, not stop-market.
  // A 1% buffer between stop and limit keeps the order fillable through
  // normal slippage rather than sitting unfilled at an exact price.
  const stopOrderType = isCrypto ? 'stop_limit' : 'stop';
  // Real incident, 2026-09-12: a computed fallback price (referencePrice *
  // 0.92, etc.) can carry floating-point noise well past Alpaca's stated
  // "maximum precision of 9 decimal places" for crypto (confirmed live:
  // 0.13017908000000003 was rejected outright). Round BEFORE submitting,
  // not after -- a thesis-derived price parsed from text is normally clean
  // already, but rounding it too is harmless and closes this class of bug
  // for both sources at once.
  const roundToPrecision = (n) => Number(n.toFixed(9));
  stopPrice = roundToPrecision(stopPrice);
  const stopLimitPrice = isCrypto
    ? roundToPrecision(stopDirection === 'short' ? stopPrice * 0.99 : stopPrice * 1.01)
    : undefined;

  const attempt = async (timeInForce) => alpaca.submitOrder({ symbol, direction: stopDirection, qty: filledQty, orderType: stopOrderType, stopPrice, limitPrice: stopLimitPrice, timeInForce, intent: 'close', clientOrderId: deriveStopClientOrderId(lotId, symbol, timeInForce) });

  let stopOrder, timeInForceUsed = 'gtc';
  console.log(`Placing protective GTC ${stopOrderType}: ${stopDirection} ${filledQty} @ stop $${stopPrice}${stopLimitPrice ? ` / limit $${stopLimitPrice.toFixed(8)}` : ''}...`);
  try {
    stopOrder = await attempt('gtc');
  } catch (gtcErr) {
    // Real incident, 2026-09-12: crypto does NOT support 'day' at all
    // (confirmed live: 422 "invalid crypto time_in_force" -- same fact
    // monitor-paper-trades.js's own closing-order logic already documents).
    // The GTC-fractional-qty issue this retry was built for is an EQUITY-
    // only problem (crypto's existing stops, e.g. ETH/USD, already work
    // fine under GTC) -- retrying crypto with 'day' can never succeed and
    // was masking the real GTC error with a second, unhelpful one.
    if (isCrypto) {
      console.log(`  WARNING: GTC stop rejected for crypto (${gtcErr.message.split('\n')[0]}) -- crypto has no 'day' fallback to retry with. NO STOP PLACED. Handle manually.`);
      await alertUnprotectedPosition(symbol, sourceTask, `crypto GTC stop order rejected, no retry available: ${gtcErr.message.split('\n')[0]}`);
      return { stopPlaced: false, reason: 'stop-order-rejected' };
    }
    console.log(`  GTC stop rejected (${gtcErr.message.split('\n')[0]}) -- retrying as a 'day' stop (Alpaca allows fractional qty under 'day', not 'gtc').`);
    try {
      stopOrder = await attempt('day');
      timeInForceUsed = 'day';
    } catch (dayErr) {
      console.log(`  WARNING: 'day' stop retry also failed (${dayErr.message.split('\n')[0]}) -- NO STOP PLACED. Handle manually.`);
      await alertUnprotectedPosition(symbol, sourceTask, `stop order rejected under both gtc and day: ${dayErr.message.split('\n')[0]}`);
      return { stopPlaced: false, reason: 'stop-order-rejected' };
    }
  }
  console.log(`  Stop order id ${stopOrder.id}, status ${stopOrder.status}, time_in_force ${timeInForceUsed}`);

  appendLog({
    ts: new Date().toISOString(),
    type: 'stop-order-placed',
    lotId,
    sourceTask,
    symbol,
    assetClass: isCrypto ? 'crypto' : 'equity',
    qty: filledQty,
    stopPrice,
    stopPriceSource,
    orderId: stopOrder.id,
    orderStatus: stopOrder.status,
    timeInForce: timeInForceUsed,
    note: timeInForceUsed === 'gtc'
      ? 'GTC stop placed immediately after entry fill in the same run (execute-portfolio-setup.js) -- no manual gap between entry and protection.'
      : "GTC rejected (fractional qty) -- placed as a 'day' stop instead. Expires at today's close; monitor-paper-trades.js's safety-net check re-arms it on the next --execute run if still open.",
  });
  return { stopPlaced: true, timeInForce: timeInForceUsed, stopOrderId: stopOrder.id, lotId };
}

// --auto-only path: true "micro trade" sizing, direct user request
// ("agents always running... making micro trades and documenting their
// learnings"). A single flat dollar target across every asset class/price
// range, not the old flat-10-shares/flat-$50 constants (10 shares of LLY
// was never micro). Alpaca supports fractional/notional orders for long
// equity and all crypto, but NOT for short equity (a real, documented
// Alpaca limit) -- so a short computes a whole-share qty approximating
// the same dollar target from a live quote instead.
async function computeMicroSizing(symbol, direction, isCrypto) {
  if (isCrypto || direction === 'long') return { notional: AUTO_MICRO_NOTIONAL_PER_LEG };
  const quote = await alpaca.getLatestQuote(symbol);
  const qty = Math.max(1, Math.floor(AUTO_MICRO_NOTIONAL_PER_LEG / quote.mid));
  return { qty };
}

async function runForTaskMicro(taskId) {
  const candidates = extractApprovedCandidates(taskId);
  console.log(`[--auto] Found ${candidates.length} approved candidate(s) in ${taskId}, sizing each as a ~$${AUTO_MICRO_NOTIONAL_PER_LEG} micro trade.`);
  for (const candidate of candidates) {
    const setup = candidate.conditionalSetup;
    const isCrypto = cryptoSymbols.isCryptoSymbol(setup.symbol);
    const sizing = await computeMicroSizing(setup.symbol, setup.direction, isCrypto);
    await executeOne(candidate, taskId, sizing);
  }
}

async function runForTask(taskId, notionalPerLeg, qtyPerLeg) {
  const candidates = extractApprovedCandidates(taskId);
  console.log(`Found ${candidates.length} approved candidate(s) in ${taskId}.`);

  for (const candidate of candidates) {
    const symbol = candidate.conditionalSetup.symbol;
    const isCrypto = cryptoSymbols.isCryptoSymbol(symbol);
    if (isCrypto) {
      // No default dollar amount is invented for crypto on the MANUAL
      // path -- position sizing is explicitly the human operator's call,
      // and a wrong guess here is real money-shaped, even in paper: fail
      // loudly rather than silently pick a number. (--auto uses
      // computeMicroSizing() instead -- see runForTaskMicro().)
      if (!notionalPerLeg) {
        console.error(`FAILED: ${symbol} is a crypto candidate but no --notionalPerLeg=<dollars> was supplied. Crypto positions size by dollar notional, not share qty -- pass e.g. --notionalPerLeg=50.`);
        process.exit(1);
      }
      await executeOne(candidate, taskId, { notional: notionalPerLeg });
    } else {
      const qty = qtyPerLeg || 10;
      await executeOne(candidate, taskId, { qty });
    }
  }
}

async function main() {
  const isAuto = process.argv.includes('--auto');

  if (isAuto) {
    const pilotArg = process.argv.find((a) => a.startsWith('--pilot='));
    const pilot = pilotArg ? pilotArg.split('=')[1] : null;
    if (pilot !== 'fleet' && pilot !== 'crypto') {
      console.error('Usage: node execute-portfolio-setup.js --auto --pilot=fleet|crypto');
      process.exit(1);
    }
    const taskId = findLatestUnexecutedRound3(pilot);
    if (!taskId) {
      console.log(`[--auto] No unexecuted status:done round-3 task found for ${pilot} -- nothing to do.`);
      return;
    }
    console.log(`[--auto] Executing ${taskId} (${pilot}), micro sizing ($${AUTO_MICRO_NOTIONAL_PER_LEG}/leg).`);
    await runForTaskMicro(taskId);
    console.log('\nDone.');
    return;
  }

  const taskId = process.argv[2];
  if (!taskId) {
    console.error('Usage: node execute-portfolio-setup.js <taskId> [qtyPerLeg] [--notionalPerLeg=<dollars>]\n   or: node execute-portfolio-setup.js --auto --pilot=fleet|crypto');
    process.exit(1);
  }
  const notionalArg = process.argv.find((a) => a.startsWith('--notionalPerLeg='));
  const notionalPerLeg = notionalArg ? Number(notionalArg.split('=')[1]) : null;
  const qtyPerLeg = Number(process.argv[3]) || null;
  await runForTask(taskId, notionalPerLeg, qtyPerLeg);
  console.log('\nDone.');
}

// Guarded so this file can be require()'d as a library (conditional-triggers.js
// reuses executeOne()/alreadyExecuted() for the confirm-then-fire path) without
// its own CLI main() running unsolicited -- previously main() ran unconditionally
// on require, a real blocker the first time this was attempted.
if (require.main === module) {
  main().catch((err) => {
    console.error('FAILED:', err.message);
    process.exit(1);
  });
}

module.exports = {
  executeOne, alreadyExecuted, extractApprovedCandidates, runForTask, runForTaskMicro,
  computeMicroSizing, AUTO_MICRO_NOTIONAL_PER_LEG, placeProtectiveStop, parseStopPrice,
  // Position/lot identity + the two new gates -- exported so they can be
  // exercised directly (run-verification-suite.js style: real logic, zero
  // network) and reused by readers that need the same open-lot pairing rules.
  newLotId, positionKey, openLots, findOpenLotForSymbol, assertNoExistingPosition,
  deriveEntryClientOrderId, deriveStopClientOrderId, deriveExitClientOrderId,
  NON_DERIVED_RED_FLAGS, collectCandidateText, scanCandidateForRedFlags,
  parseFirstDollarAmount, deriveModeledEntry, readTradeLog,
};
