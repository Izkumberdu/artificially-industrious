// What the "done" notification says.
import { basename } from 'node:path';

const KNOWN = {
  claude: 'Claude',
  cursor: 'Cursor',
  copilot: 'Copilot',
  codex: 'Codex',
  gemini: 'Gemini',
};

// A hook's source ("claude") or a wrapped command ("/opt/homebrew/bin/codex").
export function toolName(source) {
  if (!source || source === 'manual' || source === 'unknown') return 'Your AI';
  const name = basename(String(source));
  return KNOWN[name.toLowerCase()] ?? name.charAt(0).toUpperCase() + name.slice(1);
}

export function doneNotification(finished, remaining) {
  const title = `${toolName(finished?.source)} is finished working`;
  const still = [...new Set(remaining.map((t) => toolName(t.source)))];
  const body = still.length
    ? `Still working: ${still.join(', ')}`
    : 'Back to work, for real this time.';
  return { title, body };
}
