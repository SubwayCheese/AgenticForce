// vault-research-writer.js -- persists the layered research pipeline's
// company-research findings (generate-pilot-tasks.js's
// generateCompanyResearchTask()) into the real Obsidian knowledge vault,
// not just injecting them ephemerally into one cycle's round-2 prompt.
// Direct user request 2026-09-13: "research" means agents browsing the
// web AND adding what they find to the vault, not a one-shot dispatch
// that gets used once and thrown away.
//
// Writes into the EXISTING "06 - Markets & Trading Research" category
// (see its "Research Standards & Source Tiers.md") -- same source-tier
// discipline, same observation-only hard rule (no trade recommendations/
// price targets/opinions), same dated-snapshot convention as the manual
// 2026-09-03 batch. This automated feed is deliberately labeled LOWER
// rigor than that batch (a single live-web-search pass, no FMP
// cross-check, no second-agent review) -- every note says so explicitly
// in its own Provenance section, never silently presented as equally
// rigorous.
//
// Idempotent, mechanical, cheap: publishPendingCompanyResearch() is
// meant to run every pilot-supervisor.js wake, same posture as
// trading-journal.js's journalClosedTrades() -- a small on-disk ledger
// (bus/vault-research-published.jsonl) tracks which task_ids have
// already been published so a re-run never double-publishes.

const fs = require('fs');
const path = require('path');
const runTask = require('./run-task.js');

const VAULT_ROOT = path.resolve(__dirname, '..', '..');
const TASKS_DIR = path.join(VAULT_ROOT, 'tasks');
const PUBLISHED_LEDGER_PATH = path.join(VAULT_ROOT, 'bus', 'vault-research-published.jsonl');

const COMPANY_NAMES = require('./company-names.json').names;
const CRYPTO_NAMES = require('./crypto-names.json').names;
const SECTOR_MAP = require('./sector-map.json').sectors;
const CRYPTO_CATEGORY_MAP = require('./crypto-category-map.json').categories;

const RESEARCH_CATEGORY_ROOT = path.join(VAULT_ROOT, '06 - Markets & Trading Research');
const COMPANIES_DIR = path.join(RESEARCH_CATEGORY_ROOT, '03 - Companies');
const CRYPTO_DIR = path.join(RESEARCH_CATEGORY_ROOT, '07 - Crypto Assets');
const WATCHLISTS_DIR = path.join(RESEARCH_CATEGORY_ROOT, '02 - Watchlists & Investment Theses');
const CORE_WATCHLIST_PATH = path.join(WATCHLISTS_DIR, 'Core Watchlist.md');
const CRYPTO_WATCHLIST_PATH = path.join(WATCHLISTS_DIR, 'Crypto Watchlist.md');

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function readPublishedLedger() {
  if (!fs.existsSync(PUBLISHED_LEDGER_PATH)) return new Set();
  return new Set(
    fs.readFileSync(PUBLISHED_LEDGER_PATH, 'utf8').split('\n').filter((l) => l.trim())
      .map((l) => { try { return JSON.parse(l).taskId; } catch (_) { return null; } })
      .filter(Boolean)
  );
}

function markPublished(taskId, notePath) {
  fs.appendFileSync(PUBLISHED_LEDGER_PATH, JSON.stringify({ taskId, notePath, ts: new Date().toISOString() }) + '\n', 'utf8');
}

// Strips the mandatory SOURCE-tag preamble line and the trailing
// bullish/bearish/neutral "Lean" line (used internally by round-2 --
// this vault category is observation-only, no directional opinions, so
// the lean is captured for logging but never written into the note
// body) -- returns { bodyLines, leanLine }.
function splitResearchOutput(output) {
  const lines = output.split('\n');
  const bodyLines = [];
  let leanLine = null;
  for (const line of lines) {
    if (/^SOURCE:/.test(line.trim())) continue;
    const leanMatch = line.match(/\*{0,2}Lean:\s*(bullish|bearish|neutral\/mixed|neutral|mixed)\*{0,2}/i);
    if (leanMatch) { leanLine = leanMatch[0]; continue; }
    bodyLines.push(line);
  }
  return { bodyLines, leanLine };
}

// Splits the free-form body into individual bullet/finding lines --
// bullets prefixed with -, *, bullet char, or a number, falling back to
// non-empty paragraph lines (minus an "As of ..." dateline) if Codex
// didn't use bullet markers at all this pass.
function extractBullets(bodyLines) {
  const text = bodyLines.join('\n').trim();
  if (!text) return [];
  const bulletRe = /^\s*(?:[-*•]|\d+[.)])\s+(.+)$/;
  const bullets = [];
  for (const line of text.split('\n')) {
    const m = line.match(bulletRe);
    if (m) bullets.push(m[1].trim());
  }
  if (bullets.length) return bullets;
  return text.split('\n').map((l) => l.trim()).filter((l) => l && !/^As of /i.test(l));
}

// Best-effort extraction of an inline "(Source: Publisher, URL, date)"
// citation trailing one bullet -- never fabricates one when absent; the
// row's source column says so honestly instead.
function extractInlineSource(bullet) {
  const m = bullet.match(/\(\s*(?:Source:\s*)?([^,()]+?)\s*,\s*(https?:\/\/[^\s,()]+)\s*(?:,\s*([^()]+))?\)\s*$/i);
  if (!m) return null;
  const [, publisher, url, date] = m;
  return { publisher: publisher.trim(), url: url.trim(), date: date ? date.trim() : null };
}

function resolveName(pilot, symbol) {
  const map = pilot === 'crypto' ? CRYPTO_NAMES : COMPANY_NAMES;
  return map[symbol] || symbol;
}

function resolveCategory(pilot, symbol) {
  const map = pilot === 'crypto' ? CRYPTO_CATEGORY_MAP : SECTOR_MAP;
  return map[symbol] || 'Unknown';
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function noteFrontmatter(pilot, symbol, name, asOf) {
  const isCrypto = pilot === 'crypto';
  return [
    '---',
    'tier: warm',
    'relevance: 0.6',
    `last_accessed: ${asOf}`,
    `type: ${isCrypto ? 'crypto_snapshot' : 'market_snapshot'}`,
    `ticker: ${symbol}`,
    `${isCrypto ? 'asset' : 'company'}: ${name}`,
    `as_of: ${asOf}`,
    'status: auto-published',
    'source_tiers_present: [web_unverified]',
    `related: ["[[${isCrypto ? 'Crypto Watchlist' : 'Core Watchlist'}]]", "[[Research Standards & Source Tiers]]"]`,
    `tags: ["markets", "${symbol}", "${isCrypto ? 'crypto' : 'equity'}", "automated"]`,
    '---',
  ].join('\n');
}

function buildEvidenceLedger(bullets) {
  if (!bullets.length) {
    return 'No parseable findings were returned by this pass -- see Provenance for the raw task reference.';
  }
  const rows = bullets.map((bullet, i) => {
    const cite = extractInlineSource(bullet);
    const claim = (cite ? bullet.replace(/\(\s*(?:Source:\s*)?[^()]*\)\s*$/i, '') : bullet).trim();
    const sourceCell = cite
      ? `${cite.publisher}, ${cite.url}${cite.date ? ` (${cite.date})` : ''}`
      : 'Live web search pass -- no explicit publisher/URL captured for this specific claim';
    return `| WEB-${String(i + 1).padStart(3, '0')} | ${claim.replace(/\|/g, '\\|')} | Live web, not independently verified | ${sourceCell.replace(/\|/g, '\\|')} |`;
  });
  return [
    '| Claim ID | Claim | Trust tier | Source / retrieval |',
    '|---|---|---|---|',
    ...rows,
  ].join('\n');
}

function upsertWatchlistRow(watchlistPath, header, symbol, name, category, notePath, isCrypto) {
  ensureDir(path.dirname(watchlistPath));
  let content;
  if (!fs.existsSync(watchlistPath)) {
    content = [
      '---',
      'tier: warm',
      'relevance: 0.6',
      `last_accessed: ${todayIso()}`,
      'type: watchlist',
      'status: active',
      'domain: markets-research',
      `description: "${header} for the Markets & Trading Research category"`,
      `tags: ["markets", "watchlist"${isCrypto ? ', "crypto"' : ''}]`,
      '---',
      `# ${header}`,
      '',
      'Observation-only. No trade recommendations, price targets, or buy/',
      'sell/hold opinions belong on this page -- see [[Research Standards &',
      'Source Tiers]].',
      '',
      `| ${isCrypto ? 'Coin' : 'Ticker'} | ${isCrypto ? 'Asset' : 'Company'} | ${isCrypto ? 'Category' : 'Sector'} | Latest snapshot | Notes |`,
      '|---|---|---|---|---|',
      '',
      'Populated automatically by the layered research pipeline\'s',
      'company-research layer (`bus/scripts/vault-research-writer.js`) --',
      'see [[Markets & Trading Research - MOC]].',
    ].join('\n');
  } else {
    content = fs.readFileSync(watchlistPath, 'utf8');
  }

  const noteLinkName = path.basename(notePath, '.md');
  const escapedName = name.replace(/\|/g, '\\|');
  const newRow = `| ${symbol} | ${escapedName} | ${category.replace(/\|/g, '\\|')} | [[${noteLinkName}]] | auto-updated ${todayIso()} |`;

  const lines = content.split('\n');
  const rowRe = new RegExp(`^\\|\\s*${symbol}\\s*\\|`);
  const existingIdx = lines.findIndex((l) => rowRe.test(l));
  if (existingIdx !== -1) {
    lines[existingIdx] = newRow;
  } else {
    const sepIdx = lines.findIndex((l) => l.trim().startsWith('|---'));
    if (sepIdx !== -1) lines.splice(sepIdx + 1, 0, newRow);
    else lines.push(newRow);
  }
  fs.writeFileSync(watchlistPath, lines.join('\n'), 'utf8');
}

// The real publish step for one already-completed company-research task.
// Never fabricates: refuses (with a stated reason) on a missing task, a
// not-yet-done task, an empty output, or an already-published task_id.
function publishCompanyResearch(pilot, symbol, researchTaskId) {
  const published = readPublishedLedger();
  if (published.has(researchTaskId)) {
    return { written: false, reason: `already published (see ${path.basename(PUBLISHED_LEDGER_PATH)})` };
  }

  const task = runTask.readTaskFile(researchTaskId);
  if (!task) return { written: false, reason: `task file not found: ${researchTaskId}` };
  if (task.status !== 'done') return { written: false, reason: `task status is "${task.status}", not "done" -- nothing to publish yet` };
  if (!task.output || !task.output.trim()) return { written: false, reason: 'task is done but has no parseable output -- refusing to publish an empty note' };

  const isCrypto = pilot === 'crypto';
  const name = resolveName(pilot, symbol);
  const category = resolveCategory(pilot, symbol);
  const asOf = todayIso();

  const { bodyLines, leanLine } = splitResearchOutput(task.output);
  const bullets = extractBullets(bodyLines);
  const evidenceLedger = buildEvidenceLedger(bullets);

  const targetDir = path.join(isCrypto ? CRYPTO_DIR : COMPANIES_DIR, `${symbol} - ${name}`);
  ensureDir(targetDir);
  const noteFileName = `${symbol} - ${asOf} Snapshot.md`;
  const notePath = path.join(targetDir, noteFileName);

  const noteBody = [
    noteFrontmatter(pilot, symbol, name, asOf),
    `# ${name} (${symbol}) — ${asOf} Snapshot`,
    '',
    'Observation-only research note -- see [[Research Standards & Source',
    'Tiers]]. No trade recommendations, price targets, or buy/sell/hold',
    'opinions.',
    '',
    `Produced by the automated daily ${isCrypto ? 'crypto' : 'company'}-research layer of the AgentVault trading pipeline -- a single live web-search pass by Codex, not cross-checked against a second source or a second agent. Lower rigor than a manually reviewed batch; treat every row below as directionally useful, not confirmed.`,
    '',
    '## 1. Overview',
    '',
    `${name} (${symbol}) -- ${isCrypto ? 'category' : 'sector'}: ${category}. *(Static/live classification, not independently verified in this pass.)*`,
    '',
    '## 2. Evidence Ledger',
    '',
    evidenceLedger,
    '',
    '## 3. Excluded / Unconfirmed Claims',
    '',
    'No separate exclusion filtering was applied in this automated pass -- unlike the manually reviewed 2026-09-03 batch, there is no cross-check step here. Every row in the Evidence Ledger above is exactly one live web-search pass\'s own claim, already labeled "Live web, not independently verified."',
    '',
    '## 4. Open Verification Items',
    '',
    `- This snapshot's claims came from a single automated web-search pass (task \`${researchTaskId}\`, ${asOf}) with no FMP cross-check or second-agent review -- confirm against a primary source before treating anything above as settled.`,
    leanLine ? `- This cycle's research pass also produced an internal directional read ("${leanLine}") used only by round-2 of the trading pipeline's own deliberation -- deliberately excluded from this note per the observation-only rule; see \`${researchTaskId}\` under the vault's \`tasks/\` directory for the raw pipeline record if needed.` : null,
    !bullets.length ? '- This pass returned no cleanly parseable bullet findings -- see the raw task output for context before relying on this note.' : null,
    '',
    '## Provenance',
    '',
    `Company/asset research: \`${researchTaskId}\` (Codex, real hosted web-search tool, \`to: codex\`). Generated by \`bus/scripts/generate-pilot-tasks.js\`'s \`generateCompanyResearchTask()\`, published into the vault by \`bus/scripts/vault-research-writer.js\` on ${asOf}. Part of the layered research pipeline added 2026-09-13.`,
  ].filter((l) => l !== null).join('\n');

  fs.writeFileSync(notePath, noteBody, 'utf8');

  const watchlistPath = isCrypto ? CRYPTO_WATCHLIST_PATH : CORE_WATCHLIST_PATH;
  upsertWatchlistRow(watchlistPath, isCrypto ? 'Crypto Watchlist' : 'Core Watchlist', symbol, name, category, notePath, isCrypto);

  markPublished(researchTaskId, notePath);

  return { written: true, path: notePath };
}

// Scans tasks/ for every completed research_company task not yet in the
// published ledger and publishes it -- cheap (a dir listing + a Set
// lookup), safe to call every pilot-supervisor.js wake.
function publishPendingCompanyResearch() {
  if (!fs.existsSync(TASKS_DIR)) return [];
  const published = readPublishedLedger();
  const files = fs.readdirSync(TASKS_DIR).filter((f) => /_research_company_[a-z0-9]+\.md$/.test(f));
  const results = [];
  for (const file of files) {
    const taskId = file.replace(/\.md$/, '');
    if (published.has(taskId)) continue;
    const pilot = taskId.startsWith('crypto_pilot_') ? 'crypto' : 'fleet';
    const symbolMatch = taskId.match(/_research_company_([a-z0-9]+)$/);
    if (!symbolMatch) continue;
    const symbol = symbolMatch[1].toUpperCase();
    const result = publishCompanyResearch(pilot, symbol, taskId);
    results.push({ taskId, ...result });
  }
  return results;
}

module.exports = {
  publishCompanyResearch,
  publishPendingCompanyResearch,
  splitResearchOutput,
  extractBullets,
  extractInlineSource,
  resolveName,
  resolveCategory,
};
