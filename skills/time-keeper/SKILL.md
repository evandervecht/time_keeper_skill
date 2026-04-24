---
name: time-keeper
description: Use when the project contains .claude/time-keeper.jsonl, when the user asks about elapsed time or token usage on the project, when the user mentions starting or switching to a new feature or bug fix, or when a labeled segment shows thrashing (repeated failed attempts, scope creep, or >45 min on one label).
---

# Time-Keeper Mindset

## Overview

A running session has a label for the current chunk of work ("fix-auth-bug", "refactor-router"). Time and tokens are logged to `.claude/time-keeper.jsonl` per project. Your job is to keep the label accurate, answer questions from the log, and nudge once when a single labeled segment is clearly thrashing. Stay silent otherwise.

## When the skill is active

Any of:
- `.claude/time-keeper.jsonl` exists in the current project, OR
- The user asks a time or token question about this project, OR
- The user signals new work ("I'm starting on X", "let me fix Y", "switching to Z"), OR
- You observe thrashing signals within the current labeled segment.

## Behaviors

### 1. Natural-language tag recognition

Triggers: phrases like "I'm starting on…", "let me fix…", "switching to…", "next let's do…", "moving on to…".

Response: ask once, never tag silently.

> Want me to start a time-keeper segment for `<inferred-label>`?

On yes, invoke `/time-keeper:start <label>` (or `/time-keeper:tag <label>` if one is already active). Pick a short kebab-case label derived from the user's phrasing.

### 2. Git-branch fallback (once per session)

At session start, run `/time-keeper:status`. If it says no active label and `git rev-parse --abbrev-ref HEAD` is not one of `main`, `master`, `trunk`, `develop`, offer **once**:

> No active time-keeper label. Start one for branch `<branch>`?

Do not re-offer in the same session.

### 3. On-demand reporting

When the user asks "how long did X take?" / "what's my token burn?" / similar:
- If the question is about any tag or recent activity, run `/time-keeper:report` (with `--week`, `--month`, or `--label` as appropriate) and relay the output.
- Never guess from conversation. Always read from the log.
- If the question crosses projects, say "time-keeper data is per-project — I can only report on this one."

### 4. Thrash nudge

Within a single labeled segment, break silence exactly once when you observe:

- 3+ failed attempts at the same concrete step, OR
- The work has drifted from the original label (changed files don't match the stated intent), OR
- Runtime > 45 min on one label (check `/time-keeper:status`).

Say something like:

> We're ~50 min into `fix-auth-bug` and I've retried the migration step three times. Want to stop and reassess, or keep going?

One nudge per condition per label. No repeat nagging.

### 5. Silent by default

No pace chatter. No mid-session token announcements. No budget alerts. The only user-visible outputs are:
- Tag confirmation asks (behaviors 1 and 2),
- Reports when asked (behavior 3),
- The single thrash nudge (behavior 4),
- The session-end recap in `CLAUDE.md` (written automatically by the plugin).

## Quick reference

| Situation | Action |
|-----------|--------|
| User mentions new work | Ask to start a tag. Never tag silently. |
| Session start, no tag, non-default branch | Offer branch-name tag **once**. |
| User asks about time/tokens | Run `/time-keeper:report`, relay output. |
| 3 retries on same step OR >45 min OR scope drift | Single nudge. |
| Anything else | Silent. |

## Rationalization table

| Excuse | Reality |
|--------|---------|
| "I'll batch the tagging at the end" | Untagged time collapses into an unlabeled blob. Confirm the tag now. |
| "User seems busy, don't interrupt" | A one-line confirmation costs nothing; silent tagging costs trust. Always ask. |
| "User is frustrated, nudging would be rude" | That's exactly when the thrash nudge earns its keep. Be gentle but nudge. |
| "I'll guess the time from conversation" | Read `.claude/time-keeper.jsonl`. Always. |
| "I'll re-offer the branch tag later in case they change their mind" | One offer per session. Don't nag. |

## Red flags — STOP

- You tagged a segment without asking → undo with `/time-keeper:stop` and confirm with the user.
- You answered a time question from memory instead of the log → read the log and correct.
- You nudged three times in one session on the same label → silence yourself.
