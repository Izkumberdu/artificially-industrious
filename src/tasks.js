// Tracks which AI tasks are still running, one small JSON file per task.
// Files (rather than one shared file) mean two tools starting at the same
// moment can't clobber each other's state.
import { mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const tasksDir = (home) => join(home, 'tasks');

// base64url never contains "/" or "..", so a task id can't escape the folder.
const fileFor = (home, id) =>
  join(tasksDir(home), `${Buffer.from(String(id)).toString('base64url')}.json`);

export function startTask(home, id, source, now = Date.now()) {
  mkdirSync(tasksDir(home), { recursive: true });
  writeFileSync(fileFor(home, id), JSON.stringify({ id: String(id), source, startedAt: now }));
}

export function stopTask(home, id) {
  rmSync(fileFor(home, id), { force: true });
}

// Returns running tasks, deleting any older than timeoutMs so a crashed
// tool can never leave you "active" forever.
export function listActive(home, now = Date.now(), timeoutMs) {
  let names;
  try {
    names = readdirSync(tasksDir(home));
  } catch {
    return [];
  }
  const active = [];
  for (const name of names) {
    if (!name.endsWith('.json')) continue;
    const path = join(tasksDir(home), name);
    let task;
    try {
      task = JSON.parse(readFileSync(path, 'utf8'));
    } catch {
      rmSync(path, { force: true }); // half-written or corrupt
      continue;
    }
    if (now - task.startedAt > timeoutMs) {
      rmSync(path, { force: true });
      continue;
    }
    active.push(task);
  }
  return active.sort((a, b) => a.startedAt - b.startedAt);
}
