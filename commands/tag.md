---
description: Switch the active time-keeper label (like start, but semantically a switch).
argument-hint: <label>
---

Run the following Bash command and relay its output verbatim:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/tk.mjs" tag "$ARGUMENTS"
```

If `$ARGUMENTS` is empty, tell the user this command requires a label.
