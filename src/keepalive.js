// The two ways of telling macOS (and therefore Teams) that you're still here.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

// Keeps the display awake. Tested: does NOT reset the idle timer Teams reads,
// so on its own it won't keep you green.
export function caffeinate() {
  spawnSync('caffeinate', ['-u', '-t', '1'], { stdio: 'ignore' });
}

// Nudges go through "Industrious Nudge.app", a tiny helper whose only ability
// is a zero-distance mouse move. Launching it with `open` makes macOS check
// the helper's own permission, so the helper is the only app that needs it.
// Must match CFBundleIdentifier in helper/Info.plist.
export const HELPER_ID = 'io.github.izkumberdu.artificially-industrious.nudge';

export function helperPath() {
  return process.env.INDUSTRIOUS_HELPER || join(homedir(), 'Applications', 'Industrious Nudge.app');
}

export const helperInstalled = () => existsSync(helperPath());

// Runs the helper and returns its status ({ trusted, nudged, ... }), or null
// if it isn't installed or didn't report back.
export function runHelper(mode, home) {
  if (!helperInstalled()) return null;
  mkdirSync(home, { recursive: true });
  const statusFile = join(home, 'helper-status.json');
  rmSync(statusFile, { force: true });
  spawnSync('open', ['-g', '-W', '-n', helperPath(), '--args', mode, statusFile], {
    stdio: 'ignore',
    // "prompt" waits for you to answer macOS's notification dialog.
    timeout: mode === 'prompt' ? 90_000 : 15_000,
  });
  try {
    return JSON.parse(readFileSync(statusFile, 'utf8'));
  } catch {
    return null;
  }
}

// prompt=true makes macOS show its permission dialog and list the helper
// under Accessibility / Device Control and Data Access.
export function hasAccessibility(home, prompt = false) {
  return runHelper(prompt ? 'prompt' : 'check', home)?.trusted === true;
}

export function nudge(home) {
  return runHelper('nudge', home)?.nudged === true;
}

// Returns whether the nudge landed, or undefined when the mode has no nudge.
export function keepAlive(mode, home) {
  if (mode === 'caffeinate' || mode === 'both') caffeinate();
  if (mode === 'nudge' || mode === 'both') return nudge(home);
  return undefined;
}

// Shown by the helper, so the notification is from "Industrious Nudge" and
// clicking it does nothing. (osascript's notifications belong to Script
// Editor, which opens when clicked; that's only the fallback now.) Doesn't
// wait for the helper, so AI-tool hooks return immediately.
export function notify(title, body, home) {
  if (helperInstalled()) {
    spawnSync('open', ['-g', '-n', helperPath(), '--args', 'notify', join(home, 'notify-status.json'), title, body], {
      stdio: 'ignore',
      timeout: 5_000,
    });
    return;
  }
  const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  spawnSync('osascript', ['-e', `display notification "${esc(body)}" with title "${esc(title)}"`], {
    stdio: 'ignore',
  });
}
