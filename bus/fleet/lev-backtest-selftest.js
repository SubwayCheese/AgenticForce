// Self-checks for the leveraged-ETF trend backtest engine and CLI using synthetic bars (no network, no live data).
//
// Run: node bus/fleet/lev-backtest-selftest.js   (exit code non-zero on any failure)
// Covers: no lookahead, next-open fills, warm-up, per-side slippage, same-day round trip ban, S1 hysteresis, S2 exits (incl.
// trailing drawdown on the UNDERLYING), no expense ratio, whole-share cap, metrics on hand-computed curves, bootstrap
// reproducibility, deflated Sharpe sanity, prereg hash refusal, --test refusal, no order-submission import, and an end-to-end
// tune/test run on synthetic bars in a temp dir (also proving tune never depends on post-tuneEnd data).
'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const engine = require('./lev-backtest-engine.js');
const cli = require('./backtest-lev-trend.js');

const results = [];
async function test(name, fn) {
  try { await fn(); results.push({ name, ok: true }); console.log(`  ok   ${name}`); } catch (e) {
    results.push({ name, ok: false, error: e }); console.log(`  FAIL ${name}\n       ${String(e && e.stack ? e.stack : e).split('\n').slice(0, 6).join('\n       ')}`);
  }
}
const near = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `expected ${a} ~ ${b} (tol ${tol})`);

// ---- synthetic helpers
function weekdays(start, count) {
  const out = [];
  const d = new Date(`${start}T00:00:00Z`);
  while (out.length < count) {
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}
const bar = (date, open, close) => ({ date, open, high: Math.max(open, close), low: Math.min(open, close), close, volume: 1000 });
function mkAligned({ uClose, tOpen, tClose, cOpen, cClose, start = '2020-01-01' }) {
  const n = uClose.length;
  const dates = weekdays(start, n);
  const u = dates.map((d, i) => bar(d, uClose[i], uClose[i]));
  const t = dates.map((d, i) => bar(d, tOpen ? tOpen[i] : uClose[i], tClose ? tClose[i] : uClose[i]));
  const flat = new Array(n).fill(100);
  const c = dates.map((d, i) => bar(d, cOpen ? cOpen[i] : flat[i], cClose ? cClose[i] : flat[i]));
  return engine.alignBars(u, t, c);
}
const rising = (n, start = 100, step = 1) => Array.from({ length: n }, (_, i) => start + step * i);
function prng(seed) { return engine.mulberry32(seed); }

async function main() {
  console.log('lev-backtest-selftest');

  await test('signals at t use only data up to t (S1, S2, S3)', () => {
    const r = prng(7);
    const closes = []; let p = 100;
    for (let i = 0; i < 400; i++) { p *= 1 + (r() - 0.48) * 0.03; closes.push(p); }
    const mutated = closes.map((c, i) => (i >= 250 ? c * (0.5 + r()) : c));
    const gens = [
      (c) => engine.s1Signals(c, { n: 20, bandPct: 1 }),
      (c) => engine.s2Signals(c, { slow: 30, trailingDDPct: 8, fast: 5 }),
      (c) => engine.s3Signals(c, { n: 30, bandPct: 1, targetVolPct: 20, leverage: 3 }),
    ];
    for (const g of gens) assert.deepEqual(g(closes).slice(0, 250), g(mutated).slice(0, 250));
    assert.deepEqual(engine.sma(closes, 10).slice(0, 250), engine.sma(mutated, 10).slice(0, 250));
    assert.deepEqual(engine.realizedVol(closes, 20).slice(0, 250), engine.realizedVol(mutated, 20).slice(0, 250));
  });

  await test('simulation equity up to day k is unchanged when bars after k are mutated', () => {
    const r = prng(11);
    const uc = []; let p = 100;
    for (let i = 0; i < 200; i++) { p *= 1 + (r() - 0.47) * 0.02; uc.push(p); }
    const uc2 = uc.map((c, i) => (i > 120 ? c * (0.6 + r()) : c));
    const run = (u) => {
      const al = mkAligned({ uClose: u, tOpen: u.map((x) => x * 0.999), tClose: u });
      return engine.simulate(al, engine.s1Signals(u, { n: 10, bandPct: 0 }), { base: 9, end: 199 }).equity;
    };
    assert.deepEqual(run(uc).slice(0, 112), run(uc2).slice(0, 112)); // day 121 is index 112 of the curve (base 9); its fill uses weights[120]
  });

  await test('fill is the NEXT bar open (exact price), signal date recorded', () => {
    const n = 30;
    const tOpen = Array.from({ length: n }, (_, i) => 50 + 0.37 * i + (i % 3) * 0.11);
    const al = mkAligned({ uClose: rising(n), tOpen, tClose: tOpen.map((o) => o + 0.2) });
    const w = engine.s1Signals(al.u.map((b) => b.close), { n: 5, bandPct: 0 });
    assert.equal(w[4], 1);
    const sim = engine.simulate(al, w, { base: 4, slippageBps: 5 });
    const tr = sim.trades[0];
    assert.equal(tr.side, 'buy');
    assert.equal(tr.date, al.dates[5]);
    assert.equal(tr.signalDate, al.dates[4]);
    near(tr.fillPrice, tOpen[5] * 1.0005, 1e-12);
    assert.notEqual(tr.fillPrice, tOpen[4] * 1.0005);
    assert.equal(tr.midOpen, tOpen[5]);
  });

  await test('warm-up: no signal and no fill before the longest window is full', () => {
    const n = 60;
    const closes = rising(n);
    const w = engine.s1Signals(closes, { n: 5, bandPct: 0 });
    assert.ok(w.slice(0, 4).every((x) => x === null) && w[4] === 1);
    const w30 = engine.s1Signals(closes, { n: 5, bandPct: 0, warmupBars: 30 });
    assert.ok(w30.slice(0, 29).every((x) => x === null) && w30[29] === 1);
    const al = mkAligned({ uClose: closes });
    const ev = engine.evaluateConfig(al, { family: 'S1', params: { n: 5, bandPct: 0 }, leverage: 1 }, { warmupBars: 30, slippageBps: 5 });
    assert.equal(ev.sim.trades[0].date, al.dates[30]); // first signal index 29, first fill index 30
    assert.ok(ev.sim.trades.every((t) => al.dates.indexOf(t.date) >= 30));
    // S2 / S3 respect the longest window too
    const s2 = engine.s2Signals(closes, { slow: 12, trailingDDPct: 10, fast: 5 });
    assert.ok(s2.slice(0, 11).every((x) => x === null) && s2[11] !== null);
  });

  await test('slippage is charged per side (buy at open*(1+s), sell at open*(1-s))', () => {
    const uc = [...rising(14), 60, 55, 50, 45, 40, 35];
    const tOpen = uc.map((_, i) => 200 + i);
    const al = mkAligned({ uClose: uc, tOpen, tClose: tOpen });
    const w = engine.s1Signals(uc, { n: 5, bandPct: 0 });
    for (const bps of [0, 5, 15]) {
      const sim = engine.simulate(al, w, { base: 4, slippageBps: bps });
      const buy = sim.trades.find((t) => t.side === 'buy'), sell = sim.trades.find((t) => t.side === 'sell');
      assert.ok(buy && sell);
      near(buy.fillPrice, buy.midOpen * (1 + bps / 10000), 1e-9);
      near(sell.fillPrice, sell.midOpen * (1 - bps / 10000), 1e-9);
      assert.equal(sim.roundTrips.length, 1);
    }
    const cost = (bps) => engine.simulate(al, w, { base: 4, slippageBps: bps }).equity.at(-1);
    assert.ok(cost(0) > cost(5) && cost(5) > cost(15));
  });

  await test('same-day open+close round trip is forbidden', () => {
    const r = prng(3);
    const uc = Array.from({ length: 200 }, () => 100 + r() * 4); // choppy: many flips
    const al = mkAligned({ uClose: uc });
    const sim = engine.simulate(al, engine.s1Signals(uc, { n: 3, bandPct: 0 }), { base: 2, slippageBps: 5 });
    assert.ok(sim.roundTrips.length > 10);
    assert.ok(sim.roundTrips.every((rt) => rt.entryDate !== rt.exitDate));
    const dates = sim.trades.map((t) => t.date);
    assert.equal(new Set(dates).size, dates.length, 'at most one fill per day');
    assert.throws(() => engine.assertNoSameDayRoundTrip([{ entryDate: '2020-01-02', exitDate: '2020-01-02' }]), /same-day/);
    engine.assertNoSameDayRoundTrip([{ entryDate: '2020-01-02', exitDate: '2020-01-03' }]);
  });

  await test('S1 hysteresis: stays long inside the band, flat inside the band after an exit', () => {
    const closes = [100, 100, 100, 100, 100, 103, 100.5, 95, 99.5];
    const w = engine.s1Signals(closes, { n: 5, bandPct: 1 });
    assert.deepEqual(w.slice(4), [0, 1, 1, 0, 0]);
    // with no band the same series flips on the SMA
    const w0 = engine.s1Signals(closes, { n: 5, bandPct: 0 });
    assert.equal(w0[8], 0); // 99.5 < 99.6 SMA
  });

  await test('S2 fast exit (close < SMA fast) and entry conditions', () => {
    const closes = [100, 101, 102, 103, 104, 105, 106, 107, 108, 100];
    const w = engine.s2Signals(closes, { slow: 6, trailingDDPct: 10, fast: 3 });
    assert.ok(w.slice(0, 5).every((x) => x === null));
    assert.deepEqual(w.slice(5), [1, 1, 1, 1, 0]); // exits at idx 9: 100 < SMA3 = 105 (drawdown only 7.4%)
    // a series in a downtrend never enters (SMA fast < slow)
    const down = engine.s2Signals(rising(40, 200, -1), { slow: 10, trailingDDPct: 10, fast: 3 });
    assert.ok(down.filter((x) => x !== null).every((x) => x === 0));
  });

  await test('S2 trailing drawdown is measured on the UNDERLYING close since entry, not on the traded ETF or older peaks', () => {
    const closes = [200, 180, 160, 140, 120, 100, 101, 102, 103, 104, 100, 93];
    const w = engine.s2Signals(closes, { slow: 4, trailingDDPct: 10, fast: 1 }); // fast=1 disables the fast exit
    assert.deepEqual(w.slice(3), [0, 0, 0, 0, 0, 1, 1, 1, 0]); // enters idx 8; 200 peak ignored; exit idx 11 (93 is 10.6% below 104)
    // the traded ETF crashes earlier (idx 9) yet the exit fill comes from the underlying's signal on idx 11 -> fill idx 12
    const tClose = closes.map((_, i) => (i < 9 ? 300 : 120));
    const al = mkAligned({ uClose: closes.concat([95]), tOpen: tClose.concat([120]), tClose: tClose.concat([120]) });
    const ev = engine.evaluateConfig(al, { family: 'S2', params: { slow: 4, trailingDDPct: 10, fast: 1 }, leverage: 3 }, { slippageBps: 0 });
    const sell = ev.sim.trades.find((t) => t.side === 'sell');
    assert.equal(sell.date, al.dates[12]);
    assert.equal(sell.signalDate, al.dates[11]);
  });

  await test('S2 re-entry: level (default) vs only after the condition has gone false (rearm)', () => {
    const closes = [60, 60, 60, 60, 100, 88, 89, 90];
    const level = engine.s2Signals(closes, { slow: 4, trailingDDPct: 10, fast: 1 });
    assert.deepEqual(level.slice(3), [0, 1, 0, 1, 1]); // exit idx5 on DD, entry condition still true -> re-enter idx 6
    const re = engine.s2Signals(closes, { slow: 4, trailingDDPct: 10, fast: 1, rearm: true });
    assert.deepEqual(re.slice(3), [0, 1, 0, 0, 0]);
  });

  await test('S2 matches a naive reference implementation on a random series', () => {
    const r = prng(99);
    const c = []; let p = 100;
    for (let i = 0; i < 500; i++) { p *= 1 + (r() - 0.48) * 0.03; c.push(p); }
    const fast = 5, slow = 20, dd = 0.07;
    const m = (i, n) => c.slice(i - n + 1, i + 1).reduce((a, b) => a + b, 0) / n;
    const ref = []; let st = 0, peak = 0;
    for (let i = 0; i < c.length; i++) {
      if (i < slow - 1) { ref.push(null); continue; }
      if (st === 1) { peak = Math.max(peak, c[i]); if (c[i] < m(i, fast) || 1 - c[i] / peak >= dd - 1e-12) st = 0; } else if (m(i, fast) > m(i, slow) && c[i] > m(i, slow)) { st = 1; peak = c[i]; }
      ref.push(st);
    }
    assert.deepEqual(engine.s2Signals(c, { slow, trailingDDPct: 7, fast }), ref);
  });

  await test('S3 weight = min(1, target / (leverage * realised vol)) when gated long, 0 when gate flat', () => {
    const r = prng(5);
    const c = []; let p = 100;
    for (let i = 0; i < 120; i++) { p *= 1 + 0.002 + (r() - 0.5) * 0.02; c.push(p); }
    const w = engine.s3Signals(c, { n: 30, bandPct: 0, targetVolPct: 20, leverage: 3 });
    const gate = engine.s1Signals(c, { n: 30, bandPct: 0, warmupBars: 21 });
    const vol = engine.realizedVol(c, 20);
    for (let i = 0; i < c.length; i++) {
      if (gate[i] === null) assert.equal(w[i], null);
      else if (gate[i] === 0) assert.equal(w[i], 0);
      else near(w[i], Math.min(1, 0.20 / (3 * vol[i])), 1e-12);
    }
    assert.ok(w.some((x) => x !== null && x > 0 && x < 1), 'a partial weight occurs');
  });

  await test('no expense ratio: a constant-return ETF earns exactly its own return, minus slippage only', () => {
    const n = 80, r = 0.001;
    const tClose = Array.from({ length: n }, (_, i) => 100 * (1 + r) ** i);
    const tOpen = tClose.map((c, i) => (i === 0 ? c : tClose[i - 1] * (1 + r / 2)));
    const al = mkAligned({ uClose: rising(n), tOpen, tClose });
    const w = engine.s1Signals(al.u.map((b) => b.close), { n: 5, bandPct: 0 });
    const s0 = engine.simulate(al, w, { base: 4, slippageBps: 0, initialEquity: 1 });
    for (let k = 2; k < s0.equity.length; k++) near(s0.equity[k] / s0.equity[k - 1], 1 + r, 1e-12);
    near(s0.equity.at(-1), tClose.at(-1) / tOpen[5], 1e-12);
    const s5 = engine.simulate(al, w, { base: 4, slippageBps: 5, initialEquity: 1 });
    near(s5.equity.at(-1), (tClose.at(-1) / tOpen[5]) / 1.0005, 1e-12);
  });

  await test('cash leg: BIL adjusted return accrues while out of the market', () => {
    const n = 40;
    const cClose = Array.from({ length: n }, (_, i) => 100 * 1.0002 ** i);
    const cOpen = cClose.map((c, i) => (i === 0 ? c : cClose[i - 1] * 1.0001));
    const al = mkAligned({ uClose: rising(n, 200, -1), cOpen, cClose }); // downtrend: never long
    const sim = engine.simulate(al, engine.s1Signals(al.u.map((b) => b.close), { n: 5, bandPct: 0 }), { base: 4, slippageBps: 5, initialEquity: 50 });
    assert.equal(sim.trades.length, 0);
    near(sim.equity.at(-1), 50 * cClose[n - 1] / cClose[4], 1e-9);
  });

  await test('whole-share variant: $20 cap sizing, remainder in BIL, cannotBuy when one share exceeds the cap', () => {
    const n = 30;
    const cheap = mkAligned({ uClose: rising(n), tOpen: new Array(n).fill(5), tClose: new Array(n).fill(5), cClose: Array.from({ length: n }, (_, i) => 100 * 1.001 ** i), cOpen: Array.from({ length: n }, (_, i) => 100 * 1.001 ** i) });
    const w = engine.s1Signals(cheap.u.map((b) => b.close), { n: 5, bandPct: 0 });
    const s = engine.simulate(cheap, w, { base: 4, variant: 'wholeShare', slippageBps: 5, initialEquity: 50, cap: 20 });
    assert.equal(s.trades[0].qty, 4); // floor(min(20, 50) / 5)
    assert.equal(s.cannotBuy.length, 0);
    assert.ok(s.equity.at(-1) > 50 - 0.02); // 30 dollars in BIL keeps compounding; only slippage on the 20 is lost
    const dear = mkAligned({ uClose: rising(n), tOpen: new Array(n).fill(25), tClose: new Array(n).fill(25) });
    const d = engine.simulate(dear, engine.s1Signals(dear.u.map((b) => b.close), { n: 5, bandPct: 0 }), { base: 4, variant: 'wholeShare', slippageBps: 5, initialEquity: 50, cap: 20 });
    assert.equal(d.trades.length, 0);
    assert.ok(d.cannotBuy.length > 0 && d.cannotBuy[0].open === 25);
    near(d.equity.at(-1), 50, 1e-9); // stays in flat BIL
    // equity below the cap: cost with slippage must be affordable
    const flatCash = mkAligned({ uClose: rising(n), tOpen: new Array(n).fill(5), tClose: new Array(n).fill(5) });
    const poor = engine.simulate(flatCash, w, { base: 4, variant: 'wholeShare', slippageBps: 5, initialEquity: 10, cap: 20 });
    assert.equal(poor.trades[0].qty, 1); // floor(10/5)=2 would cost 10.005 > 10
    // exit sells every share
    const uc = [...rising(14), 60, 55, 50, 45];
    const ex = mkAligned({ uClose: uc, tOpen: uc.map(() => 5), tClose: uc.map(() => 5) });
    const e = engine.simulate(ex, engine.s1Signals(uc, { n: 5, bandPct: 0 }), { base: 4, variant: 'wholeShare', slippageBps: 0, initialEquity: 50 });
    assert.equal(e.roundTrips.length, 1);
    assert.equal(e.trades.at(-1).qty, 4);
  });

  await test('fractional variant respects the $ cap on entry (regression: 2026-09-29 -- the cap used to be silently ignored here, only enforced in wholeShare)', () => {
    const compound = (n, start, dailyPct) => Array.from({ length: n }, (_, i) => start * (1 + dailyPct) ** i);
    // A strong, sustained uptrend so equity compounds well past the cap before the strategy exits.
    const n = 60;
    const uc = compound(n, 10, 0.02); // 2%/day -> ~3.3x underlying by day 60, plenty of compounding room
    const big = mkAligned({ uClose: uc, tOpen: uc, tClose: uc });
    const w = engine.s1Signals(uc, { n: 5, bandPct: 0 }); // long almost immediately, stays long (rising trend)
    const s = engine.simulate(big, w, { base: 4, variant: 'fractional', slippageBps: 0, initialEquity: 50, cap: 20 });
    assert.ok(s.trades.length >= 1, 'expected at least one entry');
    const entry = s.trades[0];
    assert.ok(entry.qty * entry.fillPrice <= 20 + 1e-9, `entry notional ${entry.qty * entry.fillPrice} must not exceed the $20 cap`);
    // Equity keeps compounding well past $50+cap over the run (proves the scenario actually exercises the bug's
    // failure mode -- the old code sized off this larger number with no cap at all).
    assert.ok(s.equity.at(-1) > 70, `equity should compound well past the cap (got ${s.equity.at(-1)})`);
    // No order after the entry while still holding (S1 stays long => no rebalancing top-up mid-holding).
    assert.equal(s.trades.length, 1, 'no second buy while already holding (C1 cannot place a second order on an open position)');

    // Re-entry after a full exit is capped fresh at $20, not at 40% of whatever the (now larger) equity has grown to.
    const up1 = compound(20, 10, 0.02);
    const down = Array.from({ length: 10 }, (_, i) => up1.at(-1) * (1 - 0.02) ** (i + 1));
    const up2 = compound(20, down.at(-1), 0.02);
    const uc2 = [...up1, ...down, ...up2];
    const roundTrip = mkAligned({ uClose: uc2, tOpen: uc2, tClose: uc2 });
    const w2 = engine.s1Signals(uc2, { n: 5, bandPct: 1 });
    const rt = engine.simulate(roundTrip, w2, { base: 4, variant: 'fractional', slippageBps: 0, initialEquity: 50, cap: 20 });
    const buys = rt.trades.filter((t) => t.side === 'buy');
    assert.ok(buys.length >= 2, `expected a re-entry after the exit (got ${buys.length} buys)`);
    for (const tr of buys) {
      assert.ok(tr.qty * tr.fillPrice <= 20 + 1e-9, `every buy must be capped at $20, got ${tr.qty * tr.fillPrice} on ${tr.date}`);
    }

    // S3's continuous vol-target weight changes while holding are ignored (no path for C1 to place a second order
    // on an open position) -- assert the fractional simulator never trades on a nonzero-to-nonzero weight change.
    const volSeries = compound(n, 10, 0.03);
    const volBars = mkAligned({ uClose: volSeries, tOpen: volSeries, tClose: volSeries });
    const w3 = engine.s3Signals(volSeries, { n: 5, bandPct: 0, targetVolPct: 20, leverage: 3, volWindow: 5, warmupBars: 5 });
    const s3 = engine.simulate(volBars, w3, { base: 5, variant: 'fractional', slippageBps: 0, initialEquity: 50, cap: 20 });
    // Every buy happens while flat (side sell always fully closes before the next buy), never a second buy while
    // shares > 0, and never a partial resize.
    let heldShares = 0;
    for (const tr of s3.trades) {
      if (tr.side === 'buy') assert.equal(heldShares, 0, `bought while already holding ${heldShares} shares on ${tr.date} -- S3 weight changes mid-holding must be ignored`);
      heldShares = tr.side === 'buy' ? tr.qty : 0;
    }
  });

  await test('metrics on hand-computed equity curves (CAGR, max DD, Calmar, ulcer, Sharpe, worst month)', () => {
    const eq = [1, 1.1, 0.99, ...new Array(250).fill(0.99)]; // 252 daily returns => 1 year
    const dates = weekdays('2020-01-01', eq.length);
    const m = engine.computeMetrics(eq, dates);
    assert.equal(m.nDays, 252);
    near(m.cagr, -0.01, 1e-12);
    near(m.totalReturn, -0.01, 1e-12);
    near(m.maxDD, 0.1, 1e-12);
    near(m.calmar, -0.1, 1e-12);
    near(m.ulcer, Math.sqrt((251 * 100) / 253), 1e-9);
    const up = [1, 1.2, 1.08, ...new Array(250).fill(1.08)];
    const mu = engine.computeMetrics(up, dates);
    near(mu.cagr, 0.08, 1e-12); near(mu.maxDD, 0.1, 1e-12); near(mu.calmar, 0.8, 1e-12);
    const sh = engine.computeMetrics([100, 101, 104.03], ['2020-01-01', '2020-01-02', '2020-01-03']);
    near(sh.sharpe, Math.SQRT2 * Math.sqrt(252), 1e-9); // returns 0.01, 0.03: mean 0.02, sd(n-1) 0.01*sqrt2
    const wm = engine.computeMetrics([100, 90, 99, 89.1], ['2020-01-30', '2020-01-31', '2020-02-03', '2020-02-04']);
    assert.equal(wm.worstMonth.month, '2020-01');
    near(wm.worstMonth.ret, -0.10, 1e-12);
    const half = engine.computeMetrics([1, 1.5, 1.5], ['2020-01-01', '2020-01-02', '2020-01-03']); // 2 returns
    near(half.cagr, 1.5 ** (252 / 2) - 1, 1e-6 * half.cagr);
  });

  await test('evaluateConfig: window base is the close before the window; buy-and-hold uses the same fill rule', () => {
    const n = 100;
    const al = mkAligned({ uClose: rising(n), tOpen: rising(n, 50, 0.5), tClose: rising(n, 50.2, 0.5) });
    const ev = engine.evaluateConfig(al, { family: 'S1', params: { n: 5, bandPct: 0 }, leverage: 1 }, { window: { start: al.dates[60] }, slippageBps: 5 });
    assert.equal(ev.window.base, 59);
    assert.equal(ev.sim.dates[0], al.dates[59]);
    assert.equal(ev.sim.trades[0].date, al.dates[60]); // state long carried from history: enter at the first window open
    assert.equal(ev.benchmarks.traded.sim.trades[0].date, al.dates[60]);
    near(ev.benchmarks.traded.sim.trades[0].fillPrice, al.t[60].open * 1.0005, 1e-12);
    assert.equal(ev.metrics.startDate, al.dates[59]);
  });

  await test('evaluateConfig: benchmarks are NOT capped even when the strategy is (regression: 2026-09-29 -- fixing the strategy cap bug initially broke the benchmark too, turning "buy-and-hold" into a single $cap entry + idle cash)', () => {
    const compound = (n, start, dailyPct) => Array.from({ length: n }, (_, i) => start * (1 + dailyPct) ** i);
    const n = 40;
    const uc = compound(n, 10, 0.02);
    const al = mkAligned({ uClose: uc, tOpen: uc, tClose: uc });
    const ev = engine.evaluateConfig(al, { family: 'S1', params: { n: 5, bandPct: 0 }, leverage: 1 }, { slippageBps: 0, initialEquity: 50, cap: 20 });
    // The strategy itself IS capped at entry.
    const stratEntry = ev.sim.trades[0];
    assert.ok(stratEntry.qty * stratEntry.fillPrice <= 20 + 1e-9, 'strategy entry must respect the $20 cap');
    // The traded-ETF buy-and-hold benchmark is NOT capped: it puts the whole $50 in on day 1, not $20 + idle cash.
    const bh = ev.benchmarks.traded.sim;
    assert.equal(bh.trades.length, 1, 'buy-and-hold makes exactly one entry and never sells');
    assert.ok(bh.trades[0].qty * bh.trades[0].fillPrice > 45, `buy-and-hold entry should use ~all $50, got ${bh.trades[0].qty * bh.trades[0].fillPrice}`);
    // Over the run the benchmark's equity should reflect full exposure to the underlying's ~2x+ compounding move,
    // not a 40%-invested/60%-idle-cash line -- it must end up noticeably ahead of the (correctly) capped strategy
    // equity on this same strong-uptrend series, since the strategy only ever risked $20 of the $50.
    assert.ok(bh.equity.at(-1) > ev.sim.equity.at(-1), `uncapped buy-and-hold (${bh.equity.at(-1)}) should end above the $20-capped strategy (${ev.sim.equity.at(-1)}) on a strong uptrend`);
  });

  await test('bootstrap: seeded moving-block CI is reproducible and seed-dependent', () => {
    const r = prng(1);
    const a = Array.from({ length: 300 }, () => (r() - 0.5) * 0.02), b = Array.from({ length: 300 }, () => (r() - 0.5) * 0.02);
    const x = engine.movingBlockBootstrapCI(a, b, { seed: 42, reps: 500 });
    const y = engine.movingBlockBootstrapCI(a, b, { seed: 42, reps: 500 });
    assert.deepEqual(x, y);
    assert.notDeepEqual(x, engine.movingBlockBootstrapCI(a, b, { seed: 43, reps: 500 }));
    assert.ok(x.low < x.high);
    const c = engine.movingBlockBootstrapCI(new Array(100).fill(0.002), new Array(100).fill(0.001), { seed: 1, reps: 50 });
    near(c.low, 0.252, 1e-12); near(c.high, 0.252, 1e-12); assert.equal(c.excludesZero, true);
  });

  await test('normal cdf / quantile / erf against known values', () => {
    near(engine.erf(1), 0.8427007929497149, 1e-12);
    near(engine.normCdf(0), 0.5, 1e-15);
    near(engine.normCdf(1.959963984540054), 0.975, 1e-9);
    near(engine.normInv(0.975), 1.959963984540054, 1e-8);
    near(engine.normInv(0.9), 1.2815515655446004, 1e-8);
    for (const x of [-3, -1.5, -0.2, 0.7, 2.4, 3.1]) near(engine.normInv(engine.normCdf(x)), x, 1e-7);
  });

  await test('deflated Sharpe: high SR -> ~1, SR below SR0 -> ~0, more trials -> lower', () => {
    const base = { T: 1000, skew: 0, kurt: 3 };
    const hi = engine.deflatedSharpe({ ...base, sr: 0.2, N: 186 });
    const lo = engine.deflatedSharpe({ ...base, sr: 0.0, N: 186 });
    assert.ok(hi.dsr > 0.999, `hi ${hi.dsr}`);
    assert.ok(lo.dsr < 0.01, `lo ${lo.dsr}`);
    const few = engine.deflatedSharpe({ ...base, sr: 0.1, N: 10 }), many = engine.deflatedSharpe({ ...base, sr: 0.1, N: 1000 });
    assert.ok(few.dsr > many.dsr && few.sr0 < many.sr0);
    // SR0 per the prereg formula
    const v = 1 / 999;
    near(few.sr0, Math.sqrt(v) * (0.4227843350984671 * engine.normInv(0.9) + 0.5772156649015329 * engine.normInv(1 - 1 / (10 * Math.E))), 1e-12);
    const fromRets = engine.deflatedSharpeFromReturns(Array.from({ length: 500 }, (_, i) => 0.001 + (i % 2 ? 0.01 : -0.01)), 186);
    assert.ok(fromRets.dsr >= 0 && fromRets.dsr <= 1 && fromRets.T === 500);
  });

  await test('sanity check flags tracking errors and absurd returns, not normal leveraged moves', () => {
    const d = weekdays('2020-01-01', 5);
    const u = [100, 101, 102, 103, 104].map((c, i) => bar(d[i], c, c));
    const good = [100, 103, 106.09, 109.27, 112.55].map((c, i) => bar(d[i], c, c));
    assert.equal(engine.sanityCheckPair(u, good, 3).length, 0);
    const bad = [100, 103, 106.09, 140, 112.55].map((c, i) => bar(d[i], c, c));
    assert.ok(engine.sanityCheckPair(u, bad, 3).some((f) => f.kind === 'tracking'));
  });

  const preregPath = cli.PATHS.prereg, shaPath = cli.PATHS.sha;
  const prereg = cli.loadPrereg(preregPath);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lev-selftest-'));
  const noBars = () => { throw new Error('loadBars must not be called'); };

  await test('prereg: real file verifies; grids, pair count and N=186 agree', () => {
    assert.equal(cli.verifyPrereg(preregPath, shaPath).ok, true);
    assert.equal(cli.trialCount(prereg), 186);
    assert.equal(cli.gridFor(prereg, 'S1').length, 20);
    assert.equal(cli.gridFor(prereg, 'S2').length, 9);
    assert.equal(cli.gridFor(prereg, 'S3').length, 2);
    assert.equal(cli.pairsOf(prereg).length, 6);
    const nb = cli.neighbours(prereg, 'S1', { n: 150, bandPct: 0 });
    assert.deepEqual(nb, [{ n: 175, bandPct: 0 }, { n: 150, bandPct: 1 }]);
    assert.equal(cli.neighbours(prereg, 'S1', { n: 200, bandPct: 2 }).length, 4);
    assert.equal(cli.neighbours(prereg, 'S2', { slow: 150, trailingDDPct: 15 }).length, 2);
    assert.equal(cli.betterOnTune(1, { n: 200, bandPct: 1 }, 1, { n: 175, bandPct: 3 }), true, 'tie -> larger n');
    assert.equal(cli.betterOnTune(1, { n: 200, bandPct: 1 }, 1, { n: 200, bandPct: 2 }), false, 'tie -> larger band');
    assert.equal(cli.betterOnTune(1.1, { n: 150, bandPct: 0 }, 1, { n: 250, bandPct: 3 }), true);
  });

  await test('prereg hash refusal: a modified copy fails --verify-prereg and every mode refuses', async () => {
    const copy = path.join(tmp, 'prereg-modified.json');
    fs.writeFileSync(copy, fs.readFileSync(preregPath, 'utf8') + ' ');
    const v = cli.verifyPrereg(copy, shaPath);
    assert.equal(v.ok, false);
    const logs = [];
    for (const mode of ['--verify-prereg', '--tune', '--test']) {
      const code = await cli.main([mode], { paths: { prereg: copy, sha: shaPath, frozen: path.join(tmp, 'x.json'), results: path.join(tmp, 'x.md') }, loadBars: noBars, log: (s) => logs.push(s) });
      assert.notEqual(code, 0, mode);
    }
    assert.ok(logs.every((l) => /REFUSED/.test(l)));
    const real = spawnSync(process.execPath, [path.join(__dirname, 'backtest-lev-trend.js'), '--verify-prereg'], { encoding: 'utf8' });
    assert.equal(real.status, 0, real.stdout + real.stderr);
  });

  await test('--test refuses without the frozen-configs file (and never loads bars)', async () => {
    const logs = [];
    const code = await cli.main(['--test'], { paths: { frozen: path.join(tmp, 'does-not-exist.json'), results: path.join(tmp, 'r.md') }, loadBars: noBars, log: (s) => logs.push(s) });
    assert.equal(code, 3);
    assert.ok(logs.some((l) => /REFUSED/.test(l)));
    assert.equal(fs.existsSync(path.join(tmp, 'r.md')), false);
    // frozen for a different prereg hash is refused too
    const other = path.join(tmp, 'other-frozen.json');
    fs.writeFileSync(other, JSON.stringify({ preregSha256: 'deadbeef', selections: [] }));
    assert.equal(await cli.main(['--test'], { paths: { frozen: other, results: path.join(tmp, 'r.md') }, loadBars: noBars, log: () => {} }), 3);
  });

  await test('pass rule: PASS / FAIL / INCONCLUSIVE and each criterion', () => {
    const mk = (over = {}) => ({
      base: { strat: { maxDD: 0.3, calmar: 1.2, cagr: 0.3 }, tradedBH: { maxDD: 0.6, calmar: 0.5 }, underBH: { cagr: 0.15 } },
      stress: { strat: { maxDD: 0.3, calmar: 1.1, cagr: 0.28 }, tradedBH: { maxDD: 0.6, calmar: 0.5 }, underBH: { cagr: 0.15 } },
      roundTrips: 8, sharpe: 1.0, neighbourSharpes: [0.95, 1.1], ...over,
    });
    assert.equal(cli.judgePrimary(mk()).verdict, 'PASS');
    assert.equal(cli.judgePrimary(mk({ roundTrips: 4 })).verdict, 'INCONCLUSIVE');
    assert.equal(cli.judgePrimary(mk({ neighbourSharpes: [1.2] })).verdict, 'FAIL'); // |dSharpe| 0.2 >= 0.15
    const stressFail = mk(); stressFail.stress.strat.cagr = 0.1;
    assert.equal(cli.judgePrimary(stressFail).verdict, 'FAIL');
    const ddFail = mk(); ddFail.base.strat.maxDD = 0.7;
    const j = cli.judgePrimary(ddFail);
    assert.equal(j.verdict, 'FAIL'); assert.equal(j.criteria[0].pass, false);
    assert.equal(cli.judgePrimary(mk({ roundTrips: 2, neighbourSharpes: [2] })).verdict, 'FAIL'); // substantive failure beats few trips
  });

  await test('end-to-end on synthetic bars: tune ignores post-tuneEnd data; test writes a full report', async () => {
    const symbols = prereg.data.symbols;
    const dates = weekdays('2015-01-02', 2450); // through ~2024-06
    const build = (seed, futureSeed) => {
      const rU = prng(seed), rF = prng(futureSeed);
      const out = {};
      const mk = (leverages) => {
        const closes = { QQQ: [], SPY: [] }, opens = { QQQ: [], SPY: [] };
        for (const k of ['QQQ', 'SPY']) {
          let p = 100; const rr = k === 'QQQ' ? rU : prng(seed + 1);
          const rrF = k === 'QQQ' ? rF : prng(futureSeed + 1);
          dates.forEach((d, i) => {
            const rnd = d > prereg.windows.tuneEnd ? rrF : rr;
            const regime = d >= '2022-01-03' && d < '2022-11-01' ? -0.0015 : 0.0006;
            const gap = (rnd() - 0.5) * 0.004, intra = regime + (rnd() - 0.5) * 0.016;
            const prev = i === 0 ? p : closes[k][i - 1];
            opens[k].push(prev * (1 + gap));
            closes[k].push(opens[k][i] * (1 + intra));
            p = closes[k][i];
          });
        }
        return { closes, opens, leverages };
      };
      const m = mk();
      const etf = (u, L) => {
        const c = [], o = [];
        dates.forEach((d, i) => {
          const pc = i === 0 ? 100 : c[i - 1], pu = i === 0 ? m.closes[u][0] : m.closes[u][i - 1];
          o.push(pc * (1 + L * (m.opens[u][i] / pu - 1)));
          c.push(pc * (1 + L * (m.closes[u][i] / pu - 1)));
        });
        return { o, c };
      };
      const barsOf = (o, c) => dates.map((d, i) => bar(d, o[i], c[i]));
      for (const u of ['QQQ', 'SPY']) out[u] = barsOf(m.opens[u], m.closes[u]);
      for (const [t, u, L] of [['TQQQ', 'QQQ', 3], ['QLD', 'QQQ', 2], ['UPRO', 'SPY', 3], ['SSO', 'SPY', 2]]) { const e = etf(u, L); out[t] = barsOf(e.o, e.c); }
      for (const s of ['BIL', 'SHY']) {
        const c = dates.map((d, i) => 100 * 1.00004 ** (2 * i + 1)), o = dates.map((d, i) => 100 * 1.00004 ** (2 * i));
        out[s] = barsOf(o, c);
      }
      return out;
    };
    const world = build(21, 500), worldB = build(21, 999); // same past, different post-tuneEnd data
    assert.deepEqual(Object.keys(world).sort(), [...symbols].sort());
    const paths = (name) => ({ prereg: preregPath, sha: shaPath, frozen: path.join(tmp, `${name}-frozen.json`), results: path.join(tmp, `${name}-results.md`) });
    const pA = paths('a'), pB = paths('b');
    const logsA = [];
    assert.equal(await cli.main(['--tune'], { paths: pA, loadBars: (s) => world[s], log: (s) => logsA.push(s) }), 0, logsA.join('\n'));
    assert.equal(await cli.main(['--tune'], { paths: pB, loadBars: (s) => worldB[s], log: () => {} }), 0);
    const fa = JSON.parse(fs.readFileSync(pA.frozen, 'utf8')), fb = JSON.parse(fs.readFileSync(pB.frozen, 'utf8'));
    assert.deepEqual(fa, fb, 'tune result must not depend on data after tuneEnd');
    assert.equal(fa.selections.length, 18);
    assert.ok(fa.selections.every((s) => s.tuneWindow.end <= prereg.windows.tuneEnd));
    assert.equal(fa.preregSha256, cli.verifyPrereg(preregPath, shaPath).actual);
    const logsT = [];
    assert.equal(await cli.main(['--test'], { paths: pA, loadBars: (s) => world[s], log: (s) => logsT.push(s) }), 0, logsT.join('\n'));
    const md = fs.readFileSync(pA.results, 'utf8');
    for (const d of prereg.disclosures) assert.ok(md.includes(d), `disclosure missing: ${d}`);
    assert.ok(md.includes(prereg.passRule.meaning));
    assert.ok(/Verdict on the two primary hypotheses: (PASS|FAIL|INCONCLUSIVE)/.test(md));
    assert.ok(md.includes('first available date') && md.includes('2015-01-02'));
    assert.ok(md.includes('Whole-share') && md.includes('stress') && md.includes('Decomposition') && md.includes('Deflated Sharpe'));
    assert.ok(/Test window 2022-01-0\d/.test(md));
    assert.ok(logsT.some((l) => /OVERALL/.test(l)));
    // report is a function of the frozen configs + test-window data only: identical when the frozen file is reused with the same data
    assert.equal(await cli.main(['--test'], { paths: { ...pA, results: path.join(tmp, 'again.md') }, loadBars: (s) => world[s], log: () => {} }), 0);
    assert.equal(fs.readFileSync(path.join(tmp, 'again.md'), 'utf8'), md);
  });

  // ------------------------------------------------------------- descriptive mode (prereg v2)
  const v2Path = path.join(__dirname, 'data', 'lev-backtest-prereg.v2.json');
  const v2Sha = cli.shaPathFor(v2Path);
  const v2 = cli.loadPrereg(v2Path);

  // Synthetic world for the descriptive mode: starts BEFORE 2020-07-27 (those bars must be dropped), SPY has a wild stray
  // 2018-11-01 bar, BIL lacks a few dates.  regime(date) -> underlying drift per day.
  function descWorld(regime, seed = 5) {
    const dates = weekdays('2020-05-01', 1500);
    const r = prng(seed);
    const mkU = () => {
      const c = [], o = []; let p = 100;
      dates.forEach((d, i) => {
        const open = p * (1 + (r() - 0.5) * 0.002);
        const close = open * (1 + regime(d) + (r() - 0.5) * 0.004);
        o.push(open); c.push(close); p = close;
      });
      return { o, c };
    };
    const U = { QQQ: mkU(), SPY: mkU() };
    const etf = (u, L) => {
      const o = [], c = [];
      dates.forEach((d, i) => {
        const pc = i === 0 ? 100 : c[i - 1], pu = i === 0 ? U[u].c[0] : U[u].c[i - 1];
        o.push(pc * (1 + L * (U[u].o[i] / pu - 1)));
        c.push(pc * (1 + L * (U[u].c[i] / pu - 1)));
      });
      return { o, c };
    };
    const barsOf = (e) => dates.map((d, i) => bar(d, e.o[i], e.c[i]));
    const w = { QQQ: barsOf(U.QQQ), SPY: barsOf(U.SPY) };
    for (const [t, u, L] of [['TQQQ', 'QQQ', 3], ['QLD', 'QQQ', 2], ['UPRO', 'SPY', 3], ['SSO', 'SPY', 2]]) w[t] = barsOf(etf(u, L));
    const cc = dates.map((d, i) => 100 * 1.00004 ** (2 * i + 1)), co = dates.map((d, i) => 100 * 1.00004 ** (2 * i));
    w.BIL = barsOf({ o: co, c: cc });
    w.SHY = barsOf({ o: co, c: cc });
    w.SPY = [bar('2018-11-01', 999, 1000), ...w.SPY];
    const missing = new Set([dates[400], dates[401], dates[700]]);
    w.BIL = w.BIL.filter((b) => !missing.has(b.date));
    return { world: w, dates, missing: [...missing].sort() };
  }
  // strong uptrend, a sharp 2022 bear market (leveraged ETF falls ~90% if held), then a recovery
  const bullBear = (d) => (d >= '2022-01-03' && d < '2022-05-01' ? -0.012 : 0.0012);
  const bullOnly = (d) => (d >= '2022-01-03' && d < '2022-05-01' ? 0.0004 : 0.0012);
  const runDesc = async (world, name, prereg2 = v2Path) => {
    const logs = [];
    const res = path.join(tmp, `${name}.md`), frozen = path.join(tmp, `${name}-frozen.json`);
    const code = await cli.main(['--prereg', prereg2, '--descriptive'], { paths: { descResults: res, frozen }, loadBars: (sym) => world[sym], log: (x) => logs.push(x) });
    return { code, logs, md: fs.existsSync(res) ? fs.readFileSync(res, 'utf8') : null, frozen };
  };

  await test('prereg v2: verifies, is descriptive, N=186 from 31 listed configs, canonical configs sit in the grids, v1 archived intact', () => {
    assert.equal(cli.verifyPrereg(v2Path, v2Sha).ok, true);
    assert.equal(path.basename(v2Sha), 'lev-backtest-prereg.v2.sha256');
    assert.equal(path.basename(cli.shaPathFor(preregPath)), 'lev-backtest-prereg.sha256');
    assert.equal(v2.version, 2);
    assert.equal(v2.mode, 'descriptive');
    assert.equal(cli.trialCount(v2), 186);
    const list = v2.multipleTesting.configList;
    assert.equal(Object.values(list).reduce((a, l) => a + l.length, 0), 31);
    assert.equal(cli.pairsOf(v2).length, 6);
    assert.deepEqual(v2.strategies.S1_trend_band.canonical, { n: 200, bandPct: 2 });
    assert.deepEqual(v2.strategies.S2_dual_fast_exit.canonical, { slow: 200, trailingDDPct: 10 });
    assert.deepEqual(v2.strategies.S3_vol_target.canonical, { targetVolPct: 20 });
    for (const [fam, def] of [['S1', 'S1_trend_band'], ['S2', 'S2_dual_fast_exit'], ['S3', 'S3_vol_target']]) {
      assert.ok(cli.gridFor(v2, fam).some((g) => JSON.stringify(g) === JSON.stringify(v2.strategies[def].canonical)), fam);
    }
    assert.equal(cli.commonWarmup(v2), v2.evaluation.warmupBars);
    assert.ok(v2.disclosures.includes('Sample is 2020-07-27 to 2026-09-25 (~6 years) with essentially one bear market; the tune window is not used; nothing here can establish a durable edge.'));
    assert.equal(JSON.stringify(v2).includes('PASS'), false);
    // v1 is archived byte-for-byte and its recorded hash is unchanged
    const arch = path.join(__dirname, 'data', 'lev-backtest-prereg.v1-archived.json');
    assert.ok(fs.readFileSync(arch).equals(fs.readFileSync(preregPath)));
    assert.equal(v2.supersedes.v1Sha256, fs.readFileSync(shaPath, 'utf8').trim());
  });

  await test('prereg v2 hash refusal: a modified copy is refused by every mode; the real file verifies from the CLI', async () => {
    const copy = path.join(tmp, 'lev-backtest-prereg.v2.json');
    fs.writeFileSync(copy, fs.readFileSync(v2Path, 'utf8') + ' ');
    fs.copyFileSync(v2Sha, path.join(tmp, 'lev-backtest-prereg.v2.sha256')); // derived sha path next to the copy
    assert.equal(cli.verifyPrereg(copy, cli.shaPathFor(copy)).ok, false);
    for (const mode of ['--verify-prereg', '--tune', '--test', '--descriptive']) {
      const logs = [];
      const code = await cli.main(['--prereg', copy, mode], { paths: { frozen: path.join(tmp, 'x.json'), results: path.join(tmp, 'x.md'), descResults: path.join(tmp, 'x-desc.md') }, loadBars: noBars, log: (x) => logs.push(x) });
      assert.notEqual(code, 0, mode);
      assert.ok(logs.every((l) => /REFUSED/.test(l)), mode);
    }
    assert.equal(fs.existsSync(path.join(tmp, 'x-desc.md')), false);
    const missingSha = path.join(tmp, 'nosha', 'lev-backtest-prereg.v2.json');
    fs.mkdirSync(path.dirname(missingSha)); fs.copyFileSync(v2Path, missingSha);
    assert.notEqual(await cli.main(['--prereg', missingSha, '--descriptive'], { loadBars: noBars, log: () => {} }), 0);
    const real = spawnSync(process.execPath, [path.join(__dirname, 'backtest-lev-trend.js'), '--prereg', v2Path, '--verify-prereg'], { encoding: 'utf8' });
    assert.equal(real.status, 0, real.stdout + real.stderr);
    assert.notEqual(await cli.main(['--prereg'], { loadBars: noBars, log: () => {} }), 0, '--prereg without a value is a usage error');
  });

  await test('--descriptive refuses a v1 (tune/test) prereg; --tune/--test refuse the descriptive prereg; modes do not combine', async () => {
    const logs = [];
    assert.equal(await cli.main(['--descriptive'], { loadBars: noBars, log: (x) => logs.push(x) }), 1); // default prereg = v1
    assert.ok(logs.some((l) => /REFUSED.*descriptive/.test(l)));
    assert.equal(await cli.main(['--prereg', preregPath, '--descriptive'], { paths: { descResults: path.join(tmp, 'v1-desc.md') }, loadBars: noBars, log: () => {} }), 1);
    assert.equal(fs.existsSync(path.join(tmp, 'v1-desc.md')), false);
    for (const m of ['--tune', '--test']) {
      const l2 = [];
      assert.equal(await cli.main(['--prereg', v2Path, m], { loadBars: noBars, log: (x) => l2.push(x) }), 1, m);
      assert.ok(l2.some((l) => /REFUSED/.test(l)), m);
    }
    assert.equal(await cli.main(['--prereg', v2Path, '--descriptive', '--tune'], { loadBars: noBars, log: () => {} }), 1);
  });

  await test('descriptive data: bars before 2020-07-27 are dropped and reported; pairs align on common dates', async () => {
    const { world, dates, missing } = descWorld(bullBear);
    const data = await cli.loadDescriptiveData(v2, { loadBars: (sym) => world[sym] });
    for (const sym of v2.data.symbols) assert.ok(data.bars[sym].every((b) => b.date >= '2020-07-27'), sym);
    assert.deepEqual(data.droppedPre.SPY.slice(0, 1), ['2018-11-01']);
    assert.ok(data.droppedPre.QQQ.length > 40 && data.droppedPre.QQQ.every((d) => d < '2020-07-27'));
    assert.equal(data.rawCounts.SPY, world.SPY.length);
    assert.equal(data.firstDates.SPY, '2018-11-01');
    assert.deepEqual(data.flags, [], 'the wild stray bar must not reach the sanity check');
    for (const [k, al] of Object.entries(data.aligned)) {
      for (const d of missing) assert.equal(al.dates.includes(d), false, `${k} still has BIL-missing date ${d}`);
      assert.ok(al.dates[0] >= '2020-07-27');
      assert.equal(al.u.length, al.dates.length); assert.equal(al.c.length, al.dates.length);
    }
    assert.equal(data.aligned['QQQ->TQQQ'].dates.length, dates.filter((d) => d >= '2020-07-27').length - missing.filter((d) => d >= '2020-07-27').length);
    assert.deepEqual(data.alignLost['QQQ->TQQQ'].underlying.dates, missing.filter((d) => d >= '2020-07-27'));
    assert.equal(data.alignLost['QQQ->TQQQ'].cash.dates.length, 0);
    const { md, code } = await runDesc(world, 'drop-align');
    assert.equal(code, 0);
    assert.ok(md.includes('2018-11-01') && md.includes('dropped (before start)') && md.includes('lost to alignment'));
    // a stray pre-start bar that is not dropped would have tripped the sanity gate: confirm the gate itself would have fired
    assert.ok(engine.sanityCheckPair(world.SPY, world.UPRO, 3).length > 0);
  });

  await test('descriptive verdict is never PASS: a dominating strategy gives INCONCLUSIVE, a losing one FAIL, report has no PASS', async () => {
    const dom = await runDesc(descWorld(bullBear).world, 'dominates');
    assert.equal(dom.code, 0, dom.logs.join('\n'));
    assert.ok(dom.logs.some((l) => /DESCRIPTIVE VERDICT.*: INCONCLUSIVE$/.test(l)), dom.logs.join('\n'));
    assert.ok(/Verdict on the two primary hypotheses: INCONCLUSIVE/.test(dom.md));
    assert.equal(dom.md.includes('criteria NOT met'), false, 'the synthetic strategy really does beat every benchmark');
    assert.equal(/\bPASS\b/i.test(dom.md), false);
    assert.equal(dom.logs.some((l) => /\bPASS\b/i.test(l)), false);
    const rt = /Completed round trips on QQQ->TQQQ.*too few for confidence intervals/.exec(dom.md);
    assert.ok(rt, 'round-trip counts and the too-few-for-CI statement are reported');
    for (const d of v2.disclosures) assert.ok(dom.md.includes(d), `disclosure missing: ${d}`);
    assert.ok(dom.md.includes('Deflated Sharpe') && dom.md.includes('Decomposition') && dom.md.includes('Whole-share') && dom.md.includes('stress'));
    for (const span of ['full span', 'calendar 2022', '2023-01-01 onward', 'first half', 'second half']) assert.ok(dom.md.includes(span), span);
    assert.equal(fs.existsSync(dom.frozen), false, 'descriptive mode writes no frozen-config file');
    // a choppy, mean-reverting market (about 10-week swings, slight upward drift): the trend rules whipsaw and lose to buy-and-hold
    const choppy = (d) => 0.0004 + 0.012 * Math.sin((2 * Math.PI * (Date.parse(d) / 86400000)) / 50);
    const lose = await runDesc(descWorld(choppy, 9).world, 'loses');
    assert.equal(lose.code, 0, lose.logs.join('\n'));
    assert.ok(lose.logs.some((l) => /DESCRIPTIVE VERDICT.*: FAIL$/.test(l)), lose.logs.join('\n'));
    assert.equal(/\bPASS\b/i.test(lose.md), false);
    // unit: the judge can only return the two verdicts, whatever the numbers
    const strat = (o) => ({ maxDD: 0.3, calmar: 1.2, cagr: 0.3, ...o });
    const h = (o = {}) => ({ base: { strat: strat(o), tradedBH: { maxDD: 0.6, calmar: 0.5 }, underBH: { cagr: 0.15 } }, roundTrips: 1 });
    assert.equal(cli.judgeDescriptive({ S1: h(), S2: h() }).verdict, 'INCONCLUSIVE');
    assert.equal(cli.judgeDescriptive({ S1: h(), S2: h({ maxDD: 0.7 }) }).verdict, 'FAIL');
    assert.equal(cli.judgeDescriptive({ S1: h({ cagr: 0.1 }), S2: h() }).verdict, 'FAIL');
    assert.equal(cli.judgeDescriptive({ S1: h({ calmar: 0.4 }), S2: h() }).verdict, 'FAIL');
    assert.equal(cli.judgeDescriptive({ S1: h({ cagr: NaN }), S2: h() }).verdict, 'FAIL');
    const r = prng(77);
    for (let i = 0; i < 300; i++) {
      const rnd = () => ({ maxDD: r(), calmar: r() * 3, cagr: r() * 0.6 - 0.2 });
      const mk = () => ({ base: { strat: rnd(), tradedBH: rnd(), underBH: rnd() }, stress: { strat: rnd(), tradedBH: rnd(), underBH: rnd() }, roundTrips: 50 });
      assert.ok(['INCONCLUSIVE', 'FAIL'].includes(cli.judgeDescriptive({ S1: mk(), S2: mk() }).verdict));
    }
  });

  await test('sensitivity grid: labelled descriptive, all 186 configs listed, nothing selected or promoted', async () => {
    const { md } = await runDesc(descWorld(bullBear).world, 'sens');
    const i = md.indexOf('## Sensitivity grid');
    assert.ok(i > 0);
    const sec = md.slice(i, md.indexOf('## Not verified'));
    assert.ok(/Sensitivity grid \(DESCRIPTIVE ONLY: nothing is chosen from this table\)/.test(sec));
    assert.ok(sec.includes('feeds no verdict'));
    const rows = sec.split('\n').filter((l) => /^\| (QQQ|SPY)->/.test(l));
    assert.equal(rows.length, 186);
    assert.equal(new Set(rows.map((l) => l.split('|').slice(1, 4).join('|'))).size, 186, 'every (pair, strategy, params) exactly once');
    assert.equal(rows.filter((l) => /\| yes \|/.test(l)).length, 18, 'one canonical row per pair and family');
    assert.equal(/selected|best|winner|optimal|frozen/i.test(md), false, 'the report never names a chosen config');
    for (const a of [cli.gridFor(v2, 'S1'), cli.gridFor(v2, 'S2'), cli.gridFor(v2, 'S3')]) assert.ok(a.length > 0);
    assert.equal(engine.TRADING_DAYS, 252);
  });

  await test('engine and CLI contain no order-submission import or reference', () => {
    for (const f of ['lev-backtest-engine.js', 'backtest-lev-trend.js']) {
      const src = fs.readFileSync(path.join(__dirname, f), 'utf8');
      assert.equal(src.includes('submitOrder'), false, f);
      assert.equal(src.includes('survive-executor'), false, f);
      assert.equal(/require\(['"]\.\.\/city/.test(src), false, f);
    }
    const eng = fs.readFileSync(path.join(__dirname, 'lev-backtest-engine.js'), 'utf8');
    assert.equal(/require\(/.test(eng), false, 'engine must be dependency-free');
    assert.equal(/\b(fetch|https?:|readFileSync|writeFileSync)\b/.test(eng.replace(/\/\/.*$/gm, '')), false, 'engine does no I/O');
  });

  fs.rmSync(tmp, { recursive: true, force: true });
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length} passed, ${failed.length} failed of ${results.length}`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
