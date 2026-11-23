#!/usr/bin/env node
// Artificially Industrious — stays "Available" while your AI is still working.
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, copyFileSync, existsSync, mkdirSync, rmSync, renameSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { startTask, stopTask, listActive } from '../src/tasks.js';
import { doneNotification } from '../src/messages.js';
import { homeDir, loadConfig, saveConfig, MODES } from '../src/config.js';
import { ensureKeeper, keeperPid, runKeeper } from '../src/keeper.js';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { nudge, notify, hasAccessibility, helperInstalled, helperPath, HELPER_ID } from '../src/keepalive.js';
import {
  readStdin,
  taskIdFrom,
  selfCommand,
  mergeClaudeSettings,
  mergeCursorHooks,
  mergeCopilotHooks,
  removeClaudeHooks,
  removeCursorHooks,
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
  const finished = activeTasks().find((t) => t.id === id);
  stopTask(HOME, id);
  if (finished && loadConfig(HOME).notifyWhenDone) {
    const { title, body } = doneNotification(finished);
    notify(title, body, HOME);
  }
}

function helperState() {
  if (!helperInstalled()) return 'not installed, so nudges are off (run `industrious install helper`)';
  return hasAccessibility(HOME)
    ? `ready (${helperPath()})`
    : 'installed but has no permission, so nudges are dropped (run `industrious permission`)';
}

const USAGE = `Artificially Industrious — stays active while your AI is still working.

Usage:
  industrious run -- <command...>   Stay active while a command runs
  industrious start [id] [tool]     Mark a task as started (tool names the notification)
  industrious stop [id]             Mark a task as finished
  industrious status                Show running tasks and the keeper
  industrious mode [${MODES.join('|')}]
                                    Show or set how activity is signalled
  industrious install helper        Build the Industrious Nudge helper app into ~/Applications
  industrious permission            Ask macOS to give the helper Accessibility permission
  industrious nudge                 Send one nudge
  industrious install claude|copilot|cursor [--write]
                                    Print (or write) the hooks for an AI tool

  industrious uninstall             Remove the hooks, the helper app and all state

Internal:
  industrious hook start|stop <source>   Called by AI-tool hooks (reads JSON on stdin)
  industrious keeper                     The background loop
`;

async function main() {
  switch (cmd) {
    case 'start':
      begin(args[0] ?? 'manual', args[1] ?? 'manual');
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
      if (cfg.mode !== 'caffeinate') console.log(`helper: ${helperState()}`);
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
      if (args[0] !== 'caffeinate') console.log(`helper: ${helperState()}`);
      break;
    }

    case 'nudge':
      if (!helperInstalled() || !hasAccessibility(HOME)) {
        console.log(`helper: ${helperState()}`);
        process.exit(1);
      }
      console.log(nudge(HOME) ? 'nudge sent' : 'nudge failed');
      break;

    case 'permission':
      if (!helperInstalled()) {
        console.log(`helper: ${helperState()}`);
        process.exit(1);
      }
      if (hasAccessibility(HOME, true)) {
        console.log('Industrious Nudge has permission. Nudges will work.');
        break;
      }
      console.log(
        'Switch on "Industrious Nudge" in System Settings → Privacy & Security → Accessibility\n' +
          '(called "Device Control and Data Access" on newer macOS). Waiting up to 2 minutes…\n' +
          'Tip: after a rebuild, remove any old Industrious Nudge entry with − first.\n' +
          'Don\'t add it yourself with +; use the entry macOS just created.',
      );
      for (let waited = 0; waited < 120; waited += 3) {
        await new Promise((r) => setTimeout(r, 3000));
        if (hasAccessibility(HOME)) {
          console.log('Granted. Nudges will work.');
          process.exit(0);
        }
      }
      console.log('Still not granted. Run `industrious permission` again when you are ready.');
      process.exit(1);

    case 'install': {
      const [tool] = args;
      if (tool === 'helper') {
        const script = fileURLToPath(new URL('../scripts/build-helper.sh', import.meta.url));
        const r = spawnSync('zsh', [script], { stdio: 'inherit' });
        if (r.status !== 0) throw new Error('helper build failed (needs Xcode Command Line Tools: xcode-select --install)');
        console.log('Next: industrious permission');
        break;
      }
      const write = args.includes('--write');
      const targets = {
        claude: [join(homedir(), '.claude', 'settings.json'), mergeClaudeSettings],
        cursor: [join(homedir(), '.cursor', 'hooks.json'), mergeCursorHooks],
        copilot: [
          join(process.env.COPILOT_HOME || join(homedir(), '.copilot'), 'hooks', 'industrious.json'),
          mergeCopilotHooks,
        ],
      };
      if (!targets[tool]) throw new Error('install needs: helper, claude, copilot or cursor');
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

    case 'uninstall': {
      const home = homedir();
      const done = (msg) => console.log(`✓ ${msg}`);

      // 1. Hooks, so no AI tool calls us any more.
      const backupAndWrite = (path, next) => {
        copyFileSync(path, `${path}.bak-${Date.now()}`);
        writeFileSync(path, JSON.stringify(next, null, 2) + '\n');
      };
      const claude = join(home, '.claude', 'settings.json');
      if (existsSync(claude)) {
        const cur = JSON.parse(readFileSync(claude, 'utf8'));
        const next = removeClaudeHooks(cur);
        if (JSON.stringify(next) !== JSON.stringify(cur)) {
          backupAndWrite(claude, next);
          done(`removed Claude Code hooks from ${claude} (backup made)`);
        }
      }
      const cursor = join(home, '.cursor', 'hooks.json');
      if (existsSync(cursor)) {
        const cur = JSON.parse(readFileSync(cursor, 'utf8'));
        const next = removeCursorHooks(cur);
        if (JSON.stringify(next) !== JSON.stringify(cur)) {
          backupAndWrite(cursor, next);
          done(`removed Cursor hooks from ${cursor} (backup made)`);
        }
      }
      const copilot = join(process.env.COPILOT_HOME || join(home, '.copilot'), 'hooks', 'industrious.json');
      if (existsSync(copilot)) {
        rmSync(copilot);
        done(`removed Copilot hooks (${copilot})`);
      }

      // 2. The keeper.
      const pid = keeperPid(HOME);
      if (pid) {
        try { process.kill(pid, 'SIGTERM'); } catch {}
        done('stopped the keeper');
      }

      // 3. The helper app goes to the Trash, so it can be recovered.
      if (helperInstalled()) {
        const trash = join(home, '.Trash');
        try {
          mkdirSync(trash, { recursive: true });
          renameSync(helperPath(), join(trash, `Industrious Nudge ${Date.now()}.app`));
          done('moved Industrious Nudge.app to the Trash');
        } catch {
          rmSync(helperPath(), { recursive: true, force: true });
          done('deleted Industrious Nudge.app');
        }
      }

      // 4. State and logs.
      if (existsSync(HOME)) {
        rmSync(HOME, { recursive: true, force: true });
        done(`removed ${HOME}`);
      }

      const repo = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
      console.log(
        '\nTo finish, run these yourself:\n\n' +
          `  tccutil reset All ${HELPER_ID}\n` +
          '      forgets the helper\'s macOS permissions\n' +
          '  npm rm -g artificially-industrious\n' +
          '      removes the industrious command\n' +
          `  rm -rf ${JSON.stringify(repo)}\n` +
          '      deletes the project folder\n',
      );
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
