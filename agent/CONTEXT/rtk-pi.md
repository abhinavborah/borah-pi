# rtk-pi Context — For Next Agent Session

This file is the handoff document for the rtk-pi extension. It captures all architectural decisions, debugging sessions, bugs found/fixed, and operational knowledge. See `docs/rtk-pi.md` for feature documentation.

## What Is rtk-pi

A minimal pi extension that:

- Hooks `tool_call` to rewrite bash commands via `rtk rewrite` (e.g., `cat file` → `rtk read file`)
- Hooks `tool_result` to compact bash/grep output with heuristic filters
- Persists stats to `stats.json` across invocations
- Registers `/rtk` slash commands for status, verify, stats, clear-stats, reset, help

**Goal:** Minimal replacement for pi-rtk-optimizer (~560 lines vs ~8,500 lines of source).

---

## Important Paths

### Extension & Config

```
~/.pi/agent/extensions/rtk-pi.ts          # Extension source (THIS FILE)
~/.pi/agent/extensions/rtk-pi/
  config.json                              # RTK config (auto-created)
  stats.json                               # Persisted stats (auto-created)
~/.pi/agent/docs/rtk-pi.md                # Feature documentation + WIP
~/.pi/agent/CONTEXT/rtk-pi.md              # This file — debugging & handoff
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

## How to Run

```bash
# Load only rtk-pi (disable all other extensions)
pi --no-extensions -e ~/.pi/agent/extensions/rtk-pi.ts

# Print mode (each invocation is fresh process, stats accumulate across runs)
pi --no-extensions -e ~/.pi/agent/extensions/rtk-pi.ts -p "run: cat package.json"

# JSON mode (for verifying custom messages)
pi --no-extensions -e ~/.pi/agent/extensions/rtk-pi.ts --mode json "/rtk show"

# Interactive TUI (primary usage mode)
pi --no-extensions -e ~/.pi/agent/extensions/rtk-pi.ts
```

---

## Bug Fixes & Debugging History

### Bug 1: `pi.exec()` can't run RTK (FIXED)

**Problem:** Initially used `pi.exec("rtk", ["rewrite", command], { timeout: 3000 })`. RTK uses `#!/usr/bin/env node` shebang. `pi.exec()` uses `shell: false` in `execCommand()`, which bypasses shell shebang resolution. RTK binary was never found.

**Detection:**

```bash
# pi.exec() was silently failing — exit code 1, no stdout
# RTK's exit codes: 0/3=rewrite on stdout, 1=no rewrite, 2=error
# With shell:false, spawn can't find rtk at all → exits 1
```

**Fix:** Replace `pi.exec()` with `require("child_process").execSync()`:

```typescript
const { execSync } = require("child_process");
rewritten = execSync(`rtk rewrite ${JSON.stringify(command)}`, {
  timeout: 3000,
})
  .toString()
  .trim();
```

**Note:** `execSync` runs via shell (`/bin/sh`), so JS executables with shebangs resolve correctly.

---

### Bug 2: RTK exit code 3 stdout in caught exception (FIXED)

**Problem:** RTK exits code **3** with rewritten command on **stdout** — not by normal return. `execSync()` throws an exception with `status: 3`, and `err.stdout` contains the rewritten command.

**Detection:**

```bash
$ rtk rewrite "cat package.json"
rtk read package.json
$ echo $?
3
```

**Fix:** Catch the exception and extract stdout from it:

```typescript
} catch (e) {
  const err = e as NodeJS.ErrnoException & { stdout: Buffer };
  const code = err.status;
  if (code === 3) {
    rewritten = err.stdout.toString().trim();  // stdout is in the caught exception
  } else if (code === 1 || !code) {
    return; // No rewrite needed
  } else {
    ctx.ui.notify(`RTK rewrite error (code ${code})`, "warning");
    return;
  }
}
```

**Why `(e as any).stdout` doesn't work reliably:** TypeScript `execSync` type only exposes `status`, `signal`, `output`, `pid`, `stderr` on the exception object. `stdout` is also present at runtime but not in the type. Must cast to extended type with `stdout: Buffer` field.

---

### Bug 3: Helper functions outside factory closure (FIXED)

**Problem:** `rtkStatusLine()` and `rtkVerifyOutput()` were defined **before** the `export default function(pi: ExtensionAPI)` factory, referencing `config` and `stats` variables that don't exist yet (they're declared inside the factory).

```
Extension error (command:rtk): config is not defined
```

**Fix:** Move helpers **inside** the factory so they close over the factory-scoped `config` and `stats`:

```typescript
export default function (pi: ExtensionAPI) {
  const { config } = loadPersisted();

  // Helpers INSIDE factory, closing over config + stats
  function rtkStatusLine(): string { ... }
  function rtkVerifyOutput(): string { ... }

  // ... rest of extension
}
```

---

### Bug 4: `tool_result` event type mismatch (WORKAROUND IN PLACE)

**Problem:** `tool_result` event's `content` is typed as `unknown[]` in the runner, but pi's internal after-tool-call handler passes it as whatever the tool returned (array or single object). The extension code filters assuming it's an array:

```typescript
const textBlocks = content.filter((c): c is { type: "text"; text: string } => ...);
```

**Status:** Works in practice — pi actually passes an array. The type in the extension runner is just overly broad. No action needed unless type errors appear.

---

### Bug 5: `showRewriteNotifications` defaulting to `false` (BY DESIGN)

**Original pi-rtk-optimizer** has `showRewriteNotifications: true` by default. rtk-pi defaults to `false` intentionally to reduce TUI noise. Can be changed in `config.json`:

```json
{ "showRewriteNotifications": true }
```

---

### Bug 6: `loadPersisted()` returned wrong shape

**Problem:** Originally `loadPersisted()` returned `{ config, stats }` and the factory did `const { config } = loadPersisted()`. But `PersistedData` interface was later changed to only include `config`, and the `stats` key was removed from `config.json`. The merge with `DEFAULT_STATS` in `loadPersisted()` was dead code.

**Fix:** Separate `loadStats()`/`saveStats()` for the `stats.json` file. `loadPersisted()` only returns `config`. Stats are loaded separately:

```typescript
let stats = loadStats(); // reads stats.json
function incrementStats(patch: Partial<RtkStats>) {
  stats = { ...stats, ...patch };
  saveStats(stats);
}
```

**Why separate files:** `config.json` has complex nested structure managed by `savePersisted()`. Stats are simple counters updated frequently — separate file avoids merge conflicts and keeps files small.

---

### Bug 7: `savePersisted()` call after removing `stats` from interface

**Problem:** After removing `stats` from `PersistedData` interface, `savePersisted()` was no longer defined in the file (it was replaced by `saveStats()`). Any call to `savePersisted()` would crash.

**Fix:** Re-added `savePersisted()` after the replacement:

```typescript
function savePersisted(data: PersistedData): void {
  ensureConfigExists();
  try {
    writeFileSync(CONFIG_PATH, `${JSON.stringify(data, null, 2)}\n`, "utf-8");
  } catch {
    /* ignore */
  }
}
```

---

## RTK Binary Behavior

```
$ rtk --version
rtk 0.40.0

$ rtk rewrite "ls -la"
rtk ls -la
$ echo $?
3

$ rtk rewrite "echo hello"
$ echo $?
1          # no rewrite needed

$ rtk rewrite "rm -rf /tmp"
$ echo $?
1          # no rewrite for destructive
```

**Exit codes:**

- `0`: Rewrite available (sometimes)
- `1`: No rewrite needed (command already optimal)
- `2`: Error
- `3`: Rewrite available (stdout has rewritten command) ← most common

The rewritten command is ALWAYS on stdout. With `execSync`, it's in the caught exception's `err.stdout`. With `pi.exec()` it would be in `result.stdout`.

---

## Extension API Notes

### `tool_call` Event

- `event.toolName: string` — tool name (e.g., "bash")
- `event.toolCallId: string` — unique call ID
- `event.input: Record<string, unknown>` — tool arguments, **MUTABLE**
- Return `{ block: true, reason?: string }` to block execution
- Return `undefined` to proceed normally
- Mutation to `event.input.command` is applied before tool execution

### `tool_result` Event

- `event.toolName: string`
- `event.toolCallId: string`
- `event.input: Record<string, unknown>` — original args
- `event.content: unknown[]` — tool result content array
- `event.details: unknown`
- `event.isError: boolean`
- Return **partial patch**: `{ content?, details?, isError? }` — runner merges omitted fields
- Return `undefined` to pass result through unchanged

### `session_subscribe` in print mode

Custom messages with `display: true` are emitted via `session.subscribe()` (visible in JSON mode). Print mode's `writeRawStdout()` only prints the last assistant message's text content — **custom messages are NOT printed to stdout in text mode**. This is a pi print mode design, not an rtk-pi bug.

### `sendMessage()` options

```typescript
pi.sendMessage({ customType: "rtk-pi", content: "text", display: true });
// deliverAs options: "steer" (queue while streaming), "followUp" (after tools), "nextTurn" (next prompt)
// triggerTurn: true — makes LLM respond (CONSUME TOKENS — not used)
```

---

## pi-core Internal Notes

### Extension Loader

`dist/core/extensions/loader.js` uses `jiti/static` with `VIRTUAL_MODULES` and `getAliases()` to resolve packages like `@earendil-works/pi-coding-agent` in both Bun binary and Node.js dev mode.

### `@earendil-works/pi-coding-agent` exports

Available exports (`dist/index.d.ts`):

- `ExtensionAPI`, `ExtensionContext`, `ExtensionCommandContext`
- `isToolCallEventType`, `isBashToolResult`, `isGrepToolResult`, etc.
- `createBashTool`, `createGrepTool`, etc.
- `defineTool`, `registerTool`, `registerCommand`, `registerMessageRenderer`
- `SessionManager`, `AgentSession`

**Package exports field:**

```json
{
  ".": { "import": "./dist/index.js", "types": "./dist/index.d.ts" },
  "./hooks": {
    "import": "./dist/core/hooks/index.js",
    "types": "./dist/core/hooks/index.d.ts"
  }
}
```

### `ExtensionRunner.emitToolCall()`

Located at `dist/core/extensions/runner.js`. Iterates extensions in load order. For each `tool_call` handler:

1. Creates `ExtensionContext` via `runner.createContext()`
2. Calls handler with `(event, ctx)`
3. If handler returns `{ block: true }`, returns immediately (blocking)
4. If handler returns nothing/undefined, proceeds to next handler
5. Returns last non-undefined result

**Mutations to `event.input.command` ARE applied** — they're in-place mutations on the event object passed by reference.

### `ExtensionRunner.emitToolResult()`

Located at `dist/core/extensions/runner.js`. For each `tool_result` handler:

1. Creates a copy of `event`: `const currentEvent = { ...event }`
2. If handler returns a patch, merges `content`, `details`, `isError` into `currentEvent`
3. Handler 2 sees handler 1's patches
4. Returns patch only if `modified === true`

---

## Test Commands

```bash
# Clear stats
pi --no-extensions -e ~/.pi/agent/extensions/rtk-pi.ts -p "/rtk clear-stats"

# Verify stats persistence
cat ~/.pi/agent/extensions/rtk-pi/stats.json

# Test RTK rewrite (cat → rtk read)
pi --no-extensions -e ~/.pi/agent/extensions/rtk-pi.ts -p "run: cat ~/Developer/memora_web_prototype/package.json | head -5"

# Test compaction (git status)
pi --no-extensions -e ~/.pi/agent/extensions/rtk-pi.ts -p "run: git status"

# Verify /rtk command output (JSON mode — text mode shows nothing)
pi --no-extensions -e ~/.pi/agent/extensions/rtk-pi.ts --mode json "/rtk show"
# Expected: {"type":"message_start","message":{"role":"custom","customType":"rtk-pi","content":"**RTK Status:**...

# Verify /rtk command in interactive TUI
pi --no-extensions -e ~/.pi/agent/extensions/rtk-pi.ts
# Then type: /rtk stats

# Test guard (rm -rf should NOT be rewritten)
pi --no-extensions -e ~/.pi/agent/extensions/rtk-pi.ts -p "run: rm -rf /tmp/test"
```

---

## Git Commits on This Extension

```bash
cd ~/.pi

# Commit 1: Initial rtk-pi extension
git commit -m "add rtk-pi extension: minimal rtk rewrite + output compaction
- hooks tool_call to rewrite bash commands via rtk rewrite
- hooks tool_result to compact bash/grep output with heuristics
- persists stats to rtk-pi/stats.json across invocations
- adds /rtk command for status, verify, stats, clear-stats, reset
- documents architecture, known limitations, and testing in docs/rtk-pi.md"

# Commit 2: WIP section for custom message renderer
git commit -m "docs: add wip section for custom message renderer in rtk-pi.md"

# Commit 3: Missing features sorted by priority
git commit -m "docs: add #wip missing features sorted by priority"

# Current status: all commits on branch main, 1 commit ahead of origin/main
```

---

## WIP Priority List (from docs/rtk-pi.md)

### High Priority

1. Read tool compaction — RTK rewrites `cat file` → `rtk read file`; compact read tool output
2. Streaming sanitization — Handle partial output via `tool_execution_update`
3. Smart truncation — Truncate by line count, not just character count

### Medium Priority

4. RTK hook warning stripping
5. RTK exec resolution (which/where fallback)
6. Emoji sanitization

### Low Priority

7. Source code filtering (strip comments)
8. Windows compatibility
9. Config modal UI

### Nice to Have

10. Runtime status caching (30s TTL on RTK availability check)
11. Bounded notice tracker (dedupe warnings)
12. System prompt troubleshooting note

---

## Key Reference Sources

| Source                         | Location                                                                                  | Purpose                           |
| ------------------------------ | ----------------------------------------------------------------------------------------- | --------------------------------- |
| pi-rtk-optimizer (original)    | `~/.nvm/.../node_modules/pi-rtk-optimizer/src/`                                           | Reference implementation          |
| pi-rtk-optimizer (github repo) | https://github.com/MasuRii/pi-rtk-optimizer                                               | Reference implementation          |
| pi extension docs              | `~/.nvm/.../node_modules/@earendil-works/pi-coding-agent/docs/extensions.md`              | Extension API reference           |
| pi ExtensionAPI types          | `~/.nvm/.../node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts` | Type definitions                  |
| pi ExtensionRunner             | `~/.nvm/.../node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/runner.js`  | Event hook implementation         |
| pi AgentSession                | `~/.nvm/.../node_modules/@earendil-works/pi-coding-agent/dist/core/agent-session.js`      | tool_call/tool_result integration |
| RTK binary                     | `/opt/homebrew/bin/rtk`                                                                   | Rewrites bash commands            |
| RTK repo                       | https://github.com/rtk-ai/rtk                                                             | RTK CLI tool                      |
| rtk-pi docs                    | `~/.pi/agent/docs/rtk-pi.md`                                                              | Feature documentation             |
| rtk-pi context                 | `~/.pi/agent/CONTEXT/rtk-pi.md`                                                           | This file                         |

---

## Design Principles Going Forward

1. **Keep it minimal** — pi-rtk-optimizer has ~8,500 lines. rtk-pi should stay under ~1000.
2. **execSync for RTK** — `pi.exec()` with `shell: false` can't run shebang-based JS CLIs. Always use `require("child_process").execSync()` for RTK invocation.
3. **Separate files for config vs stats** — config.json is complex/rarely-written, stats.json is simple/frequently-written.
4. **Helper functions inside factory** — any function using `config` or `stats` must be inside the `export default function(pi)` factory.
5. **Partial patches for tool_result** — return `{ content }` not the full result object. Runner merges the rest.
6. **Stats via incrementStats()** — always use `incrementStats({ field: newValue })` to ensure stats are written to disk after each update.

