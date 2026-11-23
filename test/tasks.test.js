import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startTask, stopTask, listActive } from '../src/tasks.js';

function withHome(fn) {
  const home = mkdtempSync(join(tmpdir(), 'industrious-'));
  try {
    return fn(home);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
}

test('a started task is active until stopped', () =>
  withHome((home) => {
    startTask(home, 'abc', 'claude', 1000);
    assert.deepEqual(
      listActive(home, 2000, 60_000).map((t) => t.id),
      ['abc'],
    );
    stopTask(home, 'abc');
    assert.deepEqual(listActive(home, 3000, 60_000), []);
  }));

test('tasks from several tools are tracked separately', () =>
  withHome((home) => {
    startTask(home, 'one', 'claude', 1000);
    startTask(home, 'two', 'cursor', 1000);
    stopTask(home, 'one');
    const active = listActive(home, 2000, 60_000);
    assert.deepEqual(active.map((t) => [t.id, t.source]), [['two', 'cursor']]);
  }));

test('stale tasks are pruned after the timeout', () =>
  withHome((home) => {
    startTask(home, 'old', 'claude', 0);
    startTask(home, 'new', 'claude', 50_000);
    const active = listActive(home, 70_000, 60_000);
    assert.deepEqual(active.map((t) => t.id), ['new']);
    // pruned for good, not just hidden
    assert.deepEqual(listActive(home, 70_001, 10 ** 9).map((t) => t.id), ['new']);
  }));

test('restarting a task refreshes its timestamp', () =>
  withHome((home) => {
    startTask(home, 'abc', 'claude', 0);
    startTask(home, 'abc', 'claude', 50_000);
    assert.equal(listActive(home, 70_000, 60_000).length, 1);
  }));

test('stopping an unknown task is harmless', () =>
  withHome((home) => {
    assert.doesNotThrow(() => stopTask(home, 'nope'));
  }));

test('ids with path characters cannot escape the tasks folder', () =>
  withHome((home) => {
    startTask(home, '../../etc/evil', 'claude', 1000);
    const active = listActive(home, 2000, 60_000);
    assert.equal(active.length, 1);
    assert.equal(active[0].id, '../../etc/evil');
    stopTask(home, '../../etc/evil');
    assert.deepEqual(listActive(home, 3000, 60_000), []);
  }));
