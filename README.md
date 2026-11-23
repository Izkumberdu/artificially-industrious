# Artificially Industrious

*AI, but it stands for Artificially Industrious.*

Your AI is still working on your prompt, so you are still working. This keeps
your Microsoft Teams status "Available" while that's true, then stops, and sends
a notification when your AI is done.

macOS only. No dependencies. No Microsoft Graph and no Azure setup.

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
# Claude Code: preview first, then write (a backup of settings.json is made)
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
| `both` (default) | nudge resets the idle timer, and caffeinate keeps the screen from sleeping | Accessibility |
| `nudge` | posts a zero-distance mouse move, so nothing visibly moves | Accessibility |
| `caffeinate` | `caffeinate -u` only. **Not enough by itself**, see below | none |

```bash
industrious mode nudge
industrious permission # asks macOS for Accessibility access
industrious nudge      # send one to check it works
```

**Can't find the app under Accessibility?** macOS only lists an app after it
has asked for access. `industrious permission` makes that request, so the app
running it (Terminal, iTerm, Claude, Cursor…) shows up with a toggle. Switch
it on, then quit and reopen that app. If it still isn't listed, click **+** in
System Settings → Privacy & Security → Accessibility and add the app yourself.

Run `industrious permission` from the same app your AI tool runs in. The
permission belongs to that app, not to `industrious`.

> **Newer macOS** renamed this list to **Device Control and Data Access**
> (still under Privacy & Security).
>
> **Claude desktop app:** hooks run under the bundled Claude Code engine, which
> appears as a lowercase **`claude`** with a blank icon. That's the one to switch
> on, not the orange **Claude** app. Because it lives in a versioned folder,
> a Claude Code update may need you to switch it on again.

**Why caffeinate alone isn't enough:** in a hands-off test with only
`caffeinate -u` running once a minute, the system idle timer (`HIDIdleTime`) kept
climbing to over 400 seconds. Teams goes Away after about 5 minutes idle, so it
would still mark you Away. You need the nudge, and therefore Accessibility
permission.

**With `both` mode and Accessibility granted**, the same 6½-minute hands-off
test never let the idle timer go past about 50 seconds. It reset with every
once-a-minute nudge. Without that permission, macOS silently drops the nudges;
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
