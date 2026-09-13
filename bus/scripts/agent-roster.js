// agent-roster.js -- reads the Claude Code global subagent roster at
// ~/.claude/agents/*.md and exposes it for the city dashboard's "roster
// pods" (bus/city.html). This is a DELIBERATE, first-of-its-kind scope
// expansion for this dashboard: every other data source in this project
// lives inside the AgentVault repo itself; this one reaches outside it,
// onto the user's global Claude Code config. Kept in its own file
// specifically so that fact stays a single, obviously-named, greppable
// place rather than getting buried inside dashboard-status.js.
//
// This roster is a SEPARATE population from bus/scripts/agents/*.json
// (the codex/claude-agent dispatch-engine workers that agent-engine.js's
// listAgentConfigs() already reads, and that city.html already
// represents as walking worker figures). Confirmed via repo-wide grep
// before writing this: nothing in AgentVault referenced
// ~/.claude/agents before this file. Direct user decision (2026-09-11):
// track THIS roster, not the 2-member engine roster, as "new agents
// joining the city," since this is the one that's actually growing (14
// new entries added the same night this was built).

const fs = require('fs');
const path = require('path');
const os = require('os');

const AGENTS_DIR = path.join(os.homedir(), '.claude', 'agents');

// Every real file inspected uses flat `key: value` frontmatter (no
// nested lists) -- a hand-written parser is enough, no need for a new
// YAML-parsing dependency (matches this project's minimal-deps ethos).
// Values may be wrapped in double quotes (e.g. a description containing
// a colon) -- stripped here. Multi-line values are NOT supported and
// are not needed: confirmed every real file's frontmatter block is
// single-line key:value pairs only.
function parseFrontmatter(text) {
  if (!text.startsWith('---\n') && !text.startsWith('---\r\n')) return null;
  const end = text.indexOf('\n---', 4);
  if (end === -1) return null;
  const block = text.slice(0, end);
  const lines = block.split(/\r?\n/).slice(1); // drop the opening '---'
  const fm = {};
  for (const line of lines) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
      value = value.slice(1, -1);
    }
    fm[key] = value;
  }
  return fm;
}

// A real filename slug ("agent-organizer", "quant-analyst", ...) -- this
// is what every genuine agent file in this directory actually uses.
// Guards against a template/placeholder value slipping through (e.g.
// unfilled bracket text like "[kebab-case from purpose]") without
// needing to special-case any specific filename.
const SLUG_RE = /^[a-z][a-z0-9-]*$/;

function loadRosterEntry(filename) {
  const filePath = path.join(AGENTS_DIR, filename);
  const text = fs.readFileSync(filePath, 'utf8');
  const fm = parseFrontmatter(text);
  if (!fm) {
    console.log(`[agent-roster] skipped ${filename}: no frontmatter block`);
    return null;
  }
  if (!fm.name || !SLUG_RE.test(fm.name)) {
    console.log(`[agent-roster] skipped ${filename}: name "${fm.name || ''}" is not a real slug`);
    return null;
  }
  return {
    id: filename.replace(/\.md$/, ''), // stable even if frontmatter later breaks
    name: fm.name,
    description: fm.description || '',
    color: fm.color || null,
    field: fm.field || null,
    model: fm.model || null,
    expertise: fm.expertise || null,
  };
}

function getClaudeAgentRoster() {
  if (!fs.existsSync(AGENTS_DIR)) {
    return { generatedAt: new Date().toISOString(), count: 0, roster: [] };
  }
  const files = fs.readdirSync(AGENTS_DIR).filter((f) => f.endsWith('.md'));
  const roster = files.map(loadRosterEntry).filter(Boolean);
  return { generatedAt: new Date().toISOString(), count: roster.length, roster };
}

module.exports = { getClaudeAgentRoster };

if (require.main === module) {
  console.log(JSON.stringify(getClaudeAgentRoster(), null, 2));
}
