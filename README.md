# Time-Keeper — How To Use

A Claude Code plugin that tracks how long you spent and how many tokens you burned, per session and per tagged feature or bug. Data lives with the project. A human-readable recap is auto-written into the project's `CLAUDE.md` so the next session starts with context.

## Install

Once published, install like any Claude Code plugin:

```bash
claude plugin install time-keeper
```

Verify it's active:

```bash
claude plugin list | grep time-keeper
```

Start a new Claude Code session in any project. On first session end, time-keeper creates `.claude/time-keeper.jsonl` and adds a recap block to `CLAUDE.md`.

## What it does automatically

No configuration needed. Out of the box:

- **Every session is tracked.** Start time, end time, total duration, and token counts (input, output, cache-read, cache-creation) are appended to `<project>/.claude/time-keeper.jsonl` when the session ends.
- **Your `CLAUDE.md` gets a recap block.** At the end of each session, a managed block is updated in place showing last session plus weekly totals. Nothing else in `CLAUDE.md` is touched.
- **Your next session sees the recap immediately.** Claude loads `CLAUDE.md` on startup, so you (and the assistant) open with context from last time.

If you do nothing else, you already have session-level time and token history.

## Tagging work — four ways

Tagging marks the current chunk of work as a specific feature or bug ("fix-auth-bug", "refactor-router"). Per-tag time shows up in reports and the CLAUDE.md recap.

### 1. Slash command (explicit)

```
/time-keeper:start fix-auth-bug
… do work …
/time-keeper:stop
```

Or switch between tags without explicitly stopping:

```
/time-keeper:tag refactor-router
```

### 2. Natural language (assistant-assisted)

Just say it:

> "I'm starting on the auth bug now."

Claude will ask:

> "Want me to start a time-keeper segment for `auth-bug`?"

Say yes, and Claude runs `/time-keeper:start auth-bug` for you. Tags are never applied silently.

### 3. Git branch (offered once per session)

If you start a session on a non-default branch and haven't tagged anything yet, Claude will offer once:

> "No active time-keeper label. Start one for branch `fix/auth`?"

Accept and the branch name becomes the label. No further offers in that session.

### 4. Mid-session manual tag

Any time, by calling the slash command directly. There's no wrong order — tag first, tag mid-way, or tag at the end of a segment. Tagging at the very end still captures the elapsed time back to the previous tag.

## Checking status mid-session

```
/time-keeper:status
```

Shows: session elapsed time, current label, and all tags touched so far this session.

## Reading the data back

### The CLAUDE.md recap

Automatic and always up to date. Look for the `<!-- time-keeper:recap -->` block at the bottom of your `CLAUDE.md`. Do not edit it — the block is regenerated at session end.

### `/time-keeper:report`

Produces a text table for the current project. Examples:

```
/time-keeper:report
/time-keeper:report --week
/time-keeper:report --month
/time-keeper:report --label fix-auth-bug
```

### Ask Claude

If the skill is active for your project (it loads automatically when `.claude/time-keeper.jsonl` exists), you can ask plain-English questions:

> "How long did I spend on fix-auth-bug this week?"
> "What's my token burn on this project overall?"
> "How much cache-read vs cache-creation have I used today?"

Claude reads the JSONL directly and answers. It won't guess from conversation — always from the log.

## When Claude nudges you

Silence is the default. Claude will break it for one specific reason: **thrash detection**. If within a single labeled segment Claude notices any of:

- more than 3 failed attempts at the same concrete thing,
- the work drifting away from the label,
- runtime over 45 min on a single label,

it'll pause and say something like:

> "We're ~50 min into `fix-auth-bug` and I've retried the migration step three times. Want to stop and reassess, or keep going?"

That's the whole interruption budget. No budget alerts, no pace chatter, no mid-session token announcements.

## Files and where they live

All per-project:

| Path | Purpose | Safe to edit? |
|------|---------|---------------|
| `.claude/time-keeper.jsonl` | Full log, one event per line | Don't edit. Safe to `git log` or delete to reset. |
| `.claude/time-keeper.state.json` | In-flight session scratchpad | Auto-deleted at session end. Don't edit. |
| `.claude/time-keeper.error.log` | Hook failures for debugging | Safe to delete. |
| `CLAUDE.md` (the `<!-- time-keeper:recap -->` block only) | Auto-rendered recap | Don't edit inside the markers. Outside the block is yours. |

## Git: commit or ignore?

Pick one based on how you work:

- **Commit `.claude/time-keeper.jsonl`** if you want a shared per-project record (useful on solo projects or small teams who want visibility).
- **Gitignore it** if it's your personal telemetry. Add to `.gitignore`:
  ```
  .claude/time-keeper.jsonl
  .claude/time-keeper.state.json
  .claude/time-keeper.error.log
  ```
- **Always commit the `CLAUDE.md` recap block** — it's context for whoever works on the repo next.

## Typical workflow

Morning, starting work on a new bug:

```
$ claude
```

Claude's first message (loaded from CLAUDE.md):
> Last session: 47 min, 182k tokens on `refactor-router`. This week: 2h 47m total.

You:
> "Let me fix the login redirect bug."

Claude:
> "Want me to start a time-keeper segment for `login-redirect-bug`?"

You: "yes."

… work happens …

You hit a wall, retry the same fix three times. Claude:
> "We're 52 min into `login-redirect-bug` and I've retried the session middleware change three times. Want to stop and reassess?"

You: "switch to something else — let's look at the cache invalidation refactor."

Claude:
> "Want me to tag the next segment `cache-invalidation-refactor`?"

… work continues …

You end the session. Behind the scenes: token counts parsed from the transcript, session row appended to JSONL, `CLAUDE.md` recap regenerated. Next session opens with all of that visible.

## Troubleshooting

**No recap in CLAUDE.md?**
Check `.claude/time-keeper.error.log`. Hook errors never block a session — they log quietly and move on.

**Recap block is missing or malformed?**
If you accidentally removed only one of the two `START`/`END` markers, time-keeper refuses to write rather than risk clobbering content. Either restore both markers (or delete both), then end a session to regenerate.

**Tokens look wrong?**
Tokens are read from the transcript JSONL at session end. If Claude Code's transcript schema changes, the parser may miss fields. Check `.claude/time-keeper.error.log` and file an issue.

**Want to opt out of the `CLAUDE.md` recap?**
Remove the `<!-- time-keeper:recap -->` markers from `CLAUDE.md`. Time-keeper will append them back on next session end. A permanent opt-out flag is not yet supported.

**Want to reset the data?**
```bash
rm .claude/time-keeper.jsonl
```
The recap block updates on the next session end and will reflect the empty log.

## Limitations (v1)

- Per-tag **token** totals are not shown in reports. Only per-tag **duration** is. Full per-tag token accounting requires per-turn logging, which is opt-in and not enabled in v1.
- Reports are per-project only. No cross-project aggregation.
- No budget or threshold alerts — this is intentional.
- Hook-emitted summaries don't appear in the live transcript; the `CLAUDE.md` recap is the loop-close.
