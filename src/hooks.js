// Adapters that turn AI-tool hook events into start/stop calls, plus the
// helpers that install those hooks into each tool's config.

export function readStdin(timeoutMs = 1000) {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) return resolve('');
    let data = '';
    const done = () => resolve(data);
    const timer = setTimeout(done, timeoutMs);
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => (data += chunk));
    process.stdin.on('end', () => {
      clearTimeout(timer);
      done();
    });
    process.stdin.on('error', done);
  });
}

// Claude Code sends session_id; Cursor sends conversation_id; Copilot sends sessionId.
export function taskIdFrom(source, payload) {
  const id = payload?.session_id ?? payload?.conversation_id ?? payload?.sessionId ?? 'default';
  return `${source}:${id}`;
}

export function shellQuote(s) {
  return `'${String(s).replace(/'/g, `'\\''`)}'`;
}

// The command hooks should run: node + this repo's bin, so it works without
// `npm link` and with spaces in the path.
export function selfCommand() {
  const bin = new URL('../bin/industrious.js', import.meta.url).pathname;
  return `${shellQuote(process.execPath)} ${shellQuote(decodeURIComponent(bin))}`;
}

// ~/.claude/settings.json
export function mergeClaudeSettings(settings, cmd) {
  const next = structuredClone(settings ?? {});
  next.hooks ??= {};
  const add = (event, command) => {
    const groups = (next.hooks[event] ??= []);
    const present = groups.some((g) => g.hooks?.some((h) => h.command === command));
    if (!present) groups.push({ hooks: [{ type: 'command', command }] });
  };
  add('UserPromptSubmit', `${cmd} hook start claude`);
  add('Stop', `${cmd} hook stop claude`);
  add('SessionEnd', `${cmd} hook stop claude`);
  return next;
}

// ~/.copilot/hooks/industrious.json — read by GitHub Copilot in VS Code
// (agent mode) and by the Copilot CLI. agentStop fires once per prompt.
export function mergeCopilotHooks(config, cmd) {
  const next = structuredClone(config ?? {});
  next.version ??= 1;
  next.hooks ??= {};
  const add = (event, bash) => {
    const list = (next.hooks[event] ??= []);
    if (!list.some((h) => h.bash === bash)) list.push({ type: 'command', bash, timeoutSec: 10 });
  };
  add('userPromptSubmitted', `${cmd} hook start copilot`);
  add('agentStop', `${cmd} hook stop copilot`);
  add('sessionEnd', `${cmd} hook stop copilot`);
  return next;
}

// ~/.cursor/hooks.json
export function mergeCursorHooks(config, cmd) {
  const next = structuredClone(config ?? {});
  next.version ??= 1;
  next.hooks ??= {};
  const add = (event, command) => {
    const list = (next.hooks[event] ??= []);
    if (!list.some((h) => h.command === command)) list.push({ command });
  };
  add('beforeSubmitPrompt', `${cmd} hook start cursor`);
  add('stop', `${cmd} hook stop cursor`);
  return next;
}
