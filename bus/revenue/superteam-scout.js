// superteam-scout.js -- Round 21 (scout-only phase). READ-ONLY watcher for
// Superteam Earn bounties an AI agent could actually do. Uses only PUBLIC
// endpoints (no registration, no key, no submissions, no model calls):
//   feed  : GET /api/listings/?status=open           (agentAccess, reward, counts)
//   card  : GET /earn/listing/<slug> -> __NEXT_DATA__ (authoritative: status,
//           deadline, isWinnersAnnounced, eligibility questions, requirements;
//           submissionCount lives in dehydratedState, NOT on the listing)
// The fit filter is deliberately strict: cross-review of ~2,000 past listings
// found nearly all agent-allowed bounties need X/Twitter posts, wallets,
// Discord/Telegram, GitHub, video or attendance -- things an agent must not do
// under the owner's identity. Only listings that clear it are worth solving.
// Ledger: bus/superteam-scout.jsonl. New fit listings raise one ntfy alert each.

const avPaths = require('../lib/paths.js');
const fs = require('fs');
const path = require('path');

const BASE = 'https://superteam.fun';
const VAULT_ROOT = avPaths.ROOT;
let LEDGER_PATH = path.join(VAULT_ROOT, 'bus', 'superteam-scout.jsonl');
const MIN_HOURS_LEFT = 48;
const NTFY_TOPIC = 'AgentVaultSurvive';
const UA = 'Mozilla/5.0 (compatible; AgentVaultScout/1.0)';

function _setLedgerPathForTesting(p) { LEDGER_PATH = p; }

// Reasons an agent-solvable listing must be rejected. Each is a regex over the
// listing's title + description + requirements + eligibility questions.
const REJECT_RULES = [
  ['x-twitter', /\b(x\.com|twitter|tweet|retweet|post (it )?on x|thread on x|x (post|thread|article|account)|@\w+ on x)\b/i],
  ['social-account', /\b(instagram|tiktok|linkedin post|facebook|youtube channel|follow (us|our))\b/i],
  ['video', /\b(video|youtube|loom|screen ?record|livestream|podcast episode)\b/i],
  ['wallet-or-onchain', /\b(connect (your )?wallet|wallet address|mainnet|on-?chain (trade|transaction)|swap|stake|mint|nft|airdrop|xp\b)/i],
  ['community-membership', /\b(discord|telegram|join (our|the) (server|group|community))\b/i],
  ['attendance', /\b(attend|in[- ]person|luma|workshop session|join (the )?(call|meeting|webinar)|irl)\b/i],
  ['identity-kyc', /\b(kyc|identity verification|government id|selfie|proof of (residence|identity))\b/i],
  ['github-required', /\b(github (repo|repository|pull request|pr)|pull request|fork the repo|open a pr)\b/i],
];

function listingText(l) {
  const elig = (l.eligibility || []).map((e) => (typeof e === 'string' ? e : e.question || '')).join(' ');
  return `${l.title || ''}\n${l.description || ''}\n${l.requirements || ''}\n${elig}`;
}

// Deterministic gate on the AUTHORITATIVE card data. Returns { ok, reasons[] }.
function verifyListing(l, now = Date.now()) {
  const reasons = [];
  if (l.status !== 'OPEN') reasons.push(`status ${l.status}`);
  if (l.isWinnersAnnounced) reasons.push('winners already announced');
  if (l.isPublished === false) reasons.push('unpublished');
  const dl = Date.parse(l.deadline);
  if (!dl || dl - now < MIN_HOURS_LEFT * 3600e3) reasons.push(`deadline within ${MIN_HOURS_LEFT}h or passed`);
  return { ok: reasons.length === 0, reasons };
}

function fitReport(l) {
  const reasons = [];
  if (l.type !== 'bounty') reasons.push(`type ${l.type} (projects need a human Telegram contact)`);
  if (!['USDC', 'USDG', 'USDT'].includes(l.token)) reasons.push(`token ${l.token}`);
  if (!['AGENT_ALLOWED', 'AGENT_ONLY'].includes(l.agentAccess)) reasons.push(`agentAccess ${l.agentAccess}`);
  const text = listingText(l);
  for (const [name, re] of REJECT_RULES) if (re.test(text)) reasons.push(name);
  return { fit: reasons.length === 0, reasons };
}

// Pulls the listing object and submission count out of a card page's __NEXT_DATA__.
function parseCard(html) {
  const m = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(html);
  if (!m) throw new Error('card has no __NEXT_DATA__');
  const pp = JSON.parse(m[1]).props.pageProps;
  if (!pp || !pp.listing) throw new Error('card has no listing');
  const q = ((pp.dehydratedState || {}).queries || []).find((x) => Array.isArray(x.queryKey) && x.queryKey[0] === 'submissionCount');
  const count = q && q.state ? q.state.data : null;
  return { listing: pp.listing, submissionCount: typeof count === 'number' ? count : null };
}

async function getJson(url, fetchFn) {
  const res = await fetchFn(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return res.json();
}

async function fetchCard(slug, fetchFn) {
  const res = await fetchFn(`${BASE}/earn/listing/${encodeURIComponent(slug)}`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`card ${slug} -> ${res.status}`);
  return parseCard(await res.text());
}

function readLedger() {
  if (!fs.existsSync(LEDGER_PATH)) return [];
  return fs.readFileSync(LEDGER_PATH, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch (_) { return null; } }).filter(Boolean);
}
function appendLedger(e) {
  fs.mkdirSync(path.dirname(LEDGER_PATH), { recursive: true });
  fs.appendFileSync(LEDGER_PATH, JSON.stringify({ ts: new Date().toISOString(), ...e }) + '\n', 'utf8');
}

// One scouting pass. Returns { scanned, agentEligible, fit[], skipped[] }.
async function scout({ fetchFn = globalThis.fetch, now = Date.now(), notify = true, sendNtfy } = {}) {
  const feed = await getJson(`${BASE}/api/listings/?status=open&take=200`, fetchFn);
  const items = Array.isArray(feed) ? feed : (feed.listings || feed.data || []);
  const eligible = items.filter((x) => x.agentAccess === 'AGENT_ALLOWED' || x.agentAccess === 'AGENT_ONLY');
  const alerted = new Set(readLedger().filter((e) => e.type === 'alert').map((e) => e.slug));
  const fit = [], skipped = [];
  for (const it of eligible) {
    let card;
    try { card = await fetchCard(it.slug, fetchFn); } catch (err) { skipped.push({ slug: it.slug, reasons: [`card fetch failed: ${err.message}`] }); continue; }
    const l = card.listing;
    const v = verifyListing(l, now), f = fitReport(l);
    const reasons = [...v.reasons, ...f.reasons];
    const row = { slug: l.slug, title: l.title, reward: l.rewardAmount, token: l.token, deadline: l.deadline, submissions: card.submissionCount, agentAccess: l.agentAccess };
    if (reasons.length === 0) {
      fit.push({ ...row, score: +(l.rewardAmount / ((card.submissionCount || 0) + 1)).toFixed(2) });
      appendLedger({ type: 'fit', ...row });
      if (notify && !alerted.has(l.slug)) {
        appendLedger({ type: 'alert', slug: l.slug });
        try { await (sendNtfy || require('../platform/ntfy.js').sendNtfy)({ topic: NTFY_TOPIC, title: `Superteam bounty fits an agent: $${l.rewardAmount} ${l.token}`, message: `${l.title} -- ${card.submissionCount ?? '?'} entries, deadline ${l.deadline}. https://superteam.fun/earn/listing/${l.slug}`, priority: 3 }); } catch (_) { /* best-effort */ }
      }
    } else { skipped.push({ ...row, reasons }); appendLedger({ type: 'skip', ...row, reasons }); }
  }
  fit.sort((a, b) => b.score - a.score);
  return { scanned: items.length, agentEligible: eligible.length, fit, skipped };
}

module.exports = { scout, verifyListing, fitReport, parseCard, listingText, REJECT_RULES, readLedger, _setLedgerPathForTesting };

if (require.main === module) {
  scout({ notify: !process.argv.includes('--no-notify') }).then((r) => {
    console.log(`scanned ${r.scanned} open listings; ${r.agentEligible} agent-eligible; ${r.fit.length} fit an agent`);
    for (const f of r.fit) console.log(`  FIT  $${f.reward} ${f.token} | ${f.submissions} entries | ${f.deadline.slice(0, 10)} | ${f.title}`);
    for (const s of r.skipped) console.log(`  skip $${s.reward || '?'} | ${s.title || s.slug} -> ${s.reasons.join(', ')}`);
  }).catch((e) => { console.error('scout failed:', e.message); process.exit(1); });
}
