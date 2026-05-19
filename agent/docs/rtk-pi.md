# rtk-pi — RTK Integration for pi

A minimal extension that hooks `tool_call` to rewrite bash commands via `rtk rewrite` and `tool_result` to compact bash/grep output with heuristic filters.

## Installation

```bash
pi --no-extensions -e ~/.pi/agent/extensions/rtk-pi.ts
```

Or place in auto-discovered extensions directory:

```bash
~/.pi/agent/extensions/rtk-pi.ts
# loaded automatically when running:  pi
```

## RTK Binary Requirement

Requires [rtk](https://github.com/rtk-ai/rtk) installed and in PATH. RTK is an AI-powered CLI tool that rewrites commands (e.g., `cat file.json` → `rtk read file.json`).

Verify RTK availability:

```bash
rtk --version   # should print version
```

## Features

### 1. Command Rewriting (`tool_call` hook)

Before a bash tool executes, the extension runs `rtk rewrite "<command>"`. If RTK returns a rewritten command (exit code 3), the extension mutates `event.input.command` to substitute the original.

**RTK exit codes:**
| Code | Meaning |
|------|---------|
| 1 | No rewrite needed — command already optimal |
| 3 | Rewrite available — rewritten command on stdout |
| 2 | Error |
| 0 | Rewrite available (alternative) |

**Guard:** Commands matching `rm -rf` are never rewritten.

**Stats:** Each successful rewrite increments `stats.rewrites` in `stats.json`.

### 2. Output Compaction (`tool_result` hook)

After a bash or grep tool executes, the extension applies heuristic compaction techniques. The handler returns a partial patch `{ content: [{ type: "text", text: compacted }] }` — the runner merges this into the result.

**Techniques (bash):**
- `compactGitOutput()` — parses `git diff`/`git status`/`git log`, replaces raw diff hunks with file headers + `+/-` counts, summarizes status
- `filterBuildOutput()` — strips cargo/npm compile noise, extracts errors/warnings
- `aggregateTestOutput()` — parses test results, outputs `[OK] Tests passed (N)` or failure summary
- `aggregateLinterOutput()` — parses eslint/ruff/mypy output, groups by file with count
- `stripAnsiFast()` — strips ANSI escape codes if `stripAnsi: true`
- `truncate()` — truncates to `maxChars` if `truncate.enabled`

**Techniques (grep):**
- `groupSearchOutput()` — groups grep matches by file, shows first 5 lines per file with `+N more`

**Stats:** Each compaction increments `stats.compactions`; `stats.charsSaved` tracks character reduction when `trackSavings: true`.

### 3. `/rtk` Commands

Registered as a pi slash command. Produces output via `pi.sendMessage()` with `display: true`.

| Command | Description |
|---------|-------------|
| `/rtk show` | RTK status, mode, lifetime stats |
| `/rtk verify` | Check rtk binary availability |
| `/rtk stats` | rewrites, compactions, chars saved |
| `/rtk clear-stats` | Reset all counters to zero |
| `/rtk reset` | Reset config to defaults |
| `/rtk help` | Help text |

**Note:** In print mode (`pi -p "..."`), `/rtk` output is injected as a custom message (visible in JSON mode via `session.subscribe()`) but not printed to stdout. In interactive TUI mode, the messages are rendered and visible.

## Configuration

Stored in `~/.pi/agent/extensions/rtk-pi/config.json`:

```json
{
  "enabled": true,
  "mode": "rewrite",
  "guardWhenRtkMissing": true,
  "showRewriteNotifications": false,
  "outputCompaction": {
    "enabled": true,
    "stripAnsi": true,
    "truncate": { "enabled": true, "maxChars": 12000 },
    "aggregateTestOutput": true,
    "filterBuildOutput": true,
    "compactGitOutput": true,
    "aggregateLinterOutput": true,
    "groupSearchOutput": true,
    "trackSavings": true
  }
}
```

## Stats

Stored in `~/.pi/agent/extensions/rtk-pi/stats.json`:

```json
{
  "rewrites": 0,
  "compactions": 0,
  "charsSaved": 0
}
```

Stats persist across invocations. Reset with `/rtk clear-stats`.

## Architecture

### Event Flow

```
User prompt
  └─► tool_call (rtk rewrite)
        └─► mutate event.input.command
        └─► increment stats.rewrites
  └─► bash tool executes (possibly with rewritten command)
  └─► tool_result (compaction)
        └─► apply technique(s)
        └─► return partial patch { content: [...] }
        └─► increment stats.compactions / charsSaved
```

### `tool_call` vs `tool_result` Return Values

**`tool_call`:**
- Returns `{ block: true, reason?: string }` to block execution
- Returning nothing (or `undefined`) lets execution proceed normally
- Mutations to `event.input.command` are applied before execution

**`tool_result`:**
- Returns partial patch: `{ content?, details?, isError? }`
- Runner merges omitted fields from previous state
- Returning nothing passes result through unchanged

### RTK Invocation

The extension uses `execSync` via `require("child_process")` rather than `pi.exec()`:

```typescript
const { execSync } = require("child_process");
rewritten = execSync(`rtk rewrite ${JSON.stringify(command)}`, { timeout: 3000 }).toString().trim();
```

**Why not `pi.exec()`?** pi's internal `execCommand()` uses `shell: false`, which can't execute JS CLI files that rely on shebang resolution (`#!/usr/bin/env node`). RTK is a JavaScript executable invoked via PATH, requiring a shell.

**Why not just `spawn()` with `shell: true`?** Synchronous `execSync` is simpler for a single-shot blocking call with a 3-second timeout. The async `tool_call` handler doesn't need to be non-blocking here since we need the rewrite before execution proceeds.

### Known Limitations

1. **`/rtk` output in print mode:** Custom extension messages (with `display: true`) are correctly injected into the session and emitted via `session.subscribe()` (visible in JSON mode), but print mode's text output only prints the last assistant message's text content. In interactive TUI mode, output is visible. This is a pi print mode design choice, not a bug.

2. **Rewrite detection relies on exit code:** RTK uses exit code 3 for rewrites. The extension extracts `err.stdout` from the caught exception. If RTK's exit code behavior changes, this needs updating.

3. **Compaction heuristics are best-effort:** The regex-based heuristics match specific output patterns. Unusual output formats may bypass all techniques.

4. **In-memory `config` variable:** Config is loaded once at extension factory time. Changes to `config.json` are not picked up until extension reload. Stats use `incrementStats()` which loads from `stats.json` on each invocation, ensuring cross-session accuracy.

## Testing

Run tests with print mode (each invocation is fresh):

```bash
# Clear stats
pi --no-extensions -e ~/.pi/agent/extensions/rtk-pi.ts -p "/rtk clear-stats"

# Test rewrite (cat → rtk read)
pi --no-extensions -e ~/.pi/agent/extensions/rtk-pi.ts -p "run: cat ~/Developer/memora_web_prototype/package.json | head -5"

# Test compaction (git status)
pi --no-extensions -e ~/.pi/agent/extensions/rtk-pi.ts -p "run: git status"

# Check stats
cat ~/.pi/agent/extensions/rtk-pi/stats.json

# Verify /rtk command output (use JSON mode)
pi --no-extensions -e ~/.pi/agent/extensions/rtk-pi.ts --mode json "/rtk show"
```

Expected stats after tests:
- `rewrites: 1` (from `cat` command)
- `compactions: N` (from `git status`, `ls`, etc.)
- `charsSaved: > 0`

## File Structure

```
~/.pi/agent/extensions/rtk-pi.ts      # Extension source
~/.pi/agent/extensions/rtk-pi/
  config.json                          # RTK config
  stats.json                           # Persisted stats
~/.pi/agent/docs/rtk-pi.md            # This file
```

## Comparison with pi-rtk-optimizer

This is a **minimal replacement** for pi-rtk-optimizer. Key differences:

| Feature | pi-rtk-optimizer | rtk-pi |
|---------|-----------------|--------|
| Size | Large (~1000+ lines) | Minimal (~500 lines) |
| Stats persistence | In-memory | `stats.json` file |
| Config | Complex nested objects | Simple flat config |
| RTK invocation | Complex spawn logic | Simple `execSync` |
| `/rtk` commands | Vague/placeholder | Implemented with output |
| Compaction techniques | Many | Core heuristics only |
| TypeScript quality | Mixed | Clean, minimal interfaces |

## #WIP — Missing Features

Sorted by priority (most important first). See [pi-rtk-optimizer/src/](https://github.com/MasuRii/pi-rtk-optimizer/tree/main/src) for reference implementations.

### High Priority

1. **Read tool compaction** — RTK rewrites `cat file` → `rtk read file`; `tool_result` should compact the `read` tool output the same way it handles `bash`. This is the single most impactful missing feature — RTK's primary use case is file reading.
   - Files: `output-compactor.ts`, `techniques/source.ts` (detectLanguage, filterSourceCode, smartTruncate)
   - Key: detect `toolName === "read"`, extract `input.path`, apply truncation/source-filtering heuristics

2. **Streaming sanitization** — Handle partial/streaming output during long-running bash commands (`tool_execution_update` hook). Without this, compacting a command mid-stream can produce garbled output.
   - Files: `tool-execution-sanitizer.ts`, `output-compactor.ts` (`sanitizeStreamingBashExecutionResult`)
   - Key: subscribe to `tool_execution_update`, sanitize `partialResult` before it reaches `tool_result`

3. **Smart truncation** — Truncate by logical lines instead of raw character count. Better for source code where line count matters more than char count.
   - File: `techniques/source.ts` (`smartTruncate`)
   - Key: count `
`-delimited lines, enforce `maxLines` threshold

### Medium Priority

4. **RTK hook warning stripping** — RTK sometimes emits hook-related warnings that pollute output. Strip them before compaction.
   - File: `techniques/rtk.ts` (`stripRtkHookWarnings`)

5. **RTK exec resolution** — Robustly resolve `rtk` binary path using `which` (Unix) or `where` (Windows) fallback if not in PATH.
   - File: `rtk-executable-resolver.ts`

6. **Emoji sanitization** — RTK output may include emoji; strip or normalize them for cleaner output.
   - File: `techniques/emoji.ts` (`sanitizeRtkEmojiOutput`)

### Low Priority

7. **Source code filtering** — Strip comments and excessive whitespace from source code reads to reduce token waste. Three levels: `none`, `minimal`, `aggressive`.
   - File: `techniques/source.ts` (`detectLanguage`, `filterSourceCode`)
   - Note: aggressive filtering can cause edit failures if old text includes comments; original warns about this

8. **Windows compatibility** — Path separator normalization, `cmd.exe` vs `bash` handling. Only needed if Windows support is desired.
   - File: `windows-command-helpers.ts`

9. **Config modal UI** — Interactive TUI settings modal (beyond `/rtk` slash commands). Allows toggling options via `ctx.ui.select()` instead of editing `config.json` manually.
   - File: `config-modal.ts`, `config-store.ts`
   - Note: low priority for TUI-only usage; config file editing works fine

### Nice to Have

10. **Runtime status caching** — Cache RTK availability check for 30s to avoid repeated `rtk --version` calls.
    - Key: `runtimeStatus.lastCheckedAt`, 30s staleness check

11. **Bounded notice tracker** — Deduplicate warning/notification messages (e.g., "rtk binary unavailable" shown once, not every turn).
    - File: `index.ts` (`createBoundedNoticeTracker`)


12. **System prompt troubleshooting note** — When source filtering is enabled, inject a note into the system prompt warning about edit failures with filtered reads.
    - File: `index.ts` (`shouldInjectSourceFilterTroubleshootingNote`)
    - Hook: `before_agent_start`

## #WIP — Custom Message Renderer for Print Mode

Print mode (`pi -p "..."`) only outputs the last assistant message's `text` content via `writeRawStdout()`. Custom extension messages injected via `pi.sendMessage()` with `display: true` are correctly added to the session and emitted via `session.subscribe()` (visible in JSON mode), but are **not printed to stdout** in text mode.


The clean fix without token cost is to register a custom message renderer so rtk-pi messages get routed through the TUI rendering pipeline:

```typescript
pi.registerMessageRenderer("rtk-pi", (message, options, theme, context) => {
  // message: { customType: "rtk-pi", content: string, display: true, ... }
  // Returns a Component rendered directly by the TUI — no LLM call
  return { type: "text", text: message.content };
});
```

**What to implement:**
1. Register a renderer via `pi.registerMessageRenderer("rtk-pi", ...)` in the extension factory
2. The renderer receives the custom message and returns a renderable component
3. The TUI's `session.subscribe()` emits these messages; the renderer formats them for display
4. In print mode, this hooks into the existing `session.subscribe()` event stream that JSON mode uses

**Note:** This is primarily a TUI concern. Since the primary usage is interactive TUI mode where custom messages are rendered via the TUI, the renderer may not be strictly necessary for the current use case. Print mode support is a nice-to-have but not a blocker.
