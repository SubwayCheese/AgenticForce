// claude-worker.js -- Round 20. Async, sandboxed dispatcher for the headless
// Claude CLI (the builder's counterpart of research-swarm-worker.js, which is
// hard-wired to codex's output-file mechanism). Differences that matter:
//   * output comes from --output-format stream-json (stdout), not a file;
//   * cwd is the PRODUCT dir, and the child runs in its own process group so a
//     timeout kills the whole tree, not just the top process;
//   * tools are an explicit allowlist (no Bash, no WebFetch/WebSearch: a
//     builder must not read attacker-controlled pages) and MCP connectors are
//     disabled (the probe showed --restricted alone still loads claude.ai
//     connector tools);
//   * usage state is read STRUCTURALLY from rate_limit_event (status,
//     resetsAt, per-window utilization), never grepped from prose.
// CLAUDE_BIN overrides the binary (tests point it at a fake script).

const { spawn } = require('child_process');
const os = require('os');

const DEFAULT_TOOLS = 'Read,Write,Edit,Glob,Grep';
const DEFAULT_TIMEOUT_MS = 25 * 60 * 1000;

function buildArgs({ model = 'sonnet', effort = 'medium', tools = DEFAULT_TOOLS, sessionId, resume } = {}) {
  const args = [
    '-p', '--output-format', 'stream-json', '--verbose',
    '--restricted', '--tools', tools,
    '--permission-mode', 'acceptEdits', '--permission-prompts', 'none',
    '--setting-sources', '', '--disable-slash-commands',
    '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}',
    '--model', model, '--effort', effort,
  ];
  if (resume) args.push('--resume', resume);
  else if (sessionId) args.push('--session-id', sessionId);
  return args;
}

// Parses the stream-json transcript into the few facts the orchestrator needs.
function parseStream(text) {
  const out = { result: '', isError: false, sessionId: null, costUsd: null, rateLimit: null, windows: null, events: 0 };
  for (const line of String(text).split('\n')) {
    if (!line.trim()) continue;
    let e; try { e = JSON.parse(line); } catch (_) { continue; }
    out.events++;
    if (e.session_id) out.sessionId = e.session_id;
    if (e.type === 'rate_limit_event' && e.rate_limit_info) {
      const i = e.rate_limit_info;
      out.rateLimit = { status: i.status, resetsAt: i.resetsAt ? i.resetsAt * 1000 : null, type: i.rateLimitType, utilization: i.utilization };
      if (i.unifiedWindows) out.windows = i.unifiedWindows;
    }
    if (e.type === 'result') {
      out.result = typeof e.result === 'string' ? e.result : '';
      out.isError = !!e.is_error;
      if (typeof e.total_cost_usd === 'number') out.costUsd = e.total_cost_usd;
    }
  }
  return out;
}

function dispatchClaudeAsync(prompt, { cwd, timeoutMs = DEFAULT_TIMEOUT_MS, bin = process.env.CLAUDE_BIN || 'claude', ...argOpts } = {}) {
  return new Promise((resolve) => {
    const env = { PATH: `${os.homedir()}/.local/bin:${process.env.PATH || '/usr/bin:/bin'}`, HOME: os.homedir(), LANG: 'C.UTF-8' };
    let settled = false, timer, stdout = '', stderr = '', child;
    const finish = (r) => { if (settled) return; settled = true; clearTimeout(timer); resolve({ ...parseStream(stdout), stderr, exitCode: r.exitCode, timedOut: !!r.timedOut, spawnError: r.spawnError || null }); };
    try { child = spawn(bin, buildArgs(argOpts), { cwd, env, stdio: ['pipe', 'pipe', 'pipe'], detached: true }); }
    catch (err) { return finish({ exitCode: 1, spawnError: err.message }); }
    child.on('error', (err) => finish({ exitCode: 1, spawnError: err.message }));
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('close', (code) => finish({ exitCode: code }));
    child.stdin.on('error', () => {});
    child.stdin.write(prompt); child.stdin.end();
    timer = setTimeout(() => { try { process.kill(-child.pid, 'SIGKILL'); } catch (_) { try { child.kill('SIGKILL'); } catch (__) {} } finish({ exitCode: 1, timedOut: true }); }, timeoutMs);
  });
}

module.exports = { dispatchClaudeAsync, buildArgs, parseStream, DEFAULT_TOOLS };
