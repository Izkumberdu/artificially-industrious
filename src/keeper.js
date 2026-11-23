// The background loop. One keeper runs while any AI task is active, and it
// exits on its own once nothing is left, so there's no daemon to manage.
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, rmSync, mkdirSync, openSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listActive } from './tasks.js';
import { loadConfig } from './config.js';
import { keepAlive, helperInstalled } from './keepalive.js';

const pidFile = (home) => join(home, 'keeper.pid');
const BIN = fileURLToPath(new URL('../bin/industrious.js', import.meta.url));

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === 'EPERM';
  }
}

export function keeperPid(home) {
  try {
    const pid = Number(readFileSync(pidFile(home), 'utf8'));
    return pid && isAlive(pid) ? pid : null;
  } catch {
    return null;
  }
}

// Starts a detached keeper unless one is already running.
export function ensureKeeper(home) {
  if (keeperPid(home)) return;
  mkdirSync(home, { recursive: true });
  const log = openSync(join(home, 'keeper.log'), 'a');
  spawn(process.execPath, [BIN, 'keeper'], {
    detached: true,
    stdio: ['ignore', log, log],
    env: { ...process.env, INDUSTRIOUS_HOME: home },
  }).unref();
}

// Claims the pid file; returns false if another live keeper owns it.
function claim(home) {
  const other = keeperPid(home);
  if (other && other !== process.pid) return false;
  writeFileSync(pidFile(home), String(process.pid));
  return true;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function runKeeper(home) {
  if (!claim(home)) return;
  const release = () => {
    if (keeperPid(home) === process.pid) rmSync(pidFile(home), { force: true });
  };
  process.on('SIGTERM', () => {
    release();
    process.exit(0);
  });

  let warned = false;
  for (;;) {
    const cfg = loadConfig(home);
    const active = listActive(home, Date.now(), cfg.timeoutMinutes * 60_000);
    if (active.length === 0) {
      release();
      // A task may have started between the check and the release; if so,
      // keep going rather than leave it without a keeper.
      if (listActive(home, Date.now(), cfg.timeoutMinutes * 60_000).length === 0) return;
      if (!claim(home)) return;
      continue;
    }
    const nudged = keepAlive(cfg.mode, home);
    if (nudged === false && !warned) {
      console.log(
        `${new Date().toISOString()} nudge failed: ` +
          (helperInstalled()
            ? 'Industrious Nudge has no Accessibility permission. Run `industrious permission`.'
            : 'Industrious Nudge is not installed. Run `industrious install helper`.') +
          ' Teams will still go Away.',
      );
      warned = true;
    }
    if (nudged) warned = false;
    await sleep(cfg.intervalSeconds * 1000);
  }
}
