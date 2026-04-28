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

### 1. Auto-tag on every user message

On every user message, **before doing the work**, classify the request into one of three buckets:

- **OLD** — feedback on the current task, follow-up step, retry, fix to a bug already in progress, or a question about it. → No tag action. Just do the work.
- **NEW** — clearly different feature/bug, switch to a different area or file, or session has no active label. → Tag automatically *before starting work* and announce it on a single line:
  > `⏱ tagging this as `<inferred-label>`` *(then run `/time-keeper:start <label>` or `/time-keeper:tag <label>` if one is already active)*
- **UNCLEAR** — could be either, or contains a mix. → Ask:
  > Is this part of `<current-label>`, or a new segment? *(suggested name: `<inferred-label>`)*

Pick a short kebab-case label derived from the user's phrasing. If you tag and the user pushes back ("no, that's part of X"), undo with `/time-keeper:stop` or re-tag with the right label.

#### Classification heuristics

| Signal | Bucket |
|--------|--------|
| "try again", "different flag", "the test is still failing", "fix the typo" | OLD |
| "ok now also...", "let me also...", "next let's...", "switch to...", "moving on to..." | NEW |
| "build/implement/fix X" where X is unrelated to current label | NEW |
| New file or area, no overlap with current task | NEW (likely) |
| Same files, follow-up step in the same plan | OLD |
| Greeting, status check, meta question ("how long have we been at this?") | OLD (no tag action) |
| Multiple distinct asks in one message | UNCLEAR — ask which to tag |
| Session has no active label and user starts work | NEW |

#### Don't over-tag

A tag is a unit of work, not a micro-step. "Add a comment", "rename this var", "run the tests", "show me the diff" don't get their own tags — they fold into the current one.

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
- The one-line auto-tag announcement when new work is detected (behavior 1),
- Disambiguation question when classification is unclear (behavior 1),
- The branch-name offer once per session (behavior 2),
- Reports when asked (behavior 3),
- The single thrash nudge (behavior 4),
- The session-end recap in `CLAUDE.md` (written automatically by the plugin).

## Quick reference

| Situation | Action |
|-----------|--------|
| Clear NEW work | Auto-tag, announce on one line, then do the work. |
| Clear continuation of current label | No tag action. |
| Ambiguous (could be either) | Ask the user before doing the work. |
| Session start, no tag, non-default branch | Offer branch-name tag **once**. |
| User asks about time/tokens | Run `/time-keeper:report`, relay output. |
| 3 retries on same step OR >45 min OR scope drift | Single nudge. |
| Greeting/meta question/single micro-step | Silent. |

## Rationalization table

| Excuse | Reality |
|--------|---------|
| "I'll batch the tagging at the end" | Tags must come **before** the work. Per-tag tokens are bucketed by turn timestamp — tagging after-the-fact attributes the tokens to whatever was active before. |
| "I'll wait until I'm sure before tagging" | Don't. If clearly NEW, tag now and announce on one line. If unclear, ask. Sitting on it lands tokens in the wrong tag. |
| "I'll just continue under the old tag, it's close enough" | If the work has clearly shifted, old-tag data gets polluted. When the heuristics say NEW, switch. |
| "I'll re-tag every micro-step to be precise" | Tags are units of work, not micro-steps. "Run the tests" stays under the current tag. |
| "User is frustrated, nudging would be rude" | That's exactly when the thrash nudge earns its keep. Be gentle but nudge. |
| "I'll guess the time from conversation" | Read `.claude/time-keeper.jsonl`. Always. |
| "I'll re-offer the branch tag later in case they change their mind" | One offer per session. Don't nag. |

## Red flags — STOP

- You tagged something the user disagrees with → run `/time-keeper:stop` (or re-tag with the right label) and apologize briefly.
- You skipped tagging a clear NEW segment because the user "seemed busy" → tag now, announce on one line.
- You answered a time question from memory instead of the log → read the log and correct.
- You nudged three times in one session on the same label → silence yourself.
