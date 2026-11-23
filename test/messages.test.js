import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toolName, doneNotification } from '../src/messages.js';

test('known tools get their proper names', () => {
  assert.equal(toolName('claude'), 'Claude');
  assert.equal(toolName('cursor'), 'Cursor');
  assert.equal(toolName('copilot'), 'Copilot');
  assert.equal(toolName('codex'), 'Codex');
});

test('wrapped commands are named after the program, not its path', () => {
  assert.equal(toolName('/opt/homebrew/bin/codex'), 'Codex');
  assert.equal(toolName('aider'), 'Aider');
});

test('manual or unknown sources fall back to "Your AI"', () => {
  assert.equal(toolName('manual'), 'Your AI');
  assert.equal(toolName(undefined), 'Your AI');
  assert.equal(toolName(''), 'Your AI');
});

test('says which tool finished', () => {
  const n = doneNotification({ source: 'claude' }, []);
  assert.equal(n.title, 'Claude is finished working');
  assert.match(n.body, /back to work/i);
});

test('always says back to work, even if other tools are still running', () => {
  const n = doneNotification({ source: 'claude' }, [{ source: 'cursor' }, { source: 'codex' }]);
  assert.equal(n.title, 'Claude is finished working');
  assert.equal(n.body, 'Back to work, for real this time.');
});
