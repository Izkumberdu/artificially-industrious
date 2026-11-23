import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  taskIdFrom,
  mergeClaudeSettings,
  mergeCursorHooks,
  mergeCopilotHooks,
  removeClaudeHooks,
  removeCursorHooks,
  shellQuote,
  selfCommand,
} from '../src/hooks.js';

test('task id comes from the session or conversation id', () => {
  assert.equal(taskIdFrom('claude', { session_id: 's1' }), 'claude:s1');
  assert.equal(taskIdFrom('cursor', { conversation_id: 'c1' }), 'cursor:c1');
  assert.equal(taskIdFrom('copilot', { sessionId: 'p1' }), 'copilot:p1');
});

test('Copilot hooks file has start and stop hooks and stays idempotent', () => {
  const once = mergeCopilotHooks({}, 'IND');
  assert.equal(once.version, 1);
  assert.deepEqual(once.hooks.userPromptSubmitted, [
    { type: 'command', bash: 'IND hook start copilot', timeoutSec: 10 },
  ]);
  assert.equal(once.hooks.agentStop[0].bash, 'IND hook stop copilot');
  assert.equal(once.hooks.sessionEnd[0].bash, 'IND hook stop copilot');
  assert.deepEqual(mergeCopilotHooks(once, 'IND'), once);
});

test('task id falls back to one shared id per tool', () => {
  assert.equal(taskIdFrom('claude', {}), 'claude:default');
  assert.equal(taskIdFrom('claude', null), 'claude:default');
});

test('shellQuote survives spaces and quotes', () => {
  assert.equal(shellQuote('/a b/c'), `'/a b/c'`);
  assert.equal(shellQuote(`it's`), `'it'\\''s'`);
});

test('Claude settings gain start and stop hooks without losing existing ones', () => {
  const existing = {
    model: 'opus',
    hooks: { Stop: [{ hooks: [{ type: 'command', command: 'say done' }] }] },
  };
  const merged = mergeClaudeSettings(existing, 'IND');
  assert.equal(merged.model, 'opus');
  assert.equal(merged.hooks.Stop.length, 2);
  assert.equal(merged.hooks.Stop[0].hooks[0].command, 'say done');
  assert.equal(merged.hooks.Stop[1].hooks[0].command, 'IND hook stop claude');
  assert.equal(merged.hooks.UserPromptSubmit[0].hooks[0].command, 'IND hook start claude');
  assert.equal(merged.hooks.SessionEnd[0].hooks[0].command, 'IND hook stop claude');
});

test('merging Claude settings twice does not duplicate hooks', () => {
  const once = mergeClaudeSettings({}, 'IND');
  const twice = mergeClaudeSettings(once, 'IND');
  assert.deepEqual(twice, once);
});

test('Cursor hooks.json gains hooks and stays idempotent', () => {
  const once = mergeCursorHooks({}, 'IND');
  assert.equal(once.version, 1);
  assert.deepEqual(once.hooks.beforeSubmitPrompt, [{ command: 'IND hook start cursor' }]);
  assert.deepEqual(once.hooks.stop, [{ command: 'IND hook stop cursor' }]);
  assert.deepEqual(mergeCursorHooks(once, 'IND'), once);
});

test('removing hooks from Claude settings keeps everything else', () => {
  const user = { hooks: [{ type: 'command', command: 'say done' }] };
  const settings = mergeClaudeSettings(
    { model: 'opus', hooks: { Stop: [user] } },
    "'/n/node' '/x/artificially-industrious/bin/industrious.js'",
  );
  const cleaned = removeClaudeHooks(settings);
  assert.deepEqual(cleaned, { model: 'opus', hooks: { Stop: [user] } });
});

test('removing the only hooks drops the empty hooks object', () => {
  const cleaned = removeClaudeHooks(mergeClaudeSettings({ theme: 'auto' }, "'n' '/a/bin/industrious.js'"));
  assert.deepEqual(cleaned, { theme: 'auto' });
});

test('removing hooks from Cursor keeps other hooks', () => {
  const merged = mergeCursorHooks({ version: 1, hooks: { stop: [{ command: 'say hi' }] } }, "'n' '/a/bin/industrious.js'");
  assert.deepEqual(removeCursorHooks(merged), { version: 1, hooks: { stop: [{ command: 'say hi' }] } });
});

test('reinstalling from a new location replaces our old hooks instead of duplicating', () => {
  const oldCmd = "'/usr/bin/node' '/old/place/bin/industrious.js'";
  const brewCmd = "'/opt/homebrew/opt/artificially-industrious/bin/industrious'";
  const claude = mergeClaudeSettings(mergeClaudeSettings({}, oldCmd), brewCmd);
  assert.equal(claude.hooks.Stop.length, 1);
  assert.equal(claude.hooks.Stop[0].hooks[0].command, `${brewCmd} hook stop claude`);
  const cursor = mergeCursorHooks(mergeCursorHooks({}, oldCmd), brewCmd);
  assert.deepEqual(cursor.hooks.stop, [{ command: `${brewCmd} hook stop cursor` }]);
  const copilot = mergeCopilotHooks(mergeCopilotHooks({}, oldCmd), brewCmd);
  assert.equal(copilot.hooks.agentStop.length, 1);
  assert.equal(copilot.hooks.agentStop[0].bash, `${brewCmd} hook stop copilot`);
  assert.deepEqual(removeClaudeHooks(claude), {});
});

test('Homebrew wrapper path becomes the hook command', () => {
  process.env.INDUSTRIOUS_BIN = '/opt/homebrew/opt/artificially-industrious/bin/industrious';
  try {
    assert.equal(selfCommand(), "'/opt/homebrew/opt/artificially-industrious/bin/industrious'");
  } finally {
    delete process.env.INDUSTRIOUS_BIN;
  }
});
