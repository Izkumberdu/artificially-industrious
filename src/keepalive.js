// The two ways of telling macOS (and therefore Teams) that you're still here.
import { spawnSync } from 'node:child_process';

// Declares user activity via IOPMAssertionDeclareUserActivity. No permissions
// needed, but it's unverified whether Teams counts it — see README.
export function caffeinate() {
  spawnSync('caffeinate', ['-u', '-t', '1'], { stdio: 'ignore' });
}

// Posts a mouse-moved event to where the cursor already is: nothing visibly
// moves, but it counts as real input. macOS silently drops it unless the app
// running this (your terminal, or node) has Accessibility permission.
// Numbers are kCGEventMouseMoved=5, kCGMouseButtonLeft=0, kCGHIDEventTap=0.
const NUDGE_JXA = `
ObjC.import('CoreGraphics');
var here = $.CGEventGetLocation($.CGEventCreate(null));
$.CGEventPost(0, $.CGEventCreateMouseEvent(null, 5, here, 0));
`;

export function nudge() {
  const r = spawnSync('osascript', ['-l', 'JavaScript', '-e', NUDGE_JXA], { encoding: 'utf8' });
  return r.status === 0;
}

// Whether macOS lets this process post input events. With prompt=true, macOS
// shows its "would like to control this computer" dialog and adds the app
// that launched us (Terminal, iTerm, Claude, Cursor…) to the Accessibility
// list — apps don't appear there until they've asked at least once.
export function hasAccessibility(prompt = false) {
  const jxa = `ObjC.import('ApplicationServices');
${prompt ? `$.AXIsProcessTrustedWithOptions($({ AXTrustedCheckOptionPrompt: true }))` : `$.AXIsProcessTrusted()`}`;
  const r = spawnSync('osascript', ['-l', 'JavaScript', '-e', jxa], { encoding: 'utf8' });
  return r.stdout.trim() === 'true';
}

export function keepAlive(mode) {
  if (mode === 'caffeinate' || mode === 'both') caffeinate();
  if (mode === 'nudge' || mode === 'both') nudge();
}

export function notify(message, title = 'Artificially Industrious') {
  const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  spawnSync('osascript', ['-e', `display notification "${esc(message)}" with title "${esc(title)}"`], {
    stdio: 'ignore',
  });
}
