# Security Policy

## Supported versions

Only the latest release gets security fixes.

| Version | Supported |
|---|---|
| 1.0.x (latest) | ✅ |
| Older | ❌ |

## Reporting a vulnerability

Please **don't open a public issue** for security problems.

Report it privately through GitHub instead:
[**Report a vulnerability**](https://github.com/Izkumberdu/artificially-industrious/security/advisories/new)
(the Security tab → "Report a vulnerability").

Include what you found, how to reproduce it, and what an attacker could do with
it. You'll get a reply within 7 days. Once a fix is released, you'll be credited
in the release notes unless you'd rather not be.

## What's in scope

Artificially Industrious runs on your Mac with your permissions, so these
matter most:

- **Industrious Nudge.app**, the helper that holds the Accessibility permission.
  Its only jobs are a zero-distance mouse move and showing a notification.
  Anything that lets another program make it do more than that is in scope.
- **The hooks** written into Claude Code, Copilot and Cursor settings, and the
  command they run.
- **Files under `~/.industrious`** (task state, config, logs).
- **The Homebrew formula** in
  [Izkumberdu/homebrew-tap](https://github.com/Izkumberdu/homebrew-tap).

## By design

- The tool makes **no network requests** and collects **no telemetry**.
- The CLI has **no npm dependencies**.
- The helper is built from source on your machine and **ad-hoc signed** (not
  notarized). macOS ties the Accessibility permission to that exact build, so
  rebuilding it needs the permission switched on again.
- Your AI tools and Terminal never need the Accessibility permission. Only the
  helper has it.
