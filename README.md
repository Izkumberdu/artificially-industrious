# Artificially Industrious

*AI, but it stands for Artificially Industrious.*

Your AI is still working on your prompt, so you are still working. This keeps
your Microsoft Teams status "Available" while that's true, then stops, and sends
a notification when your AI is done.

macOS only. No npm dependencies. No Microsoft Graph and no Azure setup.

## How it works

```
AI tool hook ──► industrious hook start ──► task file + background keeper
                                                │  every 60s: "user is active"
AI tool hook ──► industrious hook stop  ──► task removed ──► last one? notify + keeper exits
```

- Each running AI task is a small file in `~/.industrious/tasks/`, so tools
  running at the same time don't step on each other.
- A keeper process runs only while at least one task is active, and exits on
  its own when none are left.
- A task older than `timeoutMinutes` (default 120) counts as crashed and is
  dropped, so a dead tool can't keep you active forever.

## Setup

```bash
# 1. The nudge helper (see "Modes" below for why it's a separate app)
node bin/industrious.js install helper
node bin/industrious.js permission

# 2. Claude Code: preview first, then write (a backup of settings.json is made)
node bin/industrious.js install claude
node bin/industrious.js install claude --write

# Cursor
node bin/industrious.js install cursor --write

# Anything else: wrap the command
node bin/industrious.js run -- codex "fix the tests"
```

Optional: run `npm link` to get an `industrious` command on your PATH.

> The hooks call the exact `node` binary you installed them with. If you switch
> Node versions with nvm and that binary goes away, run `install` again.

## Modes

| Mode | How | Permissions |
|---|---|---|
| `both` (default) | nudge resets the idle timer, and caffeinate keeps the screen from sleeping | helper only |
| `nudge` | posts a zero-distance mouse move, so nothing visibly moves | helper only |
| `caffeinate` | `caffeinate -u` only. **Not enough by itself**, see below | none |

### The nudge helper

Posting even a zero-distance mouse move needs macOS's Accessibility permission,
called **Device Control and Data Access** on newer macOS. That permission is
powerful: an app that has it can type and click anywhere.

So the permission goes to one small, single-purpose app:
**Industrious Nudge.app**, a ~50-line helper (`helper/main.swift`). It can only
post one mouse move at the cursor's current position, and then it quits. The
keeper launches it with `open`, so macOS checks the helper's own permission.

```bash
industrious install helper   # builds Industrious Nudge.app into ~/Applications (needs Xcode CLT)
industrious permission       # macOS lists "Industrious Nudge"; switch it on
industrious status           # helper: ready
```

Industrious Nudge is the only app that needs the permission.

> The helper is ad-hoc signed, so macOS tracks the permission for that exact
> build. If you rebuild it, switch it on again.

**Why caffeinate alone isn't enough:** in a hands-off test with only
`caffeinate -u` running once a minute, the system idle timer (`HIDIdleTime`) kept
climbing to over 400 seconds. Teams goes Away after about 5 minutes idle, so it
would still mark you Away. You need the nudge, and therefore the helper.

**With `both` mode and Industrious Nudge switched on**, the same 6½-minute
hands-off test never let the idle timer go past about 60 seconds. It reset with
every once-a-minute nudge. Without the permission, macOS silently drops the nudges;
`industrious status` and `~/.industrious/keeper.log` will tell you when that's
happening.

Check the idle timer yourself while a task runs and you're hands-off:

```bash
ioreg -c IOHIDSystem | awk '/HIDIdleTime/ {print int($NF/1e9) "s idle"; exit}'
```

## Commands

```
industrious status               running tasks and the keeper
industrious start|stop [id]      manual control
industrious mode [caffeinate|nudge|both]
```

Config lives in `~/.industrious/config.json`: `mode`, `intervalSeconds`,
`timeoutMinutes`, `notifyWhenDone`. The keeper's log is `~/.industrious/keeper.log`.

## Development

```bash
npm test
```

Set `INDUSTRIOUS_HOME` to a temp folder so testing doesn't touch your real state.

## License

[MIT](LICENSE)
