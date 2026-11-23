#!/usr/bin/env node
// Artificially Industrious — stays "Available" while your AI is still working.
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { startTask, stopTask, listActive } from '../src/tasks.js';
import { homeDir, loadConfig, saveConfig, MODES } from '../src/config.js';
import { ensureKeeper, keeperPid, runKeeper } from '../src/keeper.js';
import { nudge, notify, hasAccessibility } from '../src/keepalive.js';
import {
  readStdin,
  taskIdFrom,
  selfCommand,
  mergeClaudeSettings,
  mergeCursorHooks,
} from '../src/hooks.js';

const HOME = homeDir();
const [cmd, ...args] = process.argv.slice(2);

const activeTasks = () =>
  listActive(HOME, Date.now(), loadConfig(HOME).timeoutMinutes * 60_000);

function begin(id, source) {
  startTask(HOME, id, source);
  ensureKeeper(HOME);
}

function end(id) {
  const existed = activeTasks().some((t) => t.id === id);
  stopTask(HOME, id);
  if (existed && activeTasks().length === 0 && loadConfig(HOME).notifyWhenDone) {
    notify('Your AI is done. Back to work, for real this time.');
  }
}

const USAGE = `Artificially Industrious — stays active while your AI is still working.

Usage:
  industrious run -- <command...>   Stay active while a command runs
  industrious start [id]            Mark a task as started (default id: manual)
  industrious stop [id]             Mark a task as finished
  industrious status                Show running tasks and the keeper
  industrious mode [${MODES.join('|')}]
                                    Show or set how activity is signalled
  industrious permission            Check (and ask macOS for) Accessibility permission
  industrious nudge                 Send one nudge
  industrious install claude|cursor [--write]
                                    Print (or write) the hooks for an AI tool

Internal:
  industrious hook start|stop <source>   Called by AI-tool hooks (reads JSON on stdin)
  industrious keeper                     The background loop
`;

async function main() {
  switch (cmd) {
    case 'start':
      begin(args[0] ?? 'manual', 'manual');
      break;

    case 'stop':
      end(args[0] ?? 'manual');
      break;

    case 'hook': {
      // Must never break or slow down the AI tool: swallow everything.
      const [action, source = 'unknown'] = args;
      try {
        let payload = null;
        try {
          payload = JSON.parse((await readStdin()) || 'null');
        } catch {}
        const id = taskIdFrom(source, payload);
        if (action === 'start') begin(id, source);
        else if (action === 'stop') end(id);
      } catch (e) {
        process.stderr.write(`industrious: ${e.message}\n`);
      }
      // Cursor's beforeSubmitPrompt expects an answer; Claude Code would add
      // any stdout to the prompt, so it gets nothing.
      if (source === 'cursor' && action === 'start') process.stdout.write('{"continue":true}\n');
      process.exit(0);
    }

    case 'run': {
      const rest = args[0] === '--' ? args.slice(1) : args;
      if (rest.length === 0) throw new Error('run needs a command, e.g. industrious run -- codex');
      const id = `run:${process.pid}`;
      begin(id, rest[0]);
      const child = spawn(rest[0], rest.slice(1), { stdio: 'inherit' });
      const forward = (sig) => child.kill(sig);
      process.on('SIGINT', forward);
      process.on('SIGTERM', forward);
      child.on('error', (e) => {
        end(id);
        console.error(`industrious: ${e.message}`);
        process.exit(127);
      });
      child.on('exit', (code, signal) => {
        end(id);
        process.exit(code ?? (signal ? 1 : 0));
      });
      break;
    }

    case 'status': {
      const tasks = activeTasks();
      const cfg = loadConfig(HOME);
      const pid = keeperPid(HOME);
      console.log(`mode: ${cfg.mode}, every ${cfg.intervalSeconds}s, timeout ${cfg.timeoutMinutes}m`);
      console.log(`keeper: ${pid ? `running (pid ${pid})` : 'not running'}`);
      if (cfg.mode !== 'caffeinate') {
        console.log(
          `accessibility: ${hasAccessibility() ? 'granted' : 'NOT granted, so nudges are dropped (run `industrious permission`)'}`,
        );
      }
      if (tasks.length === 0) console.log('no AI tasks running');
      for (const t of tasks) {
        const mins = Math.round((Date.now() - t.startedAt) / 60_000);
        console.log(`  ${t.id}  (${t.source}, ${mins}m)`);
      }
      break;
    }

    case 'mode': {
      if (!args[0]) {
        console.log(loadConfig(HOME).mode);
        break;
      }
      if (!MODES.includes(args[0])) throw new Error(`mode must be one of: ${MODES.join(', ')}`);
      saveConfig({ mode: args[0] }, HOME);
      console.log(`mode set to ${args[0]}`);
      if (args[0] !== 'caffeinate') {
        console.log(
          hasAccessibility()
            ? 'Accessibility permission: granted.'
            : 'Nudge needs Accessibility permission. Run `industrious permission` from the app that runs your AI tool.',
        );
      }
      break;
    }

    case 'nudge':
      if (!hasAccessibility()) {
        console.log(
          'No Accessibility permission yet, so macOS would silently drop the nudge.\n' +
            'Run `industrious permission` to ask for it.',
        );
        process.exit(1);
      }
      console.log(nudge() ? 'nudge sent' : 'nudge failed');
      break;

    case 'permission':
      if (hasAccessibility(true)) {
        console.log('Accessibility permission: granted. Nudge mode will work.');
      } else {
        console.log(
          'Accessibility permission: not granted.\n' +
            'macOS should now show a prompt, and the app running this command is now listed in\n' +
            'System Settings → Privacy & Security → Accessibility (called "Device Control and Data Access"\n' +
            'on newer macOS). Switch it on, then quit and reopen that app.\n' +
            'Using the Claude desktop app? Switch on the lowercase "claude" entry, not the orange "Claude".\n' +
            'Not listed? Click "+" there and add the app yourself (Terminal, iTerm, Claude, Cursor…).',
        );
      }
      break;

    case 'install': {
      const [tool] = args;
      const write = args.includes('--write');
      const targets = {
        claude: [join(homedir(), '.claude', 'settings.json'), mergeClaudeSettings],
        cursor: [join(homedir(), '.cursor', 'hooks.json'), mergeCursorHooks],
      };
      if (!targets[tool]) throw new Error('install needs a tool: claude or cursor');
      const [path, merge] = targets[tool];
      const current = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {};
      const next = merge(current, selfCommand());
      if (!write) {
        console.log(`Would write ${path}:\n`);
        console.log(JSON.stringify(next, null, 2));
        console.log('\nRun again with --write to apply (a backup is made first).');
        break;
      }
      mkdirSync(dirname(path), { recursive: true });
      if (existsSync(path)) {
        const backup = `${path}.bak-${Date.now()}`;
        copyFileSync(path, backup);
        console.log(`backup: ${backup}`);
      }
      writeFileSync(path, JSON.stringify(next, null, 2) + '\n');
      console.log(`hooks installed in ${path}`);
      break;
    }

    case 'keeper':
      await runKeeper(HOME);
      break;

    default:
      process.stdout.write(USAGE);
      if (cmd && cmd !== 'help' && cmd !== '--help' && cmd !== '-h') process.exit(1);
  }
}

main().catch((e) => {
  console.error(`industrious: ${e.message}`);
  process.exit(1);
});
