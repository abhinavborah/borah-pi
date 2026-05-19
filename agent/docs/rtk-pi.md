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

## #WIP — Unused RTK Native Commands

rtk-pi only uses `rtk rewrite`. RTK provides 50+ native commands with their own output filters. These are completely or partially unused by rtk-pi.

**Priority is based on:** (1) how often the command replaces verbose bash, (2) how much token savings RTK provides natively vs rtk-pi's own heuristics, (3) whether the tool is already available in pi (grep, read, etc. — which have their own handlers).

> **For the next agent session:** When reading this file, before starting any implementation work, ask the user which command they want to implement next, starting from priority 1.

### High Priority (rewrite targets — most impactful)

1. **`rtk json <file>`** — Replace `cat *.json` with structured JSON viewer. RTK shows keys-only or compact values, great for large config files.
   - Rewrite: `cat package.json` → `rtk json package.json` (RTK auto-detects JSON)
   - RTK flags: `--keys-only`, `--depth N`
   - Note: `cat foo.json | jq` is verbose; `rtk json foo.json` is direct

2. **`rtk find <args>`** — Token-optimized find. Groups output by directory, shows compact tree.
   - Rewrite: `find . -name '*.ts' | head -20` → `rtk find . -name '*.ts' --max 20`
   - RTK native handles grouping — replaces both `find` and our `groupSearchOutput()` heuristics
   - Note: `rtk find` accepts native `find` flags natively

3. **`rtk tree [path]`** — Compact directory tree. Replaces `ls -R`, `find . -type d`.
   - Rewrite: `ls -R src/` → `rtk tree src/`
   - RTK output is token-compressed tree format

4. **`rtk err <command>`** — Run a command and show only errors/warnings. Strip progress bars and noise.
   - Rewrite: `npm run build 2>&1 | grep -i error` → `rtk err npm run build`
   - This is a universal wrapper — could wrap ANY build/lint/test command
   - Note: `rtk test` and `rtk lint` are specializations of this

5. **`rtk deps`** — Summarize project dependencies. Replaces `cat package.json | head -50`, `cat Cargo.toml`.
   - Rewrite: `cat package.json` (when it looks like a dep listing) → `rtk deps`
   - Shows grouped deps by category, version ranges compressed

6. **`rtk env`** — Show env vars with sensitive data masked. Replaces `cat .env`, `echo $VAR`.
   - Rewrite: `cat .env` → `rtk env` (when file has ENV/ secrets)
   - RTK auto-detects .env and filters sensitive keys

### Medium Priority (rewrite targets — useful but less common)

7. **`rtk wc <file>`** — Word/line/byte count without verbose padding. Replaces `wc -l`.
   - Rewrite: `wc -l src/**/*.ts` → `rtk wc src/**/*.ts`
   - RTK strips paths and padding for compact output

8. **`rtk diff`** — Ultra-condensed diff. Replaces `git diff` and `diff file1 file2`.
   - Rewrite: `diff -u a.ts b.ts` → `rtk diff`
   - RTK shows only changed lines, grouped by file

9. **`rtk log`** — Filter and deduplicate log output. Replaces `cat *.log | tail -100`.
   - Rewrite: `tail -100 app.log` → `rtk log --tail-lines 100 app.log`
   - RTK deduplicates repeated lines, strips timestamps

10. **`rtk curl`** — Auto-detects JSON responses and shows schema. Replaces `curl ... | jq`.
    - Rewrite: `curl https://api.example.com/data` → `rtk curl https://api.example.com/data`
    - RTK detects JSON and shows schema instead of full response

11. **`rtk gh`** — GitHub CLI with compact output. Replaces verbose `gh` output.
    - Rewrite: `gh pr list` → `rtk gh pr list`
    - RTK compresses table output, highlights PR state

12. **`rtk docker`** — Docker commands with compact output.
    - Rewrite: `docker ps`, `docker images` → `rtk docker ps`, `rtk docker images`
    - RTK strips ASCII art, compresses table output

### Low Priority (rewrite targets — niche or already covered)


13. **`rtk aws <args>`** — AWS CLI with compact output. Force JSON, compress tables.
    - Rewrite: `aws s3 ls` → `rtk aws s3 ls`
    - Only if AWS CLI is commonly used

14. **`rtk kubectl`** — Kubectl commands with compact output.
    - Rewrite: `kubectl get pods` → `rtk kubectl get pods`
    - Useful for K8s workflows

15. **`rtk psql`** — PostgreSQL client with compact output.
    - Rewrite: `psql -c "SELECT * FROM users"` → `rtk psql -c "..."`
    - Strip borders, compress tables

16. **`rtk glab`** — GitLab CLI with compact output.
    - Rewrite: `glab mr list` → `rtk glab mr list`
    - Similar to `rtk gh`

17. **`rtk gradlew`** — Android Gradle wrapper with compact output.
    - Rewrite: `./gradlew build` → `rtk gradlew build`
    - Only relevant for Android projects

18. **`rtk dotnet`** — .NET commands with compact output.
    - Rewrite: `dotnet build`, `dotnet test` → `rtk dotnet build`, `rtk dotnet test`

19. **`rtk rake`** / **`rtk rspec`** / **`rtk rubocop`** — Ruby tool wrappers.
    - Rewrite: `rake test`, `rspec`, `rubocop` → `rtk rake test`, etc.

20. **`rtk pip`** — Pip with compact output (auto-detects uv).
    - Rewrite: `pip install foo` → `rtk pip install foo`

21. **`rtk go`** — Go commands with compact output.
    - Rewrite: `go build`, `go test` → `rtk go build`, `rtk go test`

### Already Covered by pi Tools (lower rewrite priority)

These commands have native pi tool equivalents. The pi tool handles the execution; RTK rewrite could still improve output format, but it's a secondary concern.

| Command | pi tool | Notes |
|---------|---------|-------|
| `rtk grep` | ✅ grep tool | pi's grep tool already handles search; RTK rewrite may still be useful |
| `rtk read` | ✅ read tool | Already works via `cat` → `rtk read` rewrite |
| `rtk ls` | ✅ ls tool | Already works; RTK native output is better but our heuristics handle it |
| `rtk git *` | ✅ bash | `rtk git status/diff/log/show` all work via rewrite; native output not used |
| `rtk lint` / `rtk ruff` / `rtk mypy` | ✅ bash | Run via bash; RTK's grouped output not utilized |
| `rtk test` / `rtk jest` / `rtk vitest` / `rtk pytest` | ✅ bash | Run via bash; RTK's failure-only output not utilized |
| `rtk pnpm` / `rtk npm` / `rtk npx` | ✅ bash | Package manager wrappers, less impactful |
| `rtk tsc` | ✅ bash | TypeScript compiler output grouped by file |
| `rtk cargo` | ✅ bash | Rust build output |
| `rtk playwright` | ✅ bash | E2E test output |
| `rtk prisma` | ✅ bash | Prisma output compact |
| `rtk next` | ✅ bash | Next.js build output |
| `rtk prettier` / `rtk format` | ✅ bash | Format checker output |
| `rtk rtk init` | ❌ not needed | RTK CLI setup, not relevant to pi integration |
| `rtk discover` / `rtk session` | ❌ not needed | Claude Code session metrics, not pi |
| `rtk hook *` | ❌ not needed | Claude Code / Gemini / Copilot hooks, not pi |
| `rtk cc-economics` / `rtk gain` | ❌ not needed | Claude Code token tracking, not pi |
| `rtk telemetry` | ❌ not needed | RTK internal telemetry |
| `rtk learn` | ❌ not needed | RTK CLI learning from history |
| `rtk trust` / `rtk verify` | ❌ not needed | Project-local TOML filters |
| `rtk proxy` / `rtk run` | ❌ not needed | Shell passthrough |
| `rtk pipe` | ❌ not needed | Unix pipe mode |
| `rtk gt` / `rtk golangci-lint` | ❌ niche | Graphite/GitLab PR stacking, golangci-lint |
| `rtk wget` | ❌ niche | Download wrapper |

### How to Add a Rewrite Target

Each rewrite target needs a pattern in the tool_call handler. Example for `rtk json`:

```typescript
// In tool_call handler, before the rtk rewrite call:
// Detect JSON file reads that should use rtk json instead of rtk read
if (/cat\s+.*\.json(?:\s|$)/.test(command)) {
  // Rewrite: cat foo.json -> rtk json foo.json
  // This is handled by rtk rewrite automatically!
  // No extra code needed — just verify the pattern matches
}
```

**Key insight:** Most `rtk <subcommand>` rewrites are handled automatically by `rtk rewrite "<original command>"`. The extension doesn't need to know about each command individually — it just calls `rtk rewrite` and RTK returns the appropriate `rtk <subcommand>` equivalent.


The main work is verifying that `rtk rewrite` produces useful rewrites for each command type, and that the `tool_result` handler correctly processes the output from RTK-native commands.

---

## RTK Architecture Notes (from RTK CONTRIBUTING.md)

These notes are extracted from [RTK's CONTRIBUTING.md](https://github.com/rtk-ai/rtk/blob/develop/CONTRIBUTING.md) and related docs. They inform rtk-pi's roadmap and design decisions.

### Core Design Principles (RTK)


1. **Correctness VS Token Savings** — When a user/LLM explicitly requests verbose output via flags (e.g., `git log --comments`, `cargo test -- --nocapture`), respect that intent. Filters should be flag-aware. rtK-pi doesn't have flag awareness yet — this is a future improvement.

2. **Transparency** — RTK's output must be a valid, useful subset of the original tool's output — not a different format. Don't invent new output formats. rtK-pi's compaction creates summaries that ARE different formats from the original.


3. **Never Block** — If a filter fails, fall back to raw output. RTK should never prevent a command from executing. rtK-pi follows this: `tool_result` returns `undefined` when no technique matches, passing through raw output.


4. **Zero Overhead** — RTK targets <10ms startup. rtK-pi is a TypeScript extension; overhead depends on pi's startup time.


### Command Classification (RTK rewrite pipeline)

The rewrite pipeline flow in RTK:
```
LLM Agent → hook shell → rewrite_cmd → rewrite_compound → rewrite_segment → classify_command
```

`classify_command()` does:
1. Check IGNORED_EXACT (cd, echo, ...)
2. Check IGNORED_PREFIXES (rtk, mkdir, mv, ...)
3. Strip env prefix (for pattern matching only)
4. Normalize absolute paths
5. Strip git global opts (`git -C /tmp status` → `git status`)
6. Guard: cat/head/tail with redirect (`>`, `>>`) → Unsupported
7. Match against REGEX_SET (60+ compiled patterns from rules.rs)
8. Extract subcommand → lookup custom savings/status overrides
9. Return Classification

rtK-pi uses `rtk rewrite` directly — it doesn't reimplement this classification. This means rtK-pi benefits from RTK's rule registry automatically.

### TOML vs Rust: Filter Implementation

RTK has two filter implementations:

| Type | When to use | Example |
|------|-------------|---------|
| **TOML filter** | Plain text, predictable line structure, regex line filtering, no state needed | brew, df, shellcheck, rsync |
| **Rust module** | Structured output (JSON/NDJSON), state machine parsing, flag injection, cross-command routing | vitest, pytest, golangci-lint, gh |

rtK-pi uses TypeScript heuristics — a third approach. It's closer to TOML filters (pattern matching on text) but less robust than Rust modules. The heuristic approach is simpler to implement but may miss edge cases.


### Command Categories in RTK

RTK organizes commands by ecosystem:

| Ecosystem | Commands | Notes |
|-----------|----------|-------|
| git | git, gh, gt, diff | trailing_var_arg parsing, gh markdown filtering |
| rust | cargo, runner | Cargo sub-enum routing, runner dual-mode |
| js | npm, pnpm, vitest, lint, tsc, next, prettier, playwright, prisma | Package manager auto-detection, lint routing |
| python | ruff, pytest, mypy, pip | JSON check vs text, state machine, uv auto-detection |
| go | go test/build/vet, golangci-lint | NDJSON streaming, Go sub-enum pattern |
| dotnet | dotnet, binlog, trx | Dotnet sub-enum |
| cloud | aws, docker, kubectl, curl, wget, psql | JSON forced output |
| system | ls, tree, read, grep, find, wc, env, json, log, deps, format, smart | format_cmd routing, filter levels, language detection |
| ruby | rake, rspec, rubocop | JSON injection, bundle exec auto-detection |

rtK-pi's current compaction only covers `system/` and `git/` ecosystem commands.

### RTK Filter Modes (Execution)

| Mode | How it works | rtK-pi equivalent |
|------|-------------|-------------------|
| **CaptureOnly** | Buffers all stdout, filters post-hoc, stderr streams live | `tool_result` handler (post-hoc) |
| **Buffered** | Buffers stdout, filters, prints result | Same as above |
| **Streaming** | Line-by-line filtering as output arrives | Future: `tool_execution_update` handler |
| **Passthrough** | No filtering, just track usage | No equivalent in rtK-pi |

rtK-pi currently only has the CaptureOnly/Buffered equivalent. Streaming is the #WIP highest priority feature.
### What Belongs in RTK (In Scope)

Commands that produce text output (100+ tokens) and can be compressed 60%+ without losing essential information:
- Test runners (vitest, pytest, cargo test, go test)
- Linters and type checkers (eslint, ruff, tsc, mypy)
- Build tools (cargo build, dotnet build, make, next build)
- VCS operations (git status/log/diff, gh pr/issue)
- Package managers (pnpm, pip, cargo install, brew)
- File operations (ls, tree, grep, find, cat/head/tail)
- Infrastructure tools (docker, kubectl, terraform)

Out of scope: Interactive TUIs (htop, vim), Binary output, Trivial commands, Commands with no text output.

### Key Insight for rtK-pi Roadmap

RTK's design philosophy of **flag-awareness**, **never blocking**, and **transparency** should guide rtK-pi's compaction heuristics:

1. **Flag-awareness** — rtK-pi should NOT compact output when the LLM explicitly requested verbose output (e.g., `ls -la` vs `ls`). Currently all commands are treated the same.

2. **Never block** — Already followed: `tool_result` returns `undefined` on no match.

3. **Transparency** — rtK-pi's compaction creates SUMMARIES (like `"5 commits, +142/-89 ✓"`) which IS a different format. RTK's approach is to return a shorter version of the original format, not a summary. This is a design trade-off rtK-pi made for token savings vs format preservation.

See [RTK CONTRIBUTING.md](https://github.com/rtk-ai/rtk/blob/develop/CONTRIBUTING.md) and [docs/contributing/TECHNICAL.md](https://github.com/rtk-ai/rtk/blob/develop/docs/contributing/TECHNICAL.md) for full reference.


