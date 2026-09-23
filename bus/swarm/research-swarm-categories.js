// research-swarm-categories.js -- Round 17. 15 genuinely distinct
// specialist research angles, replacing survive-mechanism-research.js's
// one generalist weekly scan. Every prompt composes two mandatory
// baseline paragraphs (kept verbatim from the original single prompt)
// plus only the specific extra safeguard paragraphs that category
// actually needs -- not padding, not every category carrying every
// constraint regardless of relevance.

const BASELINE_FRAMING =
  'You are researching new revenue mechanisms for a real-money, multi-citizen autonomous city-bank system (see ARCHITECTURE.md section 19). Trading is mechanism #1 today -- your job is to find whether there is a genuinely better or complementary one, not to justify what already exists. This is NOT only a trading bot -- treat that as a real requirement, not a suggestion.';

const BASELINE_RIGOR =
  'Research honestly: cite real, current sources. Evaluate legality/ToS fit for autonomous execution specifically (not "is it technically possible"), what one-time human account/KYC setup it would need, and a realistic payoff estimate at this city\'s actual small scale (tens to low hundreds of dollars).';

const HARD_BOUNDARY =
  'ONE HARD BOUNDARY, absolute, no exceptions: no mechanism that is illegal or geoblocked for a US-based account (this ruled out Polymarket previously for exactly this reason).';

const OUTBOUND_GATE =
  'REQUIRED SAFEGUARD for any mechanism involving outbound communication to another party (a message, a bid, a proposal, a deliverable, an email): it must be designable so every outbound send requires a human-recorded approval BEFORE it goes out (this system already has that exact gate built for email, see survive-email.js -- requestSend()/approveSend()/executeSend()). If a mechanism cannot realistically operate that way, say so plainly rather than proposing it anyway.';

const GIG_TOS_PROTOCOL =
  'Read that SPECIFIC platform\'s CURRENT Terms of Service -- do not assume a prior session\'s read still holds, ToS changes. Answer explicitly: does the ToS require the account to represent itself as operated by a human? Does it require disclosure when AI assisted the work or bidding? Would routing every outbound send through a human-approval gate bring this into compliance, or does the problem run deeper than sends (e.g. banning AI-driven bidding/pricing/account-operation itself, not just unsupervised messaging)? If you cannot resolve this cleanly with real, cited evidence, recommend AGAINST implementing -- gray-area legal risk on a live, real-money-adjacent account is not worth guessing on.';

const RESPONSE_SCHEMA =
  'Respond with ONLY a fenced ```json block matching exactly this shape (any field not applicable this run should be null):\n' +
  '{"mechanismId": "kebab-case-name"|null, "displayName": "..."|null, "clearsHardBoundary": true|false, "requiresOutboundApprovalGate": true|false, "boundaryNotes": "..."|null, "requiredHumanSetup": "..."|null, "realisticPayoffAssessment": "..."|null, "sources": ["url", ...], "recommendImplementing": true|false, "draftModuleContent": "..."|null, "existingOssToolFound": {"name": "...", "url": "...", "license": "...", "howACitizenWouldUseIt": "..."}|null}\n\n' +
  'draftModuleContent, only if recommendImplementing is true and mechanismId is set: the FULL javascript file content for bus/city/mechanisms/<mechanismId>.js, matching the exact interface shape used by bus/city/mechanisms/alpaca-live-equity.js (module.exports with id/displayName/requiredSecretNames/isAvailable()).';

// Each entry: slug, the category-specific research brief, and which
// extra safeguard blocks (beyond the two baseline paragraphs, always
// included) actually apply.
const CATEGORIES = [
  { slug: 'prediction-markets', brief: 'Go deeper on the already-cleared Kalshi/CFTC-registered event-contract thread -- new contract categories, real edge sources, anything that changed since the last read.', extras: [HARD_BOUNDARY] },
  { slug: 'content-affiliate', brief: 'Evaluate real content publishing (blog/newsletter/social) monetized via affiliate links or ad revenue -- a genuinely distinct mechanism from trading.', extras: [OUTBOUND_GATE] },
  { slug: 'crypto-defi', brief: 'Evaluate staking/lending yield on US-accessible, non-geoblocked crypto protocols only -- real APYs, real custody/counterparty risk, not speculative trading.', extras: [HARD_BOUNDARY] },
  { slug: 'gig-platform-reassessment', brief: 'Re-evaluate a gig/freelance-style platform (Upwork, Fiverr, or similar) from scratch -- these are NOT pre-excluded.', extras: [GIG_TOS_PROTOCOL, OUTBOUND_GATE, 'Default to recommending AGAINST if the ToS question above cannot be resolved cleanly.'] },
  { slug: 'oss-tool-discovery', brief: 'Look specifically for reusable existing open-source tools or frameworks that would give a citizen new capability -- e.g. browser automation for a site with no API, an existing content-publishing pipeline, an existing "AI does freelance/digital work" project someone has already built and published. A genuinely useful existing tool is as valuable a finding as a brand-new mechanism -- report it even if you find no new mechanism.', extras: [] },
  { slug: 'data-api-microservices', brief: 'Evaluate selling a small automated data feed, analysis, or scheduled report as a paid service or API.', extras: [OUTBOUND_GATE] },
  { slug: 'domain-digital-asset-flipping', brief: 'Evaluate registering/reselling domains or small digital assets on legitimate marketplaces.', extras: ['Check that specific marketplace\'s current ToS on bot-driven listing/bidding specifically.'] },
  { slug: 'sports-betting-dfs-legality', brief: 'Give a definitive answer on whether ANY US-legal, state-compliant, autonomous-execution-friendly sports wagering or DFS mechanism exists at all -- state legality varies enormously, be explicit about which states if any.', extras: [HARD_BOUNDARY, 'Default to recommending AGAINST unless you can name a specific, real, state-compliant path with cited evidence.'] },
  { slug: 'treasury-yield-optimization', brief: 'Evaluate moving idle bank/reserve cash (between mechanism payouts) into T-bills or a real money-market sweep for yield -- this is about the CITY\'s own idle capital, not a citizen\'s trading position.', extras: [] },
  { slug: 'marketplace-arbitrage', brief: 'Evaluate legal resale/arbitrage buying on one public marketplace and reselling on another.', extras: [HARD_BOUNDARY, GIG_TOS_PROTOCOL.replace('bidding', 'automated buying/reselling')] },
  { slug: 'open-bounty-prize-platforms', brief: 'Evaluate legitimate bug-bounty or data/coding-competition prize platforms a citizen\'s real analysis/coding capability could earn from.', extras: [OUTBOUND_GATE, 'Check whether the platform requires disclosing that a submission was AI-authored.'] },
  { slug: 'research-licensing-syndication', brief: 'Evaluate licensing or syndicating this city\'s OWN already-produced research/analysis to third parties for real payment.', extras: [OUTBOUND_GATE] },
  { slug: 'survey-research-panels', brief: 'Evaluate legitimate paid survey or user-research panels.', extras: [GIG_TOS_PROTOCOL, 'Many of these platforms explicitly ban bot/AI participation -- check for this specifically and cite it if found.'] },
  { slug: 'print-on-demand-licensing', brief: 'Evaluate generating and licensing creative/design assets via print-on-demand platforms.', extras: [GIG_TOS_PROTOCOL.replace('bidding', 'AI-generated content'), OUTBOUND_GATE] },
  { slug: 'referral-affinity-programs', brief: 'Evaluate structured referral/partner payout programs from legitimate, established US fintech or SaaS products -- NOT original content, just a referral-link mechanism.', extras: [OUTBOUND_GATE, 'Many referral programs explicitly ban bot-driven or self-referral signups -- check for this and cite it if found.'] },
];

function buildPrompt(category) {
  return [
    BASELINE_FRAMING,
    '',
    `Your specific research angle this run: ${category.brief}`,
    '',
    ...category.extras.map((e) => e + '\n'),
    BASELINE_RIGOR,
    '',
    RESPONSE_SCHEMA,
  ].join('\n');
}

module.exports = { CATEGORIES, buildPrompt };
