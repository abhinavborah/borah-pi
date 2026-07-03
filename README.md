# Pi Config

Personal pi coding-agent setup: multiplexer-pane subagents, long-session memory, terseness layers, a status line that does real work, and MCP integrations.

![demo](./demo/demo.png)

## What's Included

```
~/.pi/
├── agent/
│   ├── AGENTS.md            # Global orchestration instructions (47 lines, persona + pattern)
│   ├── settings.json        # 12-extension packages list, model, theme, observational-memory config
│   ├── agents/              # 11 local subagent personas (see Custom Agents)
│   ├── art/                 # ASCII art + splash layout
│   ├── docs/                # Topic docs (swarm, mcp, skills) cross-referenced from AGENTS.md
│   ├── extensions/          # Local extensions (theme-cycler, splash, context7, deepwiki, composed-footer, + dormant themeMap/coms)
│   ├── git/                 # Git-installed packages (runtime, gitignored)
│   ├── npm/                 # npm-installed packages (runtime, gitignored)
│   ├── skills/              # Local skills (bowser, graphify, supacode-cli) + symlinks to Matt Pocock skills
│   └── themes/              # 13 theme JSONs
├── README.md                # This file
└── justfile                 # ~12 stale recipes; ignored for now
```

## Persona Resolution

`agent/agents/<name>.md` (local) wins over `<name>.md` shipped inside any `git:` or `npm:` package. Bundle-only names fall through to the bundled version. When both exist and conflict, the local file's tools, thinking, and body win; the bundle's metadata (description, cli) is ignored. Rename local files (e.g. `pi-scout.md`) to invert.

In practice: the local library at `agent/agents/` is structurally designed to inherit the orchestrator's model. All local personas have no `model:` line except `bowser.md` (which explicitly sets `opencode-go:kimi:k2.6`). `subagent(agent: "scout")` resolves the local scout, which then runs on the orchestrator's default model.

---

## Installed Packages

| Source | Package | Purpose |
|---|---|---|
| git | [HazAT/pi-interactive-subagents](https://github.com/HazAT/pi-interactive-subagents) | Multiplexer-pane subagent orchestrator |
| git | [DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail) | Lazy/lean dev persona mode (OpenCode plugin) |
| git | [jonjonrankin/pi-caveman](https://github.com/jonjonrankin/pi-caveman) v1.0.7 | Ultra-compact comms + animated status bar |
| npm | [pi-observational-memory](https://github.com/elpapi42/pi-observational-memory) v3.0.2 | Long-session observation + compaction |
| npm | [pi-rtk-optimizer](https://github.com/MasuRii/pi-rtk-optimizer) | Auto-rewrites bash to compact rtk equivalents |
| npm | pi-mcp-adapter | MCP server integration |
| npm | [pi-web-access](https://github.com/nicobailon/pi-web-access) | `web_search`, `fetch_content`, `get_search_content` |
| local | `extensions/theme-cycler.ts` | Theme cycling (Ctrl+. / Ctrl+,) |
| local | `extensions/splash.ts` | ASCII art splash on session start |
| local | `extensions/context7.ts` | `/context7` for up-to-date library docs |
| local | `extensions/deepwiki.ts` | `/deepwiki` for GitHub repo docs + Q&A |
| local | `extensions/composed-footer.ts` | Claude-style statusline (badges + ctx% + token totals) |

Run `pi list` for the live view.

---

## Custom Agents

Subagent personas in `agent/agents/`. Invoked via `subagent({ agent: "<name>", ... })` from the orchestrator. All inherit the orchestrator's model unless explicitly overridden.

| Agent | Purpose | Context | Model |
|---|---|---|---|
| **scout** | Fast codebase recon, entry points, types, data flow, risks | fresh | inherits |
| **researcher** | Web/docs research, searches, fetches, synthesizes evidence | fresh | inherits |
| **planner** | Turns requirements into implementation plans | fork | inherits |
| **builder** | Implementation with `/tdd` and `/diagnose` (auto-reads `context.md`, `plan.md`) | fork | inherits |
| **reviewer** | Code review, correctness, tests, simplicity (fresh context) | fresh | inherits |
| **oracle** | Advisory, challenges assumptions, no edits | fork | inherits |
| **context-builder** | Strong handoff pass, gathers context + meta-prompt | fresh | inherits |
| **documenter** | Documentation and README generation | fork | inherits |
| **red-team** | Security and adversarial testing | fork | inherits |
| **plan-reviewer** | Plan critic, reviews and validates implementation plans | fork | inherits |
| **bowser** | Headless browser automation via Playwright CLI; supports parallel instances | fork | `opencode-go:kimi:k2.6` (explicit) |

Tools per persona are listed in the frontmatter of each `agent/agents/<name>.md`. Some persona frontmatter lists reference tools that are not currently registered (notably `intercom`, `context7_search_docs`, `deepwiki_search`, `code_search`); see Known Drift below.

### Core Orchestration Pattern

```
clarify -> scout/research -> planner -> builder -> parallel fresh reviewers -> builder fix -> validate
```

One writer thread only. `builder` implements, `reviewer` never silently edits. Fork for advisory threads (`oracle`); fresh context for adversarial reviewers. Escalate unapproved decisions upward.

### Example invocations

```typescript
// Map unfamiliar code
subagent({ agent: "scout", task: "Map the auth flow" });

// Implement after plan approval
subagent({ agent: "builder", task: "Implement the auth middleware" });

// Parallel reviewers with distinct angles
subagent({
  tasks: [
    { agent: "reviewer", task: "Correctness + regressions", output: false },
    { agent: "reviewer", task: "Tests + validation", output: false },
    { agent: "reviewer", task: "Simplicity + maintainability", output: false },
  ],
  context: "fresh",
});

// Hard bug before we edit
subagent({
  agent: "oracle",
  task: "Investigate this bug before we edit. Propose best next move.",
});
```

---

## pi-interactive-subagents

[HazAT](https://github.com/HazAT/pi-interactive-subagents) replaces the older `subagent-widget`, `agent-team`, and `agent-chain` extensions. Spawns each subagent in a tmux split pane; `latestCtx.ui.setStatus("subagents", ...)` reports active count to the composed footer.

**Backends:** `tmux`, `cmux`, `zellij`, `wezterm`. Only `tmux` is installed on this machine; force a backend with `PI_SUBAGENT_MUX=cmux|tmux|zellij|wezterm`.

**Bundled agents (6):** `planner` (Opus), `scout` (Haiku), `worker` (Sonnet), `reviewer` (Opus), `visual-tester` (Sonnet), `claude-code`. The bundled personas have hardcoded `anthropic/...` model IDs that resolve to `amazon-bedrock` in this environment, so the bundled `model:` lines have been removed in-place (local patch in the gitignored runtime dir; will be wiped on the next `pi install` / `pi update`).

**Reads custom personas** from `agent/agents/<name>.md`. Local wins on name collision; see Persona Resolution above.

**Install:** `pi install git:github.com/HazAT/pi-interactive-subagents`

**Env:**
- `PI_SUBAGENT_MUX=cmux|tmux|zellij|wezterm` - force a backend
- `PI_SUBAGENT_SHELL_READY_DELAY_MS` - default 500

### Worktree isolation for parallel subagents

`pi-interactive-subagents` does not provide per-subagent worktree isolation. For parallel file-editing subagents, run each in its own git worktree. The worktrunk CLI is the cleanest way:

```bash
brew install worktrunk
wt config shell install    # required for `wt switch` to actually cd
```

Single agent:
```bash
wt switch --create feat/auth -b main
# ...edit, commit...
wt step commit -m "..."
wt merge main
wt remove
```

Parallel agents (one worktree per subagent):
```bash
wt switch -x pi -c feat/agent-1 -- 'subagent task for agent 1' &
wt switch -x pi -c feat/agent-2 -- 'subagent task for agent 2' &
wt switch -x pi -c feat/agent-3 -- 'subagent task for agent 3' &
wait
wt list
```

`-x` runs a command after switching and replaces `wt` with that command, giving it full terminal control. Arguments after `--` become the agent's prompt. See `agent/docs/swarm.md` for the full pattern.

The repo under work must be worktrunk-managed (run `wt init` once in the repo root).

---

## pi-observational-memory

[elpapi42](https://github.com/elpapi42/pi-observational-memory) v3.0.2 - long-session observation + compaction memory. Auto-observes the session at token thresholds and compacts memory to survive handoffs and long sessions.

**Install:** `pi install npm:pi-observational-memory`

**Config:** under `observational-memory.*` in `agent/settings.json`. Key settings: `observeAfterTokens` (10000), `reflectAfterTokens` (20000), `compactAfterTokens` (81000), `observationsPoolMaxTokens` (20000), `agentMaxTurns` (16), `model.{provider,id,thinking}`.

**v2 -> v3:** NOT backward compatible. Rename your settings: `observationThresholdTokens` -> `observeAfterTokens`, `compactionThresholdTokens` -> `compactAfterTokens`, `reflectionThresholdTokens` -> `reflectAfterTokens`, `compactionModel` -> `model`, etc. After upgrading, start a new clean pi session.

**Env:** `PI_OBSERVATIONAL_MEMORY_PASSIVE=1` (disable automatic observation)

**Debug log:** `agent/observational-memory/debug/<session-id>.ndjson`

---

## ponytail

[DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail) - lazy/lean dev persona mode. Forces the shortest working solution, prevents over-engineering, and gates explanations behind explicit requests.

Active by default. Intensity levels: `lite`, `full` (default), `ultra`. Disable with "stop ponytail" or "normal mode".

This repo pins ultra (`~/.config/ponytail/config.json` -> `defaultMode: ultra`, or set `PONYTAIL_DEFAULT_MODE=ultra`).

Ponytail is an OpenCode plugin, not a pi-native extension. The same repo install ships a small `pi-extension/index.js` that registers a `setStatus("ponytail", ...)` key for the composed footer. No pi-side patch is required.

```
pi install git:github.com/DietrichGebert/ponytail
```

---

## pi-caveman

[jonjonrankin/pi-caveman](https://github.com/jonjonrankin/pi-caveman) v1.0.7 - ultra-compact communication layer. Drops articles, filler, pleasantries, and hedging; keeps technical substance. Levels: `lite`, `full`, `ultra`, plus wenyan-*, `micro`.

This repo pins ultra (`agent/caveman.json` -> `defaultLevel: "ultra"`, `showStatus: true`).

The extension registers `setStatus("caveman", ...)` with an animated 8-frame colored campfire in the status bar (100ms tick on ultra). The default is cached in memory at `session_start`; if the campfire shows a milder level after editing `caveman.json`, call `/caveman ultra` or restart the session.

Ponytail and caveman are deliberately both set to ultra. They overlap mildly (both demand terseness) but operate on different layers - ponytail rewrites the model output, caveman rewrites the system prompt. The redundancy costs a few hundred input tokens per turn; the savings from both combined are larger.

Conflicts with `pi-observational-memory` are possible: both hook `before_agent_start`. The order is not guaranteed. First-run test recommended.

```
pi install git:github.com/jonjonrankin/pi-caveman@v1.0.7
```

**Auto-clarity:** caveman drops for security warnings, irreversible action confirmations, and confused-user moments. Resumes caveman after.

---

## Composed Footer (`extensions/composed-footer.ts`)

Replaces pi's default footer with a Claude-style single-line statusline:

```
[agent-id] [theme] [mcp] [rtk] [ponytail] [caveman] [om]   ...padded...   <cwd> | <branch> | <model> | <ctx%> | <tokens>
```

Optional second line shows per-tool invocation counts and `mcp:N(servers)` when any tool has been called.

**Segments:**
- `agent-id` (self-registered): `agent:<8hex>` from `sessionManager.getSessionId().slice(0,8)`
- `theme`: from `theme-cycler` (when active)
- `mcp` (self-registered): `mcp:N` for unique MCP servers (derived from `__`-prefixed tool names)
- `rtk`: `pi-rtk-optimizer` savings percent (cumulative, updated in `agent_end`)
- `ponytail`: current ponytail level
- `caveman`: current caveman level + animated campfire on ultra
- `om`: `pi-observational-memory` state (`om` / `om: reflecting` / `om: warning` on error)
- `cwd` (p10k blue 31): abbreviated home
- `branch` (p10k green 76): git branch, prefixed with worktree marker (p10k yellow 178 + tree icon) when `cwd` is in a non-first block of `git worktree list --porcelain`
- `model` (p10k dim 244): model id
- `ctx%` (green >= 40, yellow 20-40, red < 20): `100 - latest AssistantMessage.usage.input / ctx.model.contextWindow * 100` (default 200K)
- `tokens`: cumulative `^input voutput $cost` for current branch

Worktree marker is cached and invalidated on `footerData.onBranchChange`.

**Toggle:** `/composed-footer`

**Persistence caveat:** the Layer 2 `setStatus` additions to `pi-rtk-optimizer`, `pi-observational-memory`, and `pi-interactive-subagents` live in gitignored runtime dirs (`agent/git/...` and `agent/npm/...`) and will be silently wiped on the next `pi install` or `pi update` of those packages. The Layer 1 footer and `settings.json` are tracked and survive.

---

## Native Extensions

### `theme-cycler.ts`

Theme cycling with keyboard shortcuts and command. Migrated from [disler/pi-vs-claude-code](https://github.com/disler/pi-vs-claude-code).

**Shortcuts:**
- `Ctrl+.` cycle to next theme
- `Ctrl+,` cycle to previous theme

**Commands:**
- `/theme` open theme picker
- `/theme <name>` switch directly (e.g. `/theme synthwave`)

**Features:**
- Status line shows current theme name
- Color swatch widget briefly appears after switching
- Default theme: `gruvbox-new`

### `themeMap.ts`

Per-extension theme assignments. Utility module imported by `theme-cycler.ts`. Most entries are dormant; only the live themes in `agent/themes/` are wired up.

### `splash.ts`

ASCII art splash on session start.

**Features:**
- Two-column layout: logo/tagline (left), stats/shortcuts (right)
- Theme-aware colors with configurable border styles
- Displays: CWD, extensions loaded, skills loaded, tools available
- Auto-dismisses on first user message
- Configurable via `agent/art/splash.json`

### `context7.ts`

Up-to-date library documentation. Interactive command: `/context7`

**Tools:** `context7_resolve_library_id`, `context7_query_docs`

### `deepwiki.ts`

GitHub repository documentation and AI Q&A. Interactive command: `/deepwiki`

**Tools:** `deepwiki_read_wiki_structure`, `deepwiki_read_wiki_contents`, `deepwiki_ask_question`

### `composed-footer.ts`

See Composed Footer section above.

### Playwright MCP

Browser automation for web testing, screenshots, and scraping.

```json
"playwright": {
  "command": "npx",
  "args": ["@playwright/mcp@latest"]
}
```

**Tools:** `playwright_navigate`, `playwright_screenshot`, `playwright_click`, `playwright_fill`, `playwright_evaluate`

### Firecrawl MCP (Local)

Self-hosted web scraping at `http://localhost:3002` via Docker.

**Setup:**
```bash
git clone https://github.com/mendableai/firecrawl.git ~/Developer/firecrawl
cd ~/Developer/firecrawl && docker compose up -d
```

**Tools:** `firecrawl_scrape`, `firecrawl_map`, `firecrawl_search`, `firecrawl_crawl`, `firecrawl_extract`, `firecrawl_agent`

---

## Matt Pocock Skills

High-quality engineering practices for AI coding agents. Installed via:

```bash
npx skills@latest add mattpocock/skills
```

**Skill locations:**
- Primary source: `~/.agents/skills/` (40 skills)
- Symlinks: `agent/skills/` (auto-synced from primary)
- Local skills: `agent/skills/local/` (custom: `bowser`, `graphify`, `supacode-cli`)

Then run `/setup-matt-pocock-skills` to configure per-repo settings.

### Engineering Skills

| Skill | When to use | Best with |
|---|---|---|
| `/diagnose` | Hard bugs/performance: reproduce -> minimize -> hypothesize -> fix -> test | `oracle`, `builder` |
| `/grill-with-docs` | Grilling session + domain model alignment + ADRs | `planner`, `oracle` |
| `/tdd` | Test-driven development, red-green-refactor loop | `builder` |
| `/triage` | Incoming bugs/features, triage through a state machine | `researcher` |
| `/zoom-out` | High-level code context in system terms | `scout` |
| `/extract` | Identify reusable components, design tokens, patterns | `scout` |
| `/improve-codebase-architecture` | Refactoring opportunities, consolidation, decoupling, testability | `plan-reviewer` |
| `/distill` | Strip to essence, distill complex information | `oracle`, `plan-reviewer` |
| `/audit` | Comprehensive quality review, accessibility, performance, security | `reviewer`, `red-team` |
| `/polish` | Final quality pass, alignment, spacing, consistency | `reviewer` |
| `/optimize` | Performance improvements, loading, rendering, animations | `reviewer` |
| `/onboard` | Design onboarding flows and first-time user experiences | `documenter` |
| `/adapt` | Adapt designs across different screen sizes and contexts | `documenter` |
| `/humanizer` | Remove AI writing patterns and make text natural | `documenter` |
| `/bolder` | Amplify safe designs to make them more visually interesting | `documenter` |
| `/harden` | Improve interface resilience, error handling, i18n, edge cases | `red-team` |
| `/prototype` | Throwaway prototype for design exploration | before committing |
| `/to-issues` | Break plan into independently-grabbable issues | `planner` |
| `/to-prd` | Convert feature request into PRD | after `/grill-me` |

### Productivity Skills

| Skill | Purpose |
|---|---|
| `/grill-me` | Get interviewed on a plan/design |
| `/handoff` | Compact conversation for agent handoff |
| `/write-a-skill` | Create new skills |

(`/caveman` is now `pi-caveman`, a separate pi extension; see that section above.)

### Skill-Workflow Mapping

| Phase | Skills to invoke |
|---|---|
| **Clarify** | `/grill-me` or `/grill-with-docs` -> shared language, ADRs |
| **Scout** | `/zoom-out` for system-level context |
| **Research** | `/triage` for issues; `researcher` subagent for evidence |
| **Plan** | `/grill-with-docs` check; `/to-issues` to break into tickets |
| **Implement** | `/tdd` for features; `/diagnose` for bugs |
| **Review** | Parallel fresh-context `reviewer` subagents |
| **Refactor** | `/improve-codebase-architecture` periodic audits |
| **Prototype** | `/prototype` for design exploration |

---

## Archon Workflows

[Archon](https://github.com/coleam00/Archon) workflows configured to use **Pi** as provider.

| Workflow | Purpose |
|---|---|
| `archon-assist` | General Q&A, debugging, exploration |
| `archon-fix-github-issue` | Issue -> implement -> validate -> PR -> review |
| `archon-idea-to-pr` | Feature -> plan -> implement -> validate -> PR |
| `archon-plan-to-pr` | Execute existing plan -> implement -> validate -> PR |
| `archon-refactor-safely` | Safe refactoring with type-check hooks |
| `archon-smart-pr-review` | Targeted PR review |
| `maintainer-standup-minimax` | Daily PR/issue triage |
| `repo-triage-minimax` | Repository triage |

**Setup:**
```bash
brew install coleam00/archon/archon
# Create ~/.archon/config.yaml with defaultAssistant: pi
archon serve
```

---

## Security (Recommended)

### [nono](https://nono.sh) - Kernel-level sandbox for pi

nono wraps pi in an OS-level sandbox, restricting filesystem and network access to only what the agent needs. Prevents accidental or malicious access to `~/.ssh`, `~/.aws`, and shell configs.

**What it protects against:**
- Credential exfiltration via compromised prompts or dependencies
- Unintended writes to system or config files
- Runaway agents modifying files outside the working directory

**Setup:**
```bash
brew install nono
echo "alias pi='nono run --profile pi --allow-cwd -- pi'" >> ~/.zshrc
source ~/.zshrc
```

**Pre-authorized:**
- Current working directory (read+write)
- `~/.pi` and subdirectories
- Agent skills and extensions
- `/tmp`
- `localhost:3002` (Firecrawl MCP)

**Blocked by default:** `~/.ssh`, `~/.aws`, `~/.gcloud`, `~/.gnupg`, `~/.zshrc`, `~/.bashrc`, browser data, keychain databases.

---

## Prerequisites

| Dependency | Purpose | Install |
|---|---|---|
| **nono** | Kernel-level sandbox | `brew install nono` |
| **pi-coding-agent** | The pi coding agent | [earendil-works/pi-coding-agent](https://github.com/earendil-works/pi-coding-agent) |
| **pi-mcp-adapter** | MCP server integration | `pi install npm:pi-mcp-adapter` |
| **rtk** | Compact shell commands | `brew install rtk` |
| **tmux** | Multiplexer for pi-interactive-subagents | `brew install tmux` |
| **worktrunk** | Per-worktree isolation for parallel subagents | `brew install worktrunk && wt config shell install` |
| **Matt Pocock Skills** | Engineering best practices | `npx skills@latest add mattpocock/skills` |
| **Firecrawl** (optional) | Web scraping | `docker compose up -d` in firecrawl repo |
| **Archon** (optional) | Workflow engine | `brew install coleam00/archon/archon` |

### Quick Install

```bash
# 1. Install nono (recommended)
brew install nono
echo "alias pi='nono run --profile pi --allow-cwd -- pi'" >> ~/.zshrc
source ~/.zshrc

# 2. Install pi (follow pi-coding-agent docs)

# 3. Install core packages
pi install npm:pi-mcp-adapter
pi install npm:pi-rtk-optimizer
pi install npm:pi-web-access
pi install npm:pi-observational-memory
pi install git:github.com/HazAT/pi-interactive-subagents
pi install git:github.com/DietrichGebert/ponytail
pi install git:github.com/jonjonrankin/pi-caveman@v1.0.7

# 4. Install rtk, tmux, worktrunk
brew install rtk tmux worktrunk
wt config shell install

# 5. Install Matt Pocock Skills
npx skills@latest add mattpocock/skills

# 6. (Optional) Start Firecrawl
git clone https://github.com/mendableai/firecrawl.git ~/Developer/firecrawl
cd ~/Developer/firecrawl && docker compose up -d

# 7. (Optional) Install Archon
brew install coleam00/archon/archon
```

---

## Environment Variables

```bash
export CONTEXT7_API_KEY="ctx7sk-..."
# Firecrawl runs locally, no API key needed
export PONYTAIL_DEFAULT_MODE=ultra       # optional, persists in ~/.config/ponytail/config.json
export PI_OBSERVATIONAL_MEMORY_PASSIVE=1 # optional, disable auto-observation
export PI_SUBAGENT_MUX=tmux              # optional, force a multiplexer backend
```

Reload: `source ~/.zshrc`

---

## Quick Reference

| Situation | Action |
|---|---|
| Understand unfamiliar code | `subagent scout "Map X"` |
| Need external evidence | `subagent researcher "Research X"` |
| Hard decision before acting | `subagent oracle "Advise on X"` |
| Complex work ahead | `/grill-with-docs` first, then `subagent planner` |
| Implement feature | `subagent builder` (after plan approved) |
| After implementation | Parallel `subagent reviewer` (fresh context) |
| Bug investigation | `/diagnose` or `subagent oracle` |
| New feature idea | `/grill-me` -> `/to-prd` |
| Breaking down a plan | `/to-issues` |
| Periodic codebase health | `/improve-codebase-architecture` |
| Design exploration | `/prototype` |
| Ultra-compact comms | `/caveman` (already on ultra) |
| Lazy/lean output | ponytail (already on ultra) |
| Toggle status line | `/composed-footer` |
| Parallel agents in isolation | `wt switch -x pi -c <branch> -- '<task>'` |

---

## Known Drift

These items are known stale and tracked for future cleanup, not auto-fixed.

- **Persona frontmatter** in some `agent/agents/*.md` lists tools that are not currently registered: `intercom` (the `npm:pi-intercom` package was uninstalled; the `comms` tool is gone but the frontmatter lines remain), `context7_search_docs` (not in the actual context7 extension), `deepwiki_search` and `deepwiki_ask` (not in the actual deepwiki extension; the real tool is `deepwiki_ask_question`), `code_search` (not in the actual `pi-web-access`; the real tools are `web_search`, `fetch_content`, `get_search_content`). These lines are inert (no matching tool to resolve to) but confusing to readers.
- **Dormant extensions:** `agent/extensions/coms.ts` (50K, claims Phases A/B/C, not in `settings.json` packages) and the runtime dirs `agent/extensions/pi-rtk-optimizer/` and `agent/extensions/supacode/` (dead clones of the live npm-installed packages). Per prior user decision, left on disk, not deleted, not documented in the intro.
- **Dormant docs:** none at present; `agent/docs/intercom.md` was deleted in a recent commit because `npm:pi-intercom` is uninstalled.
- **Stale justfile:** `justfile` has ~12 stale recipes (ext-pure-focus, ext-agent-team, ext-pi-pi, ext-agent-chain, coms*). Per prior user decision, left as-is.
- **Demo image** (`demo/demo.png`): last updated when the splash extension was added. May not match the current composed-footer statusline.

---

## Credits

- [nono](https://nono.sh) by always-further
- [just](https://github.com/casey/just) by @casey
- [pi-coding-agent](https://github.com/earendil-works/pi-coding-agent) by @earendil-works
- [pi-interactive-subagents](https://github.com/HazAT/pi-interactive-subagents) by HazAT
- [pi-observational-memory](https://github.com/elpapi42/pi-observational-memory) by elpapi42
- [ponytail](https://github.com/DietrichGebert/ponytail) by DietrichGebert
- [pi-caveman](https://github.com/jonjonrankin/pi-caveman) by jonjonrankin
- [pi-rtk-optimizer](https://github.com/MasuRii/pi-rtk-optimizer) by @MasuRii
- [pi-web-access](https://github.com/nicobailon/pi-web-access) by nicobailon
- [pi-mcp-adapter](https://pi.dev/packages/pi-mcp-adapter) by nicobailon
- [Matt Pocock Skills](https://github.com/mattpocock/skills) by @mattpocock
- [Archon](https://github.com/coleam00/Archon) by @coleam00
- [Firecrawl](https://github.com/mendableai/firecrawl) by @mendableai
- [Context7](https://context7.com) by Context7
- [DeepWiki](https://deepwiki.com) by DeepWiki
- [Playwright](https://playwright.dev) by Microsoft
- [Worktrunk](https://github.com/max-sixty/worktrunk) by max-sixty
- [disler/pi-vs-claude-code](https://github.com/disler/pi-vs-claude-code) - source for theme-cycler, themeMap
