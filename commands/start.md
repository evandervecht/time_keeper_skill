---
description: Start a time-keeper segment labeled for the current feature or bug.
argument-hint: <label>
---

Run the following Bash command and relay its output verbatim to the user:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/tk.mjs" start "$ARGUMENTS"
```

If `$ARGUMENTS` is empty, tell the user the command requires a label (e.g. `/time-keeper:start fix-auth-bug`) and do not run the command.
