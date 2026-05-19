# rtk-pi — RTK Integration for pi (v2)

A minimal extension that calls RTK subcommands directly for token savings, and compacts read tool output.

## Installation

```bash
pi --no-extensions -e ~/.pi/agent/extensions/rtk-pi.ts
```

## RTK Binary Requirement

Requires [rtk](https://github.com/rtk-ai/rtk) installed and in PATH. RTK provides 60-90% token savings on command outputs.

Verify RTK availability:

```bash
rtk --version   # should print version
```

## Features

### 1. RTK Direct Calls (`tool_call` hook)

Intercepts bash commands and rewrites them to RTK subcommands. RTK's output is already compact (60-90% token savings vs raw commands), and pi's summarization then summarizes this compact output.

**Patterns intercepted:**

| Pattern | RTK Subcommand | Token Savings |
|---------|---------------|---------------|
| `git push/commit/pull/add` | `rtk git <sub>` | ~92% (e.g., `ok main`) |
| `git status/diff/log` | `rtk git <sub>` | ~80% (compact format) |
| `cat <file>.json` | `rtk json <file> --keys-only` | ~70% (keys only) |
| `cat <file>` | `rtk read <file>` | ~70% for large files |
| `ls -la / ls -l / ls` | `rtk ls` | ~80% (compact tree) |
| `find . -name '<pattern>'` | `rtk find` | ~80% (compact tree) |
| `npm run build/dev/start` | `rtk err npm run build` | ~80% (errors only) |
| `npm test / pytest / cargo test` | `rtk test npm test` | ~90% (failures only) |
| `npm run lint / ruff check / eslint` | `rtk lint` | ~80% (grouped errors) |

**Safety:** Commands matching `rm -rf` are never rewritten.

### 2. Read Tool Compaction (`tool_result` hook)

Compacts the `read` tool output (bypasses pi summarization unlike bash/grep):

- Files ≤80 lines: pass through unchanged
- Files 81-220 lines: pass through unchanged
- Files >220 lines: truncate to 220 with `[RTK read .ext: N→220]` banner
- Skill path reads (`.pi/skills`, `.agents/skills`) are preserved unchanged

### 3. `/rtk` Commands

| Command | Description |
|---------|-------------|
| `/rtk show` | RTK status, mode, lifetime stats |
| `/rtk verify` | Check rtk binary availability |
| `/rtk stats` | rewrites, compactions, chars saved |
| `/rtk clear-stats` | Reset all counters to zero |
| `/rtk reset` | Reset config to defaults |
| `/rtk help` | Help text |

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
    "readCompaction": {
      "enabled": true
    },
    "truncate": { "enabled": true, "maxChars": 12000 },
    "trackSavings": true
  }
}
```

## Architecture

**v2 changes:** Replaced heuristic-based compaction with RTK direct calls. RTK's own filters provide 60-90% token savings vs raw commands. pi's summarization then summarizes RTK's compact output.

```
bash tool → tool_call → mutate command to rtk <subcommand> → bash executes RTK → pi summarizes
read tool → tool_result → compactReadOutput() → bypasses summarization
```

**Why RTK direct calls instead of heuristics:**
- RTK's output filters are more aggressive than rtk-pi's heuristics
- RTK provides 60-90% token savings per the official README
- pi's summarization is more aggressive than rtk-pi's heuristics — so heuristics add tokens, not save them
- Direct RTK calls bypass pi's summarization for bash/grep by going through the bash tool with `rtk` prefix

## Stats

Stored in `~/.pi/agent/extensions/rtk-pi/stats.json`:

```json
{
  "rewrites": 0,
  "compactions": 0,
  "charsSaved": 0
}
```

## RTK Command Reference

See [RTK README](https://github.com/rtk-ai/rtk) for full command list. Key commands:

- `rtk git status` — compact status
- `rtk git push/commit/pull` — ultra compact (e.g., `ok main`)
- `rtk read <file>` — smart file reading
- `rtk json <file> --keys-only` — structure without values
- `rtk err <cmd>` — errors/warnings only from any command
- `rtk test <cmd>` — failures only from any test command
- `rtk lint` — grouped lint errors
- `rtk ls` / `rtk tree` — compact directory listing
- `rtk find <args>` — compact find results

## File Structure

```
~/.pi/agent/extensions/rtk-pi.ts      # Extension source
~/.pi/agent/extensions/rtk-pi/
  config.json                          # RTK config
  stats.json                          # Persisted stats
~/.pi/agent/docs/rtk-pi.md            # This file
```

## Comparison with pi-rtk-optimizer

rtk-pi is a minimal replacement (~490 lines vs ~8500 lines). Key differences:

| Feature | pi-rtk-optimizer | rtk-pi |
|---------|-----------------|--------|
| Size | ~8500 lines | ~490 lines |
| Rewrite method | `rtk rewrite` + heuristics | Direct RTK subcommand patterns |
| Bash compaction | Heuristics (counterproductive in pi) | None (let pi summarize) |
| Read compaction | Full (source filter, smart truncate) | Simple (plain truncate to 220) |
| Config | Complex nested objects | Simple flat config |

## WIP — Missing Features

Sorted by priority (most important first). See [pi-rtk-optimizer/src/](https://github.com/MasuRii/pi-rtk-optimizer/tree/main/src) for reference implementations.

### High Priority

1. **Streaming sanitization** — Handle partial/streaming output during long-running bash commands (`tool_execution_update` hook).

2. **RTK exec resolution (which/where fallback)** — Robustly resolve `rtk` binary path using `which` (Unix) or `where` (Windows).

3. **Bounded notice tracker** — Deduplicate warning/notification messages.

### Medium Priority

4. **Smart truncation (by lines)** — Truncate by logical lines instead of raw character count.

5. **Source code filtering** — Strip comments and excessive whitespace from source code reads.

6. **RTK hook warning stripping** — RTK sometimes emits hook-related warnings that pollute output.

7. **Emoji sanitization** — RTK output may include emoji; strip or normalize them.

### Low Priority

8. **Windows compatibility** — Path separator normalization, `cmd.exe` vs `bash` handling.

9. **Config modal UI** — Interactive TUI settings modal (beyond `/rtk` slash commands).

10. **Runtime status caching** — Cache RTK availability check for 30s to avoid repeated calls.

11. **System prompt troubleshooting note** — When source filtering is enabled, inject a note about edit failures.

### Done

- ✅ Read tool compaction (v1)
- ✅ RTK direct call patterns (v2)
- ✅ Remove heuristic compaction for bash/grep (v2)