import { test } from 'node:test';
import assert from 'node:assert/strict';
import { taskIdFrom, mergeClaudeSettings, mergeCursorHooks, shellQuote } from '../src/hooks.js';

test('task id comes from the session or conversation id', () => {
  assert.equal(taskIdFrom('claude', { session_id: 's1' }), 'claude:s1');
  assert.equal(taskIdFrom('cursor', { conversation_id: 'c1' }), 'cursor:c1');
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
