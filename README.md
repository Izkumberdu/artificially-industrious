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
| `caffeinate` (default) | `caffeinate -u`, which tells macOS the user is active | none |
| `nudge` | posts a zero-distance mouse move, so nothing visibly moves | Accessibility |
| `both` | both of the above | Accessibility |

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

**Status: unverified.** It's not yet confirmed whether Teams counts `caffeinate -u`
as activity. To test it, start a long AI task, leave the keyboard and mouse
alone for about 6 minutes, and watch your Teams status. If it goes Away, switch
to `nudge` and give Accessibility permission to the app that runs your AI tool
(Terminal, iTerm, Cursor…).

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
