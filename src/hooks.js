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
// `npm link` and with spaces in the path. Homebrew's wrapper sets
// INDUSTRIOUS_BIN to its stable opt path, so hooks survive `brew upgrade`.
export function selfCommand() {
  if (process.env.INDUSTRIOUS_BIN) return shellQuote(process.env.INDUSTRIOUS_BIN);
  const bin = new URL('../bin/industrious.js', import.meta.url).pathname;
  return `${shellQuote(process.execPath)} ${shellQuote(decodeURIComponent(bin))}`;
}

// ~/.claude/settings.json
// Each merge first drops our old hooks, so switching between a clone and
// Homebrew (or moving the folder) replaces them instead of adding duplicates.
export function mergeClaudeSettings(settings, cmd) {
  const next = removeClaudeHooks(settings);
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
  for (const [event, list] of Object.entries(next.hooks ?? {})) next.hooks[event] = list.filter((h) => !isOurs(h.bash));
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
  const next = removeCursorHooks(config);
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

// Uninstall: strip only our hooks, matched by the command they run.
// Matches both `…/industrious.js' hook …` and Homebrew's `…/industrious' hook …`.
const isOurs = (command) => /industrious(\.js)?'? hook (start|stop) /.test(String(command ?? ''));

export function removeClaudeHooks(settings) {
  const next = structuredClone(settings ?? {});
  for (const [event, groups] of Object.entries(next.hooks ?? {})) {
    const kept = groups
      .map((g) => ({ ...g, hooks: (g.hooks ?? []).filter((h) => !isOurs(h.command)) }))
      .filter((g) => g.hooks.length);
    if (kept.length) next.hooks[event] = kept;
    else delete next.hooks[event];
  }
  if (next.hooks && Object.keys(next.hooks).length === 0) delete next.hooks;
  return next;
}

export function removeCursorHooks(config) {
  const next = structuredClone(config ?? {});
  for (const [event, list] of Object.entries(next.hooks ?? {})) {
    const kept = list.filter((h) => !isOurs(h.command));
    if (kept.length) next.hooks[event] = kept;
    else delete next.hooks[event];
  }
  return next;
}
