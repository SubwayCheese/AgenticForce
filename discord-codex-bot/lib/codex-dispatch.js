// The help agent's dispatch core. Spawns a real `codex exec` subprocess -- intentionally NOT
// routed through the AgentVault /bus/ protocol; this bot is meant to be fully standalone.
//
// runCodex() is the generic primitive (preamble/body/timeout all caller-supplied); askCodex()
// is /ask's thin wrapper over it, preserved byte-identical to the original single-purpose
// version so /ask's behavior does not change. /summarize (commands/summarize.js) calls
// runCodex() directly with its own preamble and a longer timeout.

const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const SANDBOX_MODE = process.env.CODEX_SANDBOX_MODE || 'read-only';
const DEFAULT_TIMEOUT_MS = 90_000;

const SYSTEM_PREAMBLE = `You are answering a question asked by a user in a Discord server, dispatched via a standalone bot (not an interactive chat session -- this is a single, one-shot request with no follow-up in this same call). Use your real web-search tool when it would genuinely improve the answer's accuracy or currency (e.g. current docs, recent releases, current events) -- do not fabricate search results, and say so plainly if you're answering from general knowledge instead. Keep the reply focused and reasonably concise: Discord messages are capped at 2000 characters, so avoid padding, and prefer clear structure (short paragraphs, code blocks for code) over exhaustive detail. This is engineering/technical help and writing assistance -- stay on topic and be direct.`;

function runCodex({ preamble, body, timeoutMs = DEFAULT_TIMEOUT_MS }) {
  return new Promise((resolve, reject) => {
    const outputFile = path.join(os.tmpdir(), `codex-discord-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`);
    const args = [
      'exec',
      '--ephemeral',
      '--sandbox', SANDBOX_MODE,
      '--skip-git-repo-check',
      '--output-last-message', outputFile,
      '-',
    ];

    const child = spawn('codex', args, { shell: true });
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`codex exec timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      let output = null;
      try {
        output = fs.readFileSync(outputFile, 'utf8');
        fs.unlinkSync(outputFile);
      } catch (_) { /* file may not exist if codex errored before writing it */ }

      if (output && output.trim()) {
        resolve(output.trim());
      } else {
        reject(new Error(`codex exec produced no output (exit ${code}): ${stderr.slice(0, 500)}`));
      }
    });

    child.stdin.write(`${preamble}\n\n${body}\n`);
    child.stdin.end();
  });
}

function askCodex(question, extraContext) {
  const contextBlock = extraContext ? `${extraContext}\n\n` : '';
  return runCodex({
    preamble: SYSTEM_PREAMBLE,
    body: `${contextBlock}User's question:\n${question}`,
  });
}

module.exports = { askCodex, runCodex, DEFAULT_TIMEOUT_MS };
