import { homedir } from 'node:os';
import { join } from 'node:path';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

export const MODES = ['caffeinate', 'nudge', 'both'];

export const DEFAULTS = {
  // caffeinate: tell macOS "the user is active" (no permissions needed)
  // nudge: post a zero-distance mouse move (needs Accessibility permission)
  mode: 'caffeinate',
  intervalSeconds: 60, // Teams goes Away after ~5 min idle, so once a minute is plenty
  timeoutMinutes: 120, // a task older than this is assumed crashed
  notifyWhenDone: true,
};

export function homeDir() {
  return process.env.INDUSTRIOUS_HOME || join(homedir(), '.industrious');
}

const configPath = (home) => join(home, 'config.json');

export function loadConfig(home = homeDir()) {
  try {
    return { ...DEFAULTS, ...JSON.parse(readFileSync(configPath(home), 'utf8')) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveConfig(changes, home = homeDir()) {
  const next = { ...loadConfig(home), ...changes };
  mkdirSync(home, { recursive: true });
  writeFileSync(configPath(home), JSON.stringify(next, null, 2) + '\n');
  return next;
}
