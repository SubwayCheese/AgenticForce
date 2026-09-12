#!/usr/bin/env node
// cycle-date-utils.js -- one shared definition of a bug fixed
// independently four times (fleet-status.js, crypto-status.js,
// dashboard-status.js, generate-pilot-tasks.js), all on 2026-09-11.
//
// The bug: a conditional-trigger rescan task file
// (conditional-triggers.js -> generate-pilot-tasks.js's
// generateRescanTask()) is named `<prefix><YYYYMMDD>_rescan_<symbol>_
// <ts>.md` using the date it FIRES on -- today -- not the date its
// originating research cycle actually ran. A trigger can fire days
// after its cycle (fleet_pilot_20260911_rescan_ko_*.md and
// fleet_pilot_20260911_rescan_vz_*.md both fired on 2026-09-11 against
// cycles that ran earlier). Any "latest/prior cycle date" lookup that
// naively takes the largest/most-recent <prefix><YYYYMMDD>_ found in
// tasks/ therefore mistakes "a rescan fired today" for "a new cycle ran
// today" -- resolving to a date with no real cycle data at all. Real
// incidents this caused: an emptied fleet dashboard (fleet-status.js's
// discoverShortlist() correctly found nothing for the phantom date) and
// a silently-skipped daily cycle (generate-pilot-tasks.js's
// findPriorDate() would have injected an empty "no prior learnings"
// section instead of the real prior cycle's).
//
// Fix, now defined once: exclude `_rescan_` files outright when
// resolving a filename to its cycle date -- a rescan is a follow-up
// action on an EXISTING cycle, not a new cycle itself, and its real
// cycle date isn't recoverable from its own filename (only from its
// dependsOnTaskId chain, which this module doesn't need to walk since
// callers just want it excluded from "what dates have a real cycle").

// Cached per prefix -- callers (fleet-status.js, crypto-status.js,
// generate-pilot-tasks.js) call this once per file in a loop, potentially
// dozens of times per snapshot build; no reason to reconstruct the same
// RegExp object every call.
const CYCLE_DATE_RE_CACHE = new Map();

function cycleDateRegex(prefix) {
  let re = CYCLE_DATE_RE_CACHE.get(prefix);
  if (!re) {
    re = new RegExp(`^${prefix}(\\d{8})_`);
    CYCLE_DATE_RE_CACHE.set(prefix, re);
  }
  return re;
}

// The YYYYMMDD cycle date a single tasks/ filename belongs to, or null if
// it isn't a dated file for this prefix at all, or IS one but is a
// `_rescan_` follow-up (see header -- not a usable cycle date from the
// filename alone). `prefix` is the literal task-id prefix a real cycle
// file starts with, e.g. `fleet_pilot_` or `crypto_pilot_` -- NOT a regex,
// callers pass the plain string.
function resolveCycleDate(filename, prefix) {
  if (typeof filename !== 'string' || !prefix) return null;
  if (filename.includes('_rescan_')) return null;
  const m = cycleDateRegex(prefix).exec(filename);
  return m ? m[1] : null;
}

// The largest real cycle date present among `filenames` for `prefix`, or
// null if none exist. YYYYMMDD sorts correctly as a plain string, so a
// Set plus a final string sort is enough -- no real Date parsing needed.
// This is fleet-status.js's findLatestPipelineDate() / crypto-status.js's
// findLatestCryptoPipelineDate(), generalized over the prefix.
function latestCycleDate(filenames, prefix) {
  const dates = new Set();
  for (const f of filenames) {
    const d = resolveCycleDate(f, prefix);
    if (d) dates.add(d);
  }
  if (dates.size === 0) return null;
  return Array.from(dates).sort().pop();
}

// The largest real cycle date strictly before `beforeDate` (a YYYYMMDD
// string), or null. This is generate-pilot-tasks.js's findPriorDate().
function latestCycleDateBefore(filenames, prefix, beforeDate) {
  const dates = new Set();
  for (const f of filenames) {
    const d = resolveCycleDate(f, prefix);
    if (d && d < beforeDate) dates.add(d);
  }
  if (dates.size === 0) return null;
  return Array.from(dates).sort().pop();
}

module.exports = { resolveCycleDate, latestCycleDate, latestCycleDateBefore };
