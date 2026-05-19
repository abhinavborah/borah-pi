# rtk-pi Context — For Next Agent Session

This file is the handoff document for the rtk-pi extension. It captures all architectural decisions, debugging sessions, bugs found/fixed, and operational knowledge. See `docs/rtk-pi.md` for feature documentation.

## What Is rtk-pi (v2)

A minimal pi extension that:
- Hooks `tool_call` to rewrite bash commands to RTK subcommands (token savings)
- Hooks `tool_result` to compact read tool output (bypasses summarization)
- Persists stats to `stats.json` across invocations
- Registers `/rtk` slash commands for status, verify, stats, clear-stats, reset, help

**Goal:** Minimal replacement for pi-rtk-optimizer (~490 lines vs ~8,500 lines of source).

**Key insight (v2):** pi's built-in summarization is MORE aggressive than rtk-pi's heuristics — so heuristics add tokens, not save them. v2 uses RTK direct call patterns instead.

---

## Important Paths

### Extension & Config

```
~/.pi/agent/extensions/rtk-pi.ts      # Extension source (v2, ~490 lines)
~/.pi/agent/extensions/rtk-pi/
  config.json                          # RTK config
  stats.json                          # Persisted stats
~/.pi/agent/docs/rtk-pi.md            # Feature docs + WIP
~/.pi/agent/CONTEXT/rtk-pi.md          # This file — architecture notes
```

### Related Projects

```
~/.nvm/versions/node/v25.8.1/lib/node_modules/
  pi-rtk-optimizer/                        # Original extension (reference impl)
https://github.com/MasuRii/pi-rtk-optimizer # pi-rtk-optimizer repo
  @earendil-works/pi-coding-agent/         # pi core (has ExtensionAPI types)
```

### RTK Binary

```
/opt/homebrew/bin/rtk                      # RTK v0.40.0 installed via Homebrew
https://github.com/rtk-ai/rtk             # RTK repo
```

---

## Architecture (v2)

### RTK Direct Call Patterns

Instead of `rtk rewrite` + heuristics, v2 uses direct RTK subcommand patterns:

```typescript
const RTK_PATTERNS = [
  { category: "git", match: (cmd) => /^git\s+(push|commit|pull|add|stage)\b/.test(cmd) ? `git ${sub}` : null },
  { category: "git", match: (cmd) => /^git\s+(status|diff|log|stash|branch|fetch)\b/.test(cmd) ? `git ${sub}` : null },
  { category: "json", match: (cmd) => /^cat\s+(\S+\.json)\s*$/.test(cmd) ? `json ${file} --keys-only` : null },
  { category: "ls", match: (cmd) => /^ls\s*(-\w+\s*)*$/.test(cmd.trim()) ? "ls" : null },
  { category: "find", match: (cmd) => /^find\s+/.test(cmd) ? cmd.replace(/^find\s+/, "find ") : null },
  { category: "build", match: (cmd) => /^(?:npm|pnpm|yarn|bun)\s+run\s+(?:build|dev|start|preview)\b/.test(cmd) ? `err ${cmd}` : null },
  { category: "test", match: (cmd) => /^npm\s+test\b/.test(cmd) ? `test ${cmd}` : null },
  { category: "lint", match: (cmd) => /^ruff\s+check\b/.test(cmd) ? "lint" : null },
  { category: "read", match: (cmd) => /^cat\s+(\S+)\s*$/.test(cmd) && !endsWith(.json) ? `read ${file}` : null },
];
```

### Event Flow (v2)

```
bash tool → tool_call → mutate event.input.command to "rtk <subcommand>" → bash executes RTK → pi summarizes
read tool → tool_result → compactReadOutput() → bypasses summarization
```

### Why v2 Architecture

v1 had heuristic-based compaction in `tool_result` for bash/grep output. This was counterproductive because:
- pi's built-in summarization is MORE aggressive than rtk-pi's heuristics
- Heuristics produced MORE tokens than pi's summarization of raw output
- Result: rtk-pi v1 added tokens instead of saving them

v2 fix: mutate bash command to use RTK directly, let pi summarize. RTK's output is already compact (60-90% savings vs raw), so pi's summarization of RTK output is similar to summarization of heuristics output, but with less total input tokens.

---

## Bug Fixes & Debugging History

### Bug 1: `rtk rewrite` + heuristics was counterproductive (v1) (FIXED in v2)

**Problem:** v1 used `rtk rewrite` + heuristic compaction in `tool_result`. Tests showed:
- `git status`: rtk-pi output MORE verbose than without (compact RTK format vs pi's summary)
- `cat justfile`: rtk-pi output MORE verbose than without (RTK adds formatting)

**Detection:** Session comparison tests showed rtk-pi added tokens for bash/grep commands.

**Fix (v2):** Replaced with direct RTK patterns. Mutate bash command to `rtk <subcommand>` directly.

### Bug 2: `block: true` + `override` didn't work (FIXED)

**Problem:** v1 tried to return `{ block: true, override: { content: [...] } }` from `tool_call`. This blocked the bash tool but didn't inject content — bash tool ran anyway.

**Detection:** JSON mode showed `tool_execution_end` had content "RTK direct call: git" (the reason string), not RTK output.

**Fix (v2):** Don't use `block: true`. Just mutate `event.input.command` to `rtk <subcommand>`. The bash tool executes and pi summarizes RTK's compact output.

### Bug 3: Python string escaping in heredoc (FIXED)

**Problem:** When writing the read compaction code via Python heredoc, `\n` in `text.split("\n")` was being written as a literal newline in the file, causing parse errors.

**Fix:** Use `\\n` in Python to write `\n` in the file, or use the edit tool directly.

---

## RTK Binary Behavior

```
$ rtk --version
rtk 0.40.0

$ rtk git status
* main...origin/main [ahead 9]
~ Modified: 1 files
   agent/settings.json
? Untracked: 6 files

$ rtk git push
ok main

$ rtk read justfile | wc -l
155 (same as cat — small files don't show savings)

$ rtk json package.json --keys-only
{ defaultModel, defaultProvider, ... }  (compact keys only)
```

**RTK exit codes for `rtk rewrite`:**
- `0/3`: Rewrite available (stdout has rewritten command)
- `1`: No rewrite needed
- `2`: Error

---

## Extension API Notes

### `tool_call` Event

- `event.toolName: string` — tool name (e.g., "bash")
- `event.toolCallId: string` — unique call ID
- `event.input: Record<string, unknown>` — tool arguments, **MUTABLE**
- Return `undefined` to let bash execute normally
- Return nothing = proceed normally

### `tool_result` Event

- `event.toolName: string`
- `event.input: Record<string, unknown>` — original args
- `event.content: unknown[]` — tool result content array
- Return **partial patch**: `{ content?, details?, isError? }` — runner merges omitted fields
- Return `undefined` to pass result through unchanged

---

## Test Commands

```bash
# Clear stats
pi --no-extensions -e ~/.pi/agent/extensions/rtk-pi.ts -p "clear stats"

# Test git status rewrite
pi --no-extensions -e ~/.pi/agent/extensions/rtk-pi.ts -p "run: git status"

# Test cat file rewrite
pi --no-extensions -e ~/.pi/agent/extensions/rtk-pi.ts -p "run: cat justfile"

# Test read tool compaction
pi --no-extensions -e ~/.pi/agent/extensions/rtk-pi.ts -p "read ~/.zshrc"

# Verify /rtk command
pi --no-extensions -e ~/.pi/agent/extensions/rtk-pi.ts --mode json "/rtk stats"

# Check stats
cat ~/.pi/agent/extensions/rtk-pi/stats.json
```

---

## Git Commits on This Extension

```bash
cd ~/.pi

# v1 commits (archived)
git commit -m "add rtk-pi extension: minimal rtk rewrite + output compaction"
git commit -m "docs: add rtk architecture reference"
git commit -m "add read tool compaction with RTK-style banner"

# v2 refactor (current)
git commit -m "refactor: replace heuristics with RTK direct call patterns

v2 removes heuristic-based compaction (counterproductive in pi).
Instead, mutate bash command to RTK subcommand directly.
pi's summarization then summarizes RTK's compact output (~60-90% savings).
Keeps read tool compaction. ~490 lines vs v1's 598 lines."
```

---

## Key Reference Sources

| Source | Location | Purpose |
|--------|----------|---------|
| pi-rtk-optimizer (original) | `~/.nvm/.../node_modules/pi-rtk-optimizer/src/` | Reference implementation |
| pi-rtk-optimizer (github repo) | https://github.com/MasuRii/pi-rtk-optimizer | Reference implementation |
| pi extension docs | `~/.nvm/.../node_modules/@earendil-works/pi-coding-agent/docs/extensions.md` | Extension API reference |
| pi ExtensionRunner | `~/.nvm/.../node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/runner.js` | Event hook implementation |
| RTK binary | `/opt/homebrew/bin/rtk` | Rewrites bash commands |
| RTK README | https://github.com/rtk-ai/rtk/blob/develop/README.md | Official docs + token savings table |
| rtk-pi docs | `~/.pi/agent/docs/rtk-pi.md` | Feature documentation |
| rtk-pi context | `~/.pi/agent/CONTEXT/rtk-pi.md` | This file |

---

## WIP Priority List (from docs/rtk-pi.md)

### High Priority

1. **Streaming sanitization** — Handle partial/streaming output via `tool_execution_update`.
2. **RTK exec resolution (which/where fallback)** — robust path finding.
3. **Bounded notice tracker** — deduplicate warnings.

### Medium Priority

4. **Smart truncation (by lines)** — truncate by line count, not char count.
5. **Source code filtering** — strip comments/whitespace.
6. **RTK hook warning stripping** — clean RTK self-diagnostics.
7. **Emoji sanitization** — strip RTK emoji from output.

### Low Priority

8. **Windows compatibility** — path separator normalization.
9. **Config modal UI** — interactive TUI settings.
10. **Runtime status caching** — 30s TTL on RTK availability check.
11. **System prompt troubleshooting note** — warn about edit failures with filtered reads.

### Done

- ✅ Read tool compaction (v1)
- ✅ RTK direct call patterns (v2)
- ✅ Remove heuristic compaction for bash/grep (v2)

---

## Keep in Mind

1. **Keep it minimal** — rtk-pi should stay under ~500 lines. pi-rtk-optimizer has ~8500 lines.

2. **Mutate command, don't block** — `block: true` doesn't inject content. Just mutate `event.input.command` and let bash execute.

3. **pi summarizes bash/grep** — don't try to out-compete pi's summarization with heuristics. Use RTK direct calls instead.

4. **Read tool bypasses summarization** — the `read` tool output goes directly to context without pi summarizing. This is where compaction matters.