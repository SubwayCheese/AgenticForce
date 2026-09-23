# Proposal (needs owner review -- protected file): the protective stop used the ENTRY price

**File:** `bus/city/survive-executor.js` `placeProtectiveStop` (protected; NOT applied). Found 2026-09-23 11:04 PDT.

## What happened
mission010 entered SGOV ($20, filled 0.198672205 @ $100.618) and the stop failed: `POST /orders -> 422: stop price must be
less than current price`. The decision's exit condition read "...its price falls more than 0.5% below the $100.61 entry-time
bid...". `parseStopPrice` (in `bus/fleet/execute-portfolio-setup.js`, written for fleet text like "closes above $390.00")
returns the FIRST dollar figure -> 100.61 = the entry bid, which is not below the market, so Alpaca rejected it. Because it
returned a number, the executor's 5% percentage fallback never ran. Result: a real position with NO stop (an ntfy alert
fires; the day-order retry hit the same 422).

## Proposed fix (in `placeProtectiveStop`, right after `parseStopPrice`)
```js
if (stopPrice && referencePrice && stopPrice >= referencePrice) {
  // A sell-stop must sit BELOW the market. The first $ figure in pipeline decisions is often the entry price itself.
  const pct = /(\d+(?:\.\d+)?)\s*%\s*(?:below|under|lower|down)/i.exec(invalidationCondition || '');
  const frac = pct ? Number(pct[1]) / 100 : FALLBACK_STOP_PCT;
  stopPrice = Number((referencePrice * (1 - frac)).toFixed(2));
  stopPriceSource = pct ? 'thesis-percentage' : 'fallback-percentage';
}
```
Tests to add (`bus/tests/survive/`): (1) the exact mission010 text + referencePrice 100.618 -> stop 100.12 (0.5% below the fill),
placed; (2) text with a genuine lower level ("stop at $95.00") is untouched; (3) text with only a higher $ figure and no
percentage -> 5% fallback; (4) `submitOrder` rejecting twice still raises the loud alert.
Also worth deciding: fractional-qty stops can only be `day` orders on Alpaca, so a placed stop expires at the close and is
not re-placed -- an overnight gap is unprotected. A re-arm step at each wake (or whole-share sizing) would close that.

## Manual protection for the CURRENT position (owner action -- a live order)
See the message in the chat / handoff; either place a day stop at ~$100.12 while the market is open, or close the position.
