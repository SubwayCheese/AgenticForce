// Pure, dependency-free engine for the leveraged-ETF trend backtest (signals, next-open fills, costs, metrics, DSR, bootstrap).
//
// Everything here takes bar arrays as arguments; no file, network or clock access.  Bars: {date:'YYYY-MM-DD', open, high, low,
// close, volume}, ascending, split+dividend adjusted.  Methodology is fixed by bus/fleet/data/lev-backtest-prereg.json:
//   * a signal at t uses only the UNDERLYING's data up to close t; the fill is the traded ETF's OPEN at t+1 (bars[i+1].open);
//   * slippage is charged per side on each fill of the traded ETF (buy at open*(1+s), sell at open*(1-s));
//   * NO expense ratio is added (adjusted prices already net it); the cash leg is BIL's adjusted return, charged no slippage;
//   * dates are aligned by INTERSECTION of underlying, traded and BIL dates; only those rows exist for the simulation;
//   * Sharpe = mean(daily r)/sd(daily r, n-1) * sqrt(252), rf = 0; CAGR uses years = (#daily returns)/252.
'use strict';

const TRADING_DAYS = 252;
const EULER_GAMMA = 0.5772156649015329;

// ---------------------------------------------------------------- indicators
// sma(values, n)[i] uses values[i-n+1..i] only; NaN until a full window exists.
function sma(values, n) {
  const out = new Array(values.length).fill(NaN);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= n) sum -= values[i - n];
    if (i >= n - 1) out[i] = sum / n;
  }
  return out;
}

function mean(a) { return a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN; }
function sampleSd(a) {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1));
}

// Annualised realised vol: sample sd (n-1 denominator) of the last `n` close-to-close simple returns (closes[i-n..i]) * sqrt(252).
function realizedVol(closes, n = 20) {
  const out = new Array(closes.length).fill(NaN);
  const rets = closes.map((c, i) => (i === 0 ? NaN : c / closes[i - 1] - 1));
  for (let i = n; i < closes.length; i++) out[i] = sampleSd(rets.slice(i - n + 1, i + 1)) * Math.sqrt(TRADING_DAYS);
  return out;
}

// ---------------------------------------------------------------- signals
// Each generator returns an array (same length as closes) of TARGET weights in the traded ETF decided at that close
// (0..1), or null before the warm-up is complete.  Element i depends on closes[0..i] only.
function firstSignalIndex(longestWindow, warmupBars) {
  return Math.max(longestWindow, warmupBars || 0) - 1;
}

// S1: long when close > SMA(n)*(1+band); flat when close < SMA(n)*(1-band); otherwise keep the prior state (start flat).
function s1Signals(closes, { n, bandPct, warmupBars }) {
  const ma = sma(closes, n);
  const first = firstSignalIndex(n, warmupBars);
  const band = bandPct / 100;
  const out = new Array(closes.length).fill(null);
  let state = 0;
  for (let i = first; i < closes.length; i++) {
    if (closes[i] > ma[i] * (1 + band)) state = 1;
    else if (closes[i] < ma[i] * (1 - band)) state = 0;
    out[i] = state;
  }
  return out;
}

// S2: entry = SMA(fast) > SMA(slow) AND close > SMA(slow).  While long, exit when close < SMA(fast) OR the UNDERLYING's
// close is at least trailingDDPct below its highest close since the entry signal close.  Once flat, re-enter at any later
// close where the entry condition holds (rearm=false, default) or only after it has been false at least once, counting the exit
// close itself (rearm=true).
function s2Signals(closes, { slow, trailingDDPct, fast = 50, warmupBars, rearm = false }) {
  const maFast = sma(closes, fast);
  const maSlow = sma(closes, slow);
  const first = firstSignalIndex(Math.max(fast, slow), warmupBars);
  const dd = trailingDDPct / 100;
  const out = new Array(closes.length).fill(null);
  let state = 0;
  let peak = NaN;
  let armed = true;
  for (let i = first; i < closes.length; i++) {
    const entryCond = maFast[i] > maSlow[i] && closes[i] > maSlow[i];
    if (state === 1) {
      peak = Math.max(peak, closes[i]);
      const drawdown = 1 - closes[i] / peak;
      if (closes[i] < maFast[i] || drawdown >= dd - 1e-12) { state = 0; armed = rearm ? !entryCond : true; }
    } else {
      if (!entryCond) armed = true;
      if (entryCond && armed) { state = 1; peak = closes[i]; }
    }
    out[i] = state;
  }
  return out;
}

// S3: S1(n, band) gate; when long, weight = min(1, targetVol / (leverage * realizedVol(vol window))).
function s3Signals(closes, { n = 200, bandPct = 2, targetVolPct, leverage, volWindow = 20, warmupBars }) {
  const gate = s1Signals(closes, { n, bandPct, warmupBars: Math.max(warmupBars || 0, volWindow + 1) });
  const vol = realizedVol(closes, volWindow);
  const target = targetVolPct / 100;
  return gate.map((g, i) => {
    if (g === null) return null;
    if (g === 0) return 0;
    const v = leverage * vol[i];
    return v > 0 ? Math.min(1, target / v) : 1;
  });
}

function longestWindow(spec) {
  const p = spec.params || {};
  if (spec.family === 'S1') return p.n;
  if (spec.family === 'S2') return Math.max(p.fast || 50, p.slow);
  if (spec.family === 'S3') return Math.max(p.n || 200, (p.volWindow || 20) + 1);
  throw new Error(`unknown family ${spec.family}`);
}

function makeWeights(closes, spec, warmupBars) {
  const p = spec.params || {};
  if (spec.family === 'S1') return s1Signals(closes, { n: p.n, bandPct: p.bandPct, warmupBars });
  if (spec.family === 'S2') return s2Signals(closes, { slow: p.slow, trailingDDPct: p.trailingDDPct, fast: p.fast || 50, warmupBars, rearm: !!p.rearm });
  if (spec.family === 'S3') return s3Signals(closes, { n: p.n || 200, bandPct: p.bandPct === undefined ? 2 : p.bandPct, targetVolPct: p.targetVolPct, leverage: spec.leverage, warmupBars });
  throw new Error(`unknown family ${spec.family}`);
}

// ---------------------------------------------------------------- data alignment / sanity
function validBar(b) {
  return b && Number.isFinite(b.open) && Number.isFinite(b.close) && b.open > 0 && b.close > 0;
}

// Keep only dates present (with valid open and close) in underlying, traded and cash; ascending.
function alignBars(underlying, traded, cash) {
  const idx = (bars) => new Map(bars.filter(validBar).map((b) => [b.date, b]));
  const mu = idx(underlying), mt = idx(traded), mc = idx(cash);
  const dates = [...mu.keys()].filter((d) => mt.has(d) && mc.has(d)).sort();
  return {
    dates,
    u: dates.map((d) => mu.get(d)),
    t: dates.map((d) => mt.get(d)),
    c: dates.map((d) => mc.get(d)),
    dropped: { underlying: underlying.length - dates.length, traded: traded.length - dates.length, cash: cash.length - dates.length },
  };
}

// Prereg sanity: flag |ret_etf - L*ret_underlying| > devMax (only where both series span the same previous->current dates)
// or |log return| > logMax for any of the series.  A non-empty result means "stop for manual review".
function sanityCheckPair(underlyingBars, tradedBars, leverage, { devMax = 0.10, logMax = 0.70 } = {}) {
  const flags = [];
  const rets = (bars) => {
    const m = new Map();
    for (let i = 1; i < bars.length; i++) {
      if (bars[i - 1].close > 0 && bars[i].close > 0) m.set(bars[i].date, { prev: bars[i - 1].date, ret: bars[i].close / bars[i - 1].close - 1 });
    }
    return m;
  };
  const ru = rets(underlyingBars), rt = rets(tradedBars);
  for (const [date, t] of rt) {
    if (Math.abs(Math.log(1 + t.ret)) > logMax) flags.push({ date, kind: 'logReturn', value: t.ret });
    const u = ru.get(date);
    if (u && u.prev === t.prev && Math.abs(t.ret - leverage * u.ret) > devMax) flags.push({ date, kind: 'tracking', value: t.ret - leverage * u.ret });
  }
  for (const [date, u] of ru) if (Math.abs(Math.log(1 + u.ret)) > logMax) flags.push({ date, kind: 'logReturn', value: u.ret });
  return flags;
}

// ---------------------------------------------------------------- simulator
function assertNoSameDayRoundTrip(roundTrips) {
  for (const rt of roundTrips) {
    if (rt.entryDate === rt.exitDate) throw new Error(`forbidden same-day round trip on ${rt.entryDate}`);
  }
}

// Resolve a window {start,end} (inclusive dates, both optional) to indexes.  Equity starts at the CLOSE of `base` (the last
// bar before the window, or the first bar at which a signal exists if later); the first possible fill is base+1's open.
function windowIndices(dates, window, firstSignalIdx) {
  const w = window || {};
  let si = 0;
  if (w.start) { si = dates.findIndex((d) => d >= w.start); if (si < 0) throw new Error('window starts after the data'); }
  let ei = dates.length - 1;
  if (w.end) { ei = -1; for (let i = dates.length - 1; i >= 0; i--) if (dates[i] <= w.end) { ei = i; break; } }
  const base = Math.max(si - 1, firstSignalIdx, 0);
  if (ei < base + 1) throw new Error('window too short after warm-up');
  return { base, end: ei, startDate: dates[base + 1], endDate: dates[ei] };
}

// weights[i] = target decided at the close of bar i.  Fill on day k uses weights[k-1] at t[k].open.
function simulate(aligned, weights, opts = {}) {
  const { t, c, dates } = aligned;
  const s = (opts.slippageBps === undefined ? 5 : opts.slippageBps) / 10000;
  const variant = opts.variant || 'fractional';
  const initial = opts.initialEquity === undefined ? 50 : opts.initialEquity;
  const cap = opts.cap === undefined ? 20 : opts.cap;
  const base = opts.base === undefined ? 0 : opts.base;
  const end = opts.end === undefined ? dates.length - 1 : opts.end;

  let shares = 0;
  let cash = initial;
  const equity = [initial];
  const eqDates = [dates[base]];
  const trades = [];
  const roundTrips = [];
  const cannotBuy = [];
  let open = null;
  let daysInMarket = 0;
  let exposureSum = 0;

  const record = (k, side, qty, fill, w) => {
    trades.push({ date: dates[k], side, qty, fillPrice: fill, midOpen: t[k].open, targetWeight: w, signalDate: dates[k - 1] });
  };
  const buy = (k, qty, w) => {
    const fill = t[k].open * (1 + s);
    if (shares === 0) open = { entryDate: dates[k], cost: 0, proceeds: 0 };
    shares += qty; cash -= qty * fill; open.cost += qty * fill;
    record(k, 'buy', qty, fill, w);
  };
  const sell = (k, qty, w) => {
    const fill = t[k].open * (1 - s);
    shares -= qty; cash += qty * fill; open.proceeds += qty * fill;
    record(k, 'sell', qty, fill, w);
    if (shares <= 1e-12) {
      shares = 0;
      const rt = { entryDate: open.entryDate, exitDate: dates[k], cost: open.cost, proceeds: open.proceeds, ret: open.proceeds / open.cost - 1 };
      roundTrips.push(rt);
      assertNoSameDayRoundTrip([rt]);
      open = null;
    }
  };

  for (let k = base + 1; k <= end; k++) {
    cash *= c[k].open / c[k - 1].close; // overnight, cash leg
    const w = weights[k - 1];
    if (w !== null && w !== undefined) {
      const px = t[k].open;
      const equityAtOpen = shares * px + cash;
      if (variant === 'wholeShare') {
        if (shares === 0 && w > 0) {
          const dollars = Math.min(cap, w * equityAtOpen);
          let q = Math.floor(dollars / px);
          while (q >= 1 && q * px * (1 + s) > cash + 1e-9) q--;
          if (q < 1) cannotBuy.push({ date: dates[k], open: px, cap, dollars });
          else buy(k, q, w);
        } else if (shares > 0 && w === 0) sell(k, shares, w);
      } else {
        // Fixed 2026-09-29 (research-loop cycle 1 finding, docs/research/2026-09-29-fractionable-leveraged-etfs.md):
        // this branch used to size a fresh entry as `w * equityAtOpen` with NO reference to `cap` at all, so as
        // equity compounded the "idealized fractional" backtest quietly modeled an ever-larger, uncapped position --
        // nothing like C1's real budget-envelope rule (bus/city/survive-budget-envelope.js:
        // MAX_POSITION_FRACTION_OF_LIFETIME_ALLOCATION, checked once per entry against a FIXED lifetime allocation,
        // never against a compounding balance) or its one-position-at-a-time gate (hasOpenPosition blocks any second
        // buy while a position is open -- there is no "rebalance an existing holding" path in C1 at all). To match
        // that: a fresh entry (shares 0 -> >0) is capped at `cap` dollars, continuous (no whole-share floor); a full
        // exit (w -> 0) sells everything, unchanged; any OTHER weight change while already holding a position is a
        // scenario C1 cannot actually reach (it would need a second order while one is open, which the executor's
        // ledger check refuses), so it is ignored here rather than faked -- the position rides at its entry size
        // until the strategy's own exit condition drives the weight back to 0. This mainly changes S3 (its
        // vol-target weight moves daily even while holding), which is exactly the strategy already flagged as a
        // weak fit for C1's real order pattern; S1/S2 are close to binary in/out already and are barely affected.
        if (shares === 0 && w > 0) {
          const dollars = Math.min(cap, w * equityAtOpen);
          buy(k, dollars / (px * (1 + s)), w);
        } else if (shares > 0 && w === 0) {
          sell(k, shares, w);
        }
        // else: already holding and the weight changed to some other nonzero value, or flat and w is 0 -- no order.
      }
    }
    cash *= c[k].close / c[k].open; // rest of the day, cash leg
    const invested = shares * t[k].close;
    const eq = invested + cash;
    equity.push(eq);
    eqDates.push(dates[k]);
    if (shares > 0) { daysInMarket++; exposureSum += invested / eq; }
  }
  const days = end - base;
  return {
    equity, dates: eqDates, trades, roundTrips, cannotBuy,
    openAtEnd: shares > 0,
    timeInMarket: days ? daysInMarket / days : 0,
    avgExposure: days ? exposureSum / days : 0,
  };
}

// ---------------------------------------------------------------- metrics
function skewKurt(returns) {
  const m = mean(returns);
  const n = returns.length;
  let m2 = 0, m3 = 0, m4 = 0;
  for (const r of returns) { const d = r - m; m2 += d * d; m3 += d ** 3; m4 += d ** 4; }
  m2 /= n; m3 /= n; m4 /= n;
  return m2 > 0 ? { skew: m3 / m2 ** 1.5, kurt: m4 / (m2 * m2) } : { skew: 0, kurt: 3 };
}

function dailyReturns(equity) {
  const out = [];
  for (let i = 1; i < equity.length; i++) out.push(equity[i] / equity[i - 1] - 1);
  return out;
}

// equity includes the starting value; dates aligns 1:1 with equity.  Drawdown/ulcer include the starting point.
function computeMetrics(equity, dates, extra = {}) {
  const rets = dailyReturns(equity);
  const n = rets.length;
  const years = n / TRADING_DAYS;
  const totalReturn = equity[equity.length - 1] / equity[0] - 1;
  const cagr = years > 0 ? (1 + totalReturn) ** (1 / years) - 1 : NaN;
  let peak = equity[0], maxDD = 0, sumSqDD = 0;
  for (const v of equity) {
    peak = Math.max(peak, v);
    const dd = 1 - v / peak;
    maxDD = Math.max(maxDD, dd);
    sumSqDD += (dd * 100) ** 2;
  }
  const ulcer = Math.sqrt(sumSqDD / equity.length); // in percent units
  const calmar = maxDD > 0 ? cagr / maxDD : (cagr > 0 ? Infinity : 0);
  const sd = sampleSd(rets);
  const sharpeDaily = sd > 0 ? mean(rets) / sd : 0;
  const months = new Map();
  for (let i = 1; i < equity.length; i++) {
    const key = dates[i].slice(0, 7);
    months.set(key, (months.get(key) || 1) * (1 + rets[i - 1]));
  }
  let worst = { month: null, ret: NaN };
  for (const [month, g] of months) if (!(worst.ret <= g - 1)) worst = { month, ret: g - 1 };
  const roundTrips = extra.roundTrips ? extra.roundTrips.length : undefined;
  const fills = extra.trades ? extra.trades.length : undefined;
  return {
    nDays: n, years, totalReturn, cagr, maxDD, calmar,
    sharpe: sharpeDaily * Math.sqrt(TRADING_DAYS), sharpeDaily,
    worstMonth: worst, ulcer,
    roundTrips, fills,
    tradesPerYear: fills === undefined || !years ? undefined : fills / years,
    roundTripsPerYear: roundTrips === undefined || !years ? undefined : roundTrips / years,
    timeInMarket: extra.timeInMarket, avgExposure: extra.avgExposure,
    startDate: dates[0], endDate: dates[dates.length - 1],
  };
}

// ---------------------------------------------------------------- normal cdf / quantile, deflated Sharpe
// erf via the all-positive series erf(x) = 2/sqrt(pi) * exp(-x^2) * sum_{k>=0} 2^k x^(2k+1) / (1*3*...*(2k+1)); accurate to ~1e-15.
function erf(x) {
  const ax = Math.abs(x);
  if (ax > 6) return x < 0 ? -1 : 1;
  let term = ax, sum = ax;
  for (let k = 1; k < 400; k++) {
    term *= (2 * ax * ax) / (2 * k + 1);
    sum += term;
    if (term < 1e-17 * sum) break;
  }
  const v = (2 / Math.sqrt(Math.PI)) * Math.exp(-ax * ax) * sum;
  return x < 0 ? -v : v;
}
function normCdf(x) { return 0.5 * (1 + erf(x / Math.SQRT2)); }

// Acklam's rational approximation refined with one Halley step against normCdf.
function normInv(p) {
  if (!(p > 0 && p < 1)) return p === 0 ? -Infinity : p === 1 ? Infinity : NaN;
  const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
  const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
  const cc = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
  const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
  const plow = 0.02425;
  let x;
  if (p < plow) {
    const q = Math.sqrt(-2 * Math.log(p));
    x = (((((cc[0] * q + cc[1]) * q + cc[2]) * q + cc[3]) * q + cc[4]) * q + cc[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else if (p > 1 - plow) {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    x = -(((((cc[0] * q + cc[1]) * q + cc[2]) * q + cc[3]) * q + cc[4]) * q + cc[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else {
    const q = p - 0.5, r = q * q;
    x = (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }
  const e = normCdf(x) - p;
  const u = e * Math.sqrt(2 * Math.PI) * Math.exp(x * x / 2);
  return x - u / (1 + x * u / 2);
}

// Bailey & Lopez de Prado (2014), as written in the prereg.  sr = per-period (daily) Sharpe; kurt = RAW kurtosis (normal = 3);
// N = number of trials; varSr = V[SR] across trials (default 1/(T-1): the sampling variance of a zero-skill Sharpe).
function deflatedSharpe({ sr, T, skew, kurt, N, varSr }) {
  const v = varSr === undefined ? 1 / (T - 1) : varSr;
  const sr0 = Math.sqrt(v) * ((1 - EULER_GAMMA) * normInv(1 - 1 / N) + EULER_GAMMA * normInv(1 - 1 / (N * Math.E)));
  const denom = 1 - skew * sr + ((kurt - 1) / 4) * sr * sr;
  const z = denom > 0 ? ((sr - sr0) * Math.sqrt(T - 1)) / Math.sqrt(denom) : NaN;
  return { dsr: normCdf(z), sr0, sr0Annualised: sr0 * Math.sqrt(TRADING_DAYS), z };
}

function deflatedSharpeFromReturns(returns, N, varSr) {
  const T = returns.length;
  const sd = sampleSd(returns);
  const sr = sd > 0 ? mean(returns) / sd : 0;
  const { skew, kurt } = skewKurt(returns);
  return { sr, T, skew, kurt, N, ...deflatedSharpe({ sr, T, skew, kurt, N, varSr }) };
}

// ---------------------------------------------------------------- bootstrap
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Seeded moving-block bootstrap of the annualised mean daily excess return (a - b).  Percentile CI.  ILLUSTRATIVE ONLY.
function movingBlockBootstrapCI(a, b, { block = 20, reps = 2000, seed = 12345, alpha = 0.05 } = {}) {
  const d = a.map((v, i) => v - b[i]);
  const n = d.length;
  const bl = Math.max(1, Math.min(block, n));
  const rand = mulberry32(seed);
  const stats = [];
  for (let r = 0; r < reps; r++) {
    let sum = 0, cnt = 0;
    while (cnt < n) {
      const st = Math.floor(rand() * (n - bl + 1));
      for (let j = 0; j < bl && cnt < n; j++, cnt++) sum += d[st + j];
    }
    stats.push((sum / n) * TRADING_DAYS);
  }
  stats.sort((x, y) => x - y);
  const q = (p) => stats[Math.min(stats.length - 1, Math.max(0, Math.floor(p * stats.length)))];
  return { mean: mean(d) * TRADING_DAYS, low: q(alpha / 2), high: q(1 - alpha / 2), reps, block: bl, seed, excludesZero: q(alpha / 2) > 0 || q(1 - alpha / 2) < 0 };
}

// ---------------------------------------------------------------- evaluation
// spec = {family:'S1'|'S2'|'S3', params, leverage}.  opts = {window:{start,end}, slippageBps, variant, warmupBars,
// initialEquity, cap}.  Signals are computed over ALL of `aligned` (causal, path-dependent from its first bar); the equity
// curve starts at `base`.  Buy-and-hold benchmarks (traded ETF, underlying) use the same base/end and the same fill rule.
function evaluateConfig(aligned, spec, opts = {}) {
  const closes = aligned.u.map((b) => b.close);
  const weights = makeWeights(closes, spec, opts.warmupBars);
  const first = firstSignalIndex(longestWindow(spec), opts.warmupBars);
  const win = windowIndices(aligned.dates, opts.window, first);
  const simOpts = { ...opts, base: win.base, end: win.end };
  const sim = simulate(aligned, weights, simOpts);
  const metrics = computeMetrics(sim.equity, sim.dates, sim);
  const ones = new Array(aligned.dates.length).fill(1);
  // Benchmarks are the traditional "fully invested the whole time" comparison, NOT subject to C1's per-position cap
  // (a buy-and-hold reference means all equity goes in on day 1, unlike a strategy that only ever risks `cap`
  // dollars per entry) -- fixed alongside the 2026-09-29 cap fix above, which would otherwise have made a constant
  // weight-1 benchmark buy $cap once, sit at that single entry forever (the strategy's ignore-while-holding rule),
  // and leave the rest of the account uninvested in cash: a 40%-invested/60%-cash line mislabeled "buy-and-hold".
  const bhOpts = { ...simOpts, cap: Infinity };
  const bhTraded = simulate(aligned, ones, bhOpts);
  const bhUnder = simulate({ dates: aligned.dates, t: aligned.u, c: aligned.c }, ones, bhOpts);
  return {
    spec, window: win, sim, metrics,
    returns: dailyReturns(sim.equity),
    benchmarks: {
      traded: { sim: bhTraded, metrics: computeMetrics(bhTraded.equity, bhTraded.dates, bhTraded), returns: dailyReturns(bhTraded.equity) },
      underlying: { sim: bhUnder, metrics: computeMetrics(bhUnder.equity, bhUnder.dates, bhUnder), returns: dailyReturns(bhUnder.equity) },
    },
  };
}

module.exports = {
  TRADING_DAYS, sma, realizedVol, s1Signals, s2Signals, s3Signals, makeWeights, longestWindow, firstSignalIndex,
  alignBars, sanityCheckPair, simulate, windowIndices, assertNoSameDayRoundTrip, computeMetrics, dailyReturns, skewKurt,
  erf, normCdf, normInv, deflatedSharpe, deflatedSharpeFromReturns, mulberry32, movingBlockBootstrapCI, evaluateConfig,
};
