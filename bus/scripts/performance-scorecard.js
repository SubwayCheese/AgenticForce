#!/usr/bin/env node
// performance-scorecard.js -- the EVALUATION LAYER the multi-agent
// self-review found missing (roadmap item 6, 2026-09-11).
//
// Until now the pipeline could tell you what it DID (paper-trades.jsonl),
// and what it LEARNED (trading-journal.jsonl), but not whether any of it
// was any good. A raw P&L% on a paper account with zero commissions is the
// most flattering possible number: it ignores what the trade would really
// have cost, it ignores how far the fill landed from the price the thesis
// actually modeled, and it ignores that the whole market may simply have
// gone up while you held. This script computes the three corrections that
// turn "we were up 0.3%" into a claim that survives contact with reality:
//
//   1. COST-ADJUSTED P&L -- subtract an estimated round-trip transaction
//      cost. Alpaca paper fills are free; real execution is not.
//   2. ENTRY SLIPPAGE -- actualFillPrice vs the price the candidate itself
//      modeled/triggered on (modeledEntry). A strategy that only works when
//      you fill exactly at the trigger isn't a strategy.
//   3. BENCHMARK -- SPY's return over the same holding period for equities,
//      BTC's for crypto. Beating zero is not the bar; beating what you'd
//      have made doing nothing is.
//
// Usage:
//   node performance-scorecard.js                    (full report, writes JSON + MD)
//   node performance-scorecard.js --no-benchmark     (skip all market-data calls)
//   node performance-scorecard.js --since=2026-09-09
//   node performance-scorecard.js --json=<path> --md=<path>
//
// BACKWARD COMPATIBILITY IS LOAD-BEARING HERE: almost every record this
// reads today predates lot ids and real modeledEntry values. Every field
// this script touches is treated as optional -- a missing one degrades that
// one metric to null with a stated reason, and never crashes the run or
// silently becomes a zero.

const fs = require('fs');
const path = require('path');
const cryptoSymbols = require('./crypto-symbols.js');
const journal = require('./trading-journal.js');

const VAULT_ROOT = path.resolve(__dirname, '..', '..');
const TRADES_PATH = path.join(VAULT_ROOT, 'bus', 'paper-trades.jsonl');
const JOURNAL_PATH = path.join(VAULT_ROOT, 'bus', 'trading-journal.jsonl');
const DEFAULT_JSON_OUT = path.join(VAULT_ROOT, 'bus', 'performance-scorecard.json');
const DEFAULT_MD_OUT = path.join(VAULT_ROOT, 'bus', 'performance-scorecard.md');

// -------------------------------------------------------------------------
// ESTIMATES -- NOT measured costs. Labeled as such everywhere they surface.
// -------------------------------------------------------------------------
// Alpaca's paper account fills with no commission and no spread cost at all,
// so nothing in paper-trades.jsonl contains a real transaction cost to read.
// These are deliberate, conservative stand-ins for what a round trip (in AND
// out) would actually cost in the real market: bid/ask spread crossed twice
// plus fees. 0.20% for equities is a reasonable retail round-trip estimate on
// liquid large caps; 0.05% approximates a taker fee pair on a major crypto
// venue. They are STARTING NUMBERS to be calibrated against real fills the
// day this pipeline touches real money -- treat every cost-adjusted figure
// below as "P&L minus this assumption", not as a measured net return.
const ESTIMATED_ROUND_TRIP_COST_PCT = {
  equity: 0.20,
  crypto: 0.05,
};

const BENCHMARK_SYMBOL = {
  equity: 'SPY',
  crypto: 'BTC/USD',
};

function readJsonl(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return fs.readFileSync(filePath, 'utf8').split('\n').filter((l) => l.trim()).map((l) => {
    try { return JSON.parse(l); } catch (_) { return null; }
  }).filter(Boolean);
}

function assetClassOf(record) {
  if (record.assetClass) return record.assetClass;
  return cryptoSymbols.isCryptoSymbol(record.symbol) ? 'crypto' : 'equity';
}

// Equity sessions are an ET concept; crypto is a continuous UTC clock. Using
// one timezone for both would misdate a late-afternoon ET equity fill (which
// is already "tomorrow" in UTC) and pair it against the wrong SPY bar.
function calendarDate(iso, assetClass) {
  const d = new Date(iso);
  if (assetClass === 'crypto') return d.toISOString().slice(0, 10);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

// -------------------------------------------------------------------------
// Closed-trade reconstruction
// -------------------------------------------------------------------------
// Built straight from paper-trades.jsonl rather than from trading-journal.jsonl,
// deliberately: the journal only has rows for trades that were closed while
// journalClosedTrades() happened to be running, and it doesn't carry qty or
// modeledEntry on historical rows. The journal is then merged in for the
// qualitative half (thesis, lesson, outcome label) where a row exists.
// Pairing reuses trading-journal.js's findMatchingExit() -- lotId first,
// oldest-unclaimed-exit-in-symbol fallback for pre-lot-id history -- so both
// files always agree on what "one trade" is.
function buildClosedTrades() {
  const trades = readJsonl(TRADES_PATH);
  const entries = trades.filter((t) => t.type === 'research-driven-entry')
    .sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
  const exits = trades.filter((t) => t.type === 'research-driven-exit')
    .sort((a, b) => String(a.ts).localeCompare(String(b.ts)));

  const journalRows = new Map();
  for (const row of readJsonl(JOURNAL_PATH)) {
    if (row.type === 'trade-closed') journalRows.set(`${row.entryTs}::${row.symbol}`, row);
  }
  const lessons = new Map();
  for (const row of readJsonl(JOURNAL_PATH)) {
    if (row.type === 'lesson-added') lessons.set(`${row.entryTs}::${row.symbol}`, row.lesson);
  }

  const claimed = new Set();
  const closed = [];
  const open = [];
  for (const entry of entries) {
    const exit = journal.findMatchingExit(entry, exits, claimed);
    if (!exit) { open.push(entry); continue; }
    claimed.add(exit);
    const key = `${entry.ts}::${entry.symbol}`;
    closed.push(buildTrade(entry, exit, journalRows.get(key) || null, lessons.get(key) || null));
  }
  return { closed, open };
}

function buildTrade(entry, exit, journalRow, lesson) {
  const assetClass = assetClassOf(entry);
  const direction = entry.direction || 'long';
  const entryPrice = entry.actualFillPrice != null ? Number(entry.actualFillPrice) : null;
  const exitPrice = exit.exitFillPrice != null ? Number(exit.exitFillPrice) : null;
  const qty = entry.qty != null ? Number(entry.qty) : null;

  let pnlPct = null;
  if (entryPrice && exitPrice) {
    pnlPct = direction === 'short'
      ? ((entryPrice - exitPrice) / entryPrice) * 100
      : ((exitPrice - entryPrice) / entryPrice) * 100;
  }

  const costPct = ESTIMATED_ROUND_TRIP_COST_PCT[assetClass];
  const costAdjustedPnlPct = pnlPct === null ? null : pnlPct - costPct;

  // Slippage, signed so POSITIVE ALWAYS MEANS ADVERSE regardless of
  // direction: a long that filled above its modeled entry and a short that
  // filled below its modeled entry both started the trade in a worse place
  // than the thesis assumed. Null when the entry has no modeled price at all
  // -- which is every entry written between the retirement of
  // scratch-execute-portfolio-r3v2.js and the 2026-09-11 fix, and is
  // reported as "not measurable", never as 0.
  const modeledEntry = entry.modeledEntry != null ? Number(entry.modeledEntry) : null;
  let slippagePct = null;
  if (modeledEntry && entryPrice) {
    slippagePct = direction === 'short'
      ? ((modeledEntry - entryPrice) / modeledEntry) * 100
      : ((entryPrice - modeledEntry) / modeledEntry) * 100;
  }

  let dollarPnl = null;
  if (qty && entryPrice && exitPrice) {
    dollarPnl = direction === 'short' ? (entryPrice - exitPrice) * qty : (exitPrice - entryPrice) * qty;
  }

  // Real entry-time dollar size, computed from what actually happened, not
  // a hardcoded date cutoff -- notional-sized entries (crypto, equity long)
  // carry entry.notional directly; qty-sized entries (equity short, no
  // fractional-share shorting) are qty * entryPrice. Used to bucket trades
  // into a sizing era below: added 2026-09-13, real gap found by the
  // multi-agent research stack the same day AUTO_MICRO_NOTIONAL_PER_LEG
  // went from $15 to $1,000 -- aggregate()'s own equal-weighting comment
  // already said trades are "deliberately similar size," an assumption
  // that breaks the moment both eras coexist (a -5% $1,000 loss and a +4%
  // $15 gain averaging to -0.5%/trade would hide that one trade was 83x
  // the real dollar exposure of the other).
  const entrySizeUsd = entry.notional != null ? Number(entry.notional) : (qty && entryPrice ? qty * entryPrice : null);
  // $100 is a clean midpoint between the two real sizes seen so far ($15,
  // $1,000) -- classifies by what the trade actually was, not by which
  // side of a date boundary it fell on, so it stays correct even if
  // sizing changes again later.
  // Labeled by real observed size, not by a specific regime name -- the
  // >=$100 bucket is NOT purely "the new $1,000/leg era" (confirmed live:
  // it also catches TSLA/GOOGL/CSCO, real 10-share MANUAL entries from
  // 2026-09-08, before the micro-sizing system existed at all, worth
  // $1,088-$3,664 each -- genuinely never $15 trades despite predating
  // the sizing-increase commit). The label says what's true either way:
  // this trade's real entry size was clearly bigger or clearly smaller
  // than the $15-era micro target, without asserting WHY.
  const sizingEra = entrySizeUsd === null ? 'unknown size' : entrySizeUsd < 100 ? 'micro-sized (<$100)' : 'larger-sized (>=$100)';

  return {
    lotId: entry.lotId || null,
    symbol: entry.symbol,
    assetClass,
    direction,
    sourceTask: entry.sourceTask || null,
    entryTs: entry.ts,
    exitTs: exit.ts,
    entryDate: calendarDate(entry.ts, assetClass),
    exitDate: calendarDate(exit.ts, assetClass),
    holdingHours: (new Date(exit.ts).getTime() - new Date(entry.ts).getTime()) / 3600000,
    qty,
    notional: entry.notional != null ? Number(entry.notional) : null,
    entrySizeUsd,
    sizingEra,
    modeledEntry,
    modeledEntrySource: entry.modeledEntrySource || null,
    entryPrice,
    exitPrice,
    pnlPct,
    dollarPnl,
    estimatedRoundTripCostPct: costPct,
    costAdjustedPnlPct,
    slippagePct,
    slippageNote: slippagePct === null ? 'not measurable: entry record has no modeledEntry (pre-2026-09-11 records hardcoded null)' : null,
    exitReason: exit.reason || null,
    outcome: pnlPct === null ? 'unknown' : (pnlPct > 0 ? 'win' : (pnlPct < 0 ? 'loss' : 'flat')),
    thesis: journalRow && journalRow.entryThesis ? journalRow.entryThesis : null,
    lesson: lesson || null,
    // filled in by attachBenchmarks()
    benchmark: null,
  };
}

// -------------------------------------------------------------------------
// Benchmark comparison
// -------------------------------------------------------------------------
// One batched getDailyBars() call per benchmark for the whole window, not one
// per trade. Daily bars are the only free historical granularity available on
// the existing Alpaca paper key (see alpaca-client.js's getDailyBars comment),
// which has a real consequence stated in every result: a position opened and
// closed inside a single session cannot be measured close-to-close, so those
// fall back to that session's own open-to-close move and say so, rather than
// silently reporting 0%.
function barDate(bar, assetClass) {
  return calendarDate(bar.t, assetClass);
}

function benchmarkFor(trade, barsByDate, orderedDates, benchmarkSymbol, assetClass) {
  if (!orderedDates.length) {
    return { symbol: benchmarkSymbol, returnPct: null, basis: null, note: 'no benchmark bars returned for this window' };
  }
  const onOrBefore = (dateStr) => {
    let found = null;
    for (const d of orderedDates) {
      if (d <= dateStr) found = d; else break;
    }
    return found;
  };
  const startDate = onOrBefore(trade.entryDate);
  const endDate = onOrBefore(trade.exitDate);
  if (!startDate || !endDate) {
    return { symbol: benchmarkSymbol, returnPct: null, basis: null, note: `no ${benchmarkSymbol} bar at or before ${!startDate ? trade.entryDate : trade.exitDate}` };
  }
  if (startDate === endDate) {
    const bar = barsByDate.get(startDate);
    if (!bar.o) return { symbol: benchmarkSymbol, returnPct: null, basis: null, note: 'single-session trade and that bar has no open price' };
    return {
      symbol: benchmarkSymbol,
      returnPct: ((bar.c - bar.o) / bar.o) * 100,
      basis: 'single-session-open-to-close',
      note: `entry and exit fall in the same ${assetClass === 'crypto' ? 'UTC day' : 'ET session'} (${startDate}); daily bars cannot express a shorter hold, so this is that session's own open-to-close move -- an APPROXIMATION, not the exact overlapping window`,
    };
  }
  const a = barsByDate.get(startDate);
  const b = barsByDate.get(endDate);
  return {
    symbol: benchmarkSymbol,
    returnPct: ((b.c - a.c) / a.c) * 100,
    basis: 'close-to-close',
    note: `${benchmarkSymbol} close ${startDate} -> close ${endDate}`,
  };
}

async function attachBenchmarks(trades) {
  if (!trades.length) return;
  // Required lazily so --no-benchmark works on a machine with no credentials
  // configured at all -- alpaca-client.js throws from loadConfig() on the
  // first real call, not on require, but keeping this local makes the
  // dependency boundary explicit.
  const alpaca = require('./alpaca-client.js');
  const oldest = trades.reduce((min, t) => (t.entryTs < min ? t.entryTs : min), trades[0].entryTs);
  const daysBack = Math.ceil((Date.now() - new Date(oldest).getTime()) / 86400000) + 7;
  const limit = Math.max(25, Math.ceil(daysBack / 1.6) + 5);

  for (const assetClass of ['equity', 'crypto']) {
    const subset = trades.filter((t) => t.assetClass === assetClass);
    if (!subset.length) continue;
    const symbol = BENCHMARK_SYMBOL[assetClass];
    let bars = [];
    try {
      const result = await alpaca.getDailyBars([symbol], { limit });
      bars = (result && result[symbol] && result[symbol].bars) || [];
    } catch (err) {
      for (const t of subset) {
        t.benchmark = { symbol, returnPct: null, basis: null, note: `benchmark lookup failed: ${err.message.split('\n')[0]}` };
      }
      continue;
    }
    const barsByDate = new Map();
    for (const bar of bars) barsByDate.set(barDate(bar, assetClass), bar);
    const orderedDates = Array.from(barsByDate.keys()).sort();
    for (const t of subset) {
      t.benchmark = benchmarkFor(t, barsByDate, orderedDates, symbol, assetClass);
      // A BTC trade benchmarked against BTC is tautological -- say so rather
      // than printing a meaningless 0% excess as if it were signal.
      if (assetClass === 'crypto' && cryptoSymbols.isCryptoSymbol(t.symbol) && cryptoSymbols.toAlpacaSymbol(t.symbol) === symbol) {
        t.benchmark.note = `${t.benchmark.note} -- NOTE: this trade IS the benchmark asset, so its excess return is definitionally near zero and carries no information`;
        t.benchmark.selfBenchmarked = true;
      }
      if (t.benchmark.returnPct !== null && t.costAdjustedPnlPct !== null) {
        t.excessVsBenchmarkPct = t.costAdjustedPnlPct - t.benchmark.returnPct;
      } else {
        t.excessVsBenchmarkPct = null;
      }
      // Honest caveat rather than a silently misleading number: the
      // benchmark is a LONG hold of SPY/BTC. For a SHORT position, "excess
      // vs benchmark" is not the usual "did you beat buy-and-hold" question
      // -- a short that loses 0.2% while SPY falls 0.4% shows a positive
      // excess here while having been on the wrong side of the very move it
      // is being credited for. Read those rows as "vs the market's direction",
      // not as alpha.
      if (t.direction === 'short') {
        t.benchmarkDirectionCaveat = 'short position measured against a long benchmark -- a positive excess here does NOT mean the short worked, only that the market moved less favourably than the loss';
      }
    }
  }
}

// -------------------------------------------------------------------------
// Aggregation
// -------------------------------------------------------------------------
function mean(values) {
  const nums = values.filter((v) => typeof v === 'number' && Number.isFinite(v));
  if (!nums.length) return null;
  return nums.reduce((s, v) => s + v, 0) / nums.length;
}

function sum(values) {
  const nums = values.filter((v) => typeof v === 'number' && Number.isFinite(v));
  if (!nums.length) return null;
  return nums.reduce((s, v) => s + v, 0);
}

// Equal-weighted across trades, and stated as such: these are trades of
// deliberately similar size (a single flat notional per leg on the --auto
// path -- $15 originally, $1,000 as of 2026-09-13), so an equal weight is
// close to a dollar weight, but they are not identical (size changed over
// time, plus any manually-sized entries) and the aggregate dollar P&L is
// reported alongside so neither has to be inferred.
function aggregate(trades) {
  const measurable = trades.filter((t) => t.pnlPct !== null);
  const wins = measurable.filter((t) => t.pnlPct > 0).length;
  const losses = measurable.filter((t) => t.pnlPct < 0).length;
  const slippageMeasured = trades.filter((t) => t.slippagePct !== null);
  const benchmarked = trades.filter((t) => t.benchmark && t.benchmark.returnPct !== null && !t.benchmark.selfBenchmarked);
  return {
    tradeCount: trades.length,
    measurableCount: measurable.length,
    wins,
    losses,
    winRatePct: measurable.length ? (wins / measurable.length) * 100 : null,
    meanPnlPct: mean(measurable.map((t) => t.pnlPct)),
    meanCostAdjustedPnlPct: mean(measurable.map((t) => t.costAdjustedPnlPct)),
    totalDollarPnl: sum(trades.map((t) => t.dollarPnl)),
    slippageMeasuredCount: slippageMeasured.length,
    slippageUnmeasurableCount: trades.length - slippageMeasured.length,
    meanEntrySlippagePct: mean(slippageMeasured.map((t) => t.slippagePct)),
    benchmarkedCount: benchmarked.length,
    meanBenchmarkReturnPct: mean(benchmarked.map((t) => t.benchmark.returnPct)),
    meanExcessVsBenchmarkPct: mean(benchmarked.map((t) => t.excessVsBenchmarkPct)),
  };
}

function buildScorecard(trades, openPositions) {
  const byClass = {};
  for (const assetClass of ['equity', 'crypto']) {
    const subset = trades.filter((t) => t.assetClass === assetClass);
    if (subset.length) byClass[assetClass] = aggregate(subset);
  }
  // Sizing-era split, added 2026-09-13 -- see buildTrade()'s sizingEra
  // comment for why "overall" alone becomes misleading the moment both
  // eras coexist. Both eras present is exactly the trigger to look at
  // byEra instead of overall.
  const byEra = {};
  const eras = Array.from(new Set(trades.map((t) => t.sizingEra)));
  for (const era of eras) {
    const subset = trades.filter((t) => t.sizingEra === era);
    if (subset.length) byEra[era] = aggregate(subset);
  }
  const mixedEras = eras.filter((e) => e !== 'unknown').length > 1;
  return {
    generatedAt: new Date().toISOString(),
    estimatedRoundTripCostPct: ESTIMATED_ROUND_TRIP_COST_PCT,
    costBasisNote: 'Transaction costs are ESTIMATES, not measured -- the paper account fills free of commission and spread. See ESTIMATED_ROUND_TRIP_COST_PCT in performance-scorecard.js.',
    benchmarkSymbols: BENCHMARK_SYMBOL,
    overall: aggregate(trades),
    mixedSizingEras: mixedEras,
    mixedSizingErasNote: mixedEras
      ? 'Trades from more than one sizing era are present -- "overall" equal-weights them despite very different real dollar exposure per trade. Use byEra for an honest read; treat "overall" as a rough, cost-of-doing-business number only.'
      : null,
    byAssetClass: byClass,
    byEra,
    openPositionCount: openPositions.length,
    openPositions: openPositions.map((e) => ({ lotId: e.lotId || null, symbol: e.symbol, entryTs: e.ts, sourceTask: e.sourceTask || null })),
    trades,
  };
}

// -------------------------------------------------------------------------
// Rendering
// -------------------------------------------------------------------------
function pct(v, digits = 2) {
  return (typeof v === 'number' && Number.isFinite(v)) ? `${v >= 0 ? '+' : ''}${v.toFixed(digits)}%` : 'n/a';
}

function money(v) {
  return (typeof v === 'number' && Number.isFinite(v)) ? `${v >= 0 ? '+' : '-'}$${Math.abs(v).toFixed(2)}` : 'n/a';
}

function renderAggregate(label, agg) {
  const lines = [];
  lines.push(`**${label}** -- ${agg.tradeCount} closed trade(s), ${agg.measurableCount} with usable fill prices.`);
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('| --- | --- |');
  lines.push(`| Win rate | ${agg.winRatePct === null ? 'n/a' : `${agg.winRatePct.toFixed(1)}% (${agg.wins}W / ${agg.losses}L)`} |`);
  lines.push(`| Mean P&L per trade | ${pct(agg.meanPnlPct)} |`);
  lines.push(`| Mean cost-adjusted P&L per trade | ${pct(agg.meanCostAdjustedPnlPct)} |`);
  lines.push(`| Total realized P&L (dollars) | ${money(agg.totalDollarPnl)} |`);
  lines.push(`| Mean entry slippage (positive = adverse) | ${agg.meanEntrySlippagePct === null ? `not measurable (${agg.slippageUnmeasurableCount}/${agg.tradeCount} entries have no modeledEntry)` : `${pct(agg.meanEntrySlippagePct)} across ${agg.slippageMeasuredCount} trade(s)`} |`);
  lines.push(`| Mean benchmark return, same periods | ${agg.benchmarkedCount ? pct(agg.meanBenchmarkReturnPct) : 'n/a'} |`);
  lines.push(`| Mean excess vs benchmark (cost-adjusted) | ${agg.benchmarkedCount ? pct(agg.meanExcessVsBenchmarkPct) : 'n/a'} |`);
  lines.push('');
  return lines;
}

function renderMarkdown(card) {
  const L = [];
  L.push('# Paper-trading performance scorecard');
  L.push('');
  L.push(`Generated ${card.generatedAt} from \`bus/paper-trades.jsonl\` + \`bus/trading-journal.jsonl\`.`);
  L.push('');
  L.push('> Cost-adjusted figures subtract an **estimated** round-trip transaction cost of '
    + `${ESTIMATED_ROUND_TRIP_COST_PCT.equity}% (equities) / ${ESTIMATED_ROUND_TRIP_COST_PCT.crypto}% (crypto). `
    + 'These are assumptions, not measured costs -- the paper account fills commission- and spread-free. '
    + 'Recalibrate before treating any net figure as real.');
  L.push('');

  if (!card.overall.tradeCount) {
    L.push('_No closed trades found yet._');
    L.push('');
  } else {
    // The one-sentence version the roadmap actually asked for, stated
    // mechanically from the numbers so it can never drift from the tables.
    const o = card.overall;
    L.push('## Headline');
    L.push('');
    L.push(`Across ${o.measurableCount} closed trade(s): **${pct(o.meanPnlPct)} per trade raw**, `
      + `**${pct(o.meanCostAdjustedPnlPct)} cost-adjusted**, `
      + `versus **${o.benchmarkedCount ? pct(o.meanBenchmarkReturnPct) : 'n/a'}** for the benchmark over the same periods `
      + `(${o.benchmarkedCount} of ${o.tradeCount} trade(s) benchmarked). `
      + `Win rate ${o.winRatePct === null ? 'n/a' : `${o.winRatePct.toFixed(1)}%`}. `
      + `Mean entry slippage ${o.meanEntrySlippagePct === null ? 'not measurable' : pct(o.meanEntrySlippagePct)}`
      + `${(o.meanEntrySlippagePct !== null && o.meanPnlPct !== null && o.meanEntrySlippagePct > Math.abs(o.meanPnlPct)) ? ' -- larger in magnitude than the mean P&L itself, i.e. execution quality, not thesis quality, dominates these results' : ''}.`);
    L.push('');
    if (card.trades.some((t) => t.direction === 'short' && t.benchmark && t.benchmark.returnPct !== null)) {
      L.push('> Short positions are present. The benchmark is a LONG hold of SPY/BTC, so "excess vs benchmark" on a short row is not alpha -- see the per-trade caveats.');
      L.push('');
    }
    L.push(...renderAggregate('Overall', card.overall));
    if (card.mixedSizingEras) {
      L.push(`> **${card.mixedSizingErasNote}**`);
      L.push('');
    }
    for (const [assetClass, agg] of Object.entries(card.byAssetClass)) {
      L.push(...renderAggregate(`${assetClass === 'equity' ? 'Equities' : 'Crypto'} (benchmark ${BENCHMARK_SYMBOL[assetClass]})`, agg));
    }
    if (card.mixedSizingEras) {
      L.push('## By sizing era');
      L.push('');
      for (const [era, agg] of Object.entries(card.byEra)) {
        L.push(...renderAggregate(era, agg));
      }
    }

    L.push('## Per-trade detail');
    L.push('');
    L.push('| Symbol | Dir | Entry -> Exit | P&L | Cost-adj | Slippage | Benchmark | Excess |');
    L.push('| --- | --- | --- | --- | --- | --- | --- | --- |');
    for (const t of card.trades) {
      const bench = t.benchmark && t.benchmark.returnPct !== null ? `${t.benchmark.symbol} ${pct(t.benchmark.returnPct)}` : 'n/a';
      L.push(`| ${t.symbol} | ${t.direction} | ${t.entryDate} -> ${t.exitDate} (${t.holdingHours.toFixed(1)}h) | ${pct(t.pnlPct)} | ${pct(t.costAdjustedPnlPct)} | ${t.slippagePct === null ? 'n/a' : pct(t.slippagePct)} | ${bench} | ${t.excessVsBenchmarkPct == null ? 'n/a' : pct(t.excessVsBenchmarkPct)} |`);
    }
    L.push('');

    L.push('### Per-trade notes');
    L.push('');
    for (const t of card.trades) {
      L.push(`- **${t.symbol}** (${t.direction}, lot \`${t.lotId || 'legacy/none'}\`): entered $${t.entryPrice}, exited $${t.exitPrice}, ${pct(t.pnlPct)} raw / ${pct(t.costAdjustedPnlPct)} cost-adjusted`
        + (t.benchmark && t.benchmark.returnPct !== null ? `, vs ${t.benchmark.symbol} ${pct(t.benchmark.returnPct)} over the same period (${t.benchmark.basis})` : ', benchmark not available')
        + (t.slippagePct === null ? `. Slippage ${t.slippageNote}.` : `. Entry slippage ${pct(t.slippagePct)} vs modeled $${t.modeledEntry}.`));
      if (t.benchmark && t.benchmark.note) L.push(`  - benchmark basis: ${t.benchmark.note}`);
      if (t.benchmarkDirectionCaveat) L.push(`  - CAVEAT: ${t.benchmarkDirectionCaveat}`);
      if (t.exitReason) L.push(`  - exit: ${t.exitReason}`);
      if (t.lesson) L.push(`  - journal lesson: ${t.lesson}`);
    }
    L.push('');
  }

  if (card.openPositionCount) {
    L.push('## Still open (not scored)');
    L.push('');
    for (const p of card.openPositions) {
      L.push(`- ${p.symbol} -- entered ${p.entryTs}, lot \`${p.lotId || 'legacy/none'}\`, from ${p.sourceTask}`);
    }
    L.push('');
  }
  return L.join('\n');
}

// -------------------------------------------------------------------------
async function main() {
  const args = process.argv.slice(2);
  const noBenchmark = args.includes('--no-benchmark');
  const quiet = args.includes('--quiet');
  const sinceArg = args.find((a) => a.startsWith('--since='));
  const jsonArg = args.find((a) => a.startsWith('--json='));
  const mdArg = args.find((a) => a.startsWith('--md='));
  const jsonOut = jsonArg ? jsonArg.split('=')[1] : DEFAULT_JSON_OUT;
  const mdOut = mdArg ? mdArg.split('=')[1] : DEFAULT_MD_OUT;

  let { closed, open } = buildClosedTrades();
  if (sinceArg) {
    const since = sinceArg.split('=')[1];
    closed = closed.filter((t) => t.entryDate >= since);
  }
  if (!noBenchmark) await attachBenchmarks(closed);
  else for (const t of closed) { t.benchmark = { symbol: BENCHMARK_SYMBOL[t.assetClass], returnPct: null, basis: null, note: 'skipped (--no-benchmark)' }; t.excessVsBenchmarkPct = null; }

  const card = buildScorecard(closed, open);
  const md = renderMarkdown(card);
  fs.writeFileSync(jsonOut, JSON.stringify(card, null, 2), 'utf8');
  fs.writeFileSync(mdOut, md, 'utf8');
  if (!quiet) console.log(md);
  console.log(`\n[performance-scorecard] Wrote ${jsonOut} and ${mdOut}.`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error('FAILED:', err.message);
    process.exit(1);
  });
}

module.exports = {
  buildClosedTrades, buildTrade, attachBenchmarks, benchmarkFor, aggregate,
  buildScorecard, renderMarkdown, calendarDate,
  ESTIMATED_ROUND_TRIP_COST_PCT, BENCHMARK_SYMBOL,
};
