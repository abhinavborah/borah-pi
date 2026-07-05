# Pi Config

Personal pi coding-agent setup. Multiplexer-pane subagents, long-session memory, terseness layers, status line, MCP integrations.

![demo](./demo/demo.png)

## Layout

```
~/.pi/
├── agent/
│   ├── AGENTS.md            # Orchestration instructions (persona + pattern)
│   ├── settings.json        # packages list, model, theme, OM config
│   ├── agents/              # 11 local subagent personas
│   ├── art/                 # ASCII art + splash layout
│   ├── docs/                # Topic docs for AGENTS.md cross-refs (not public)
│   ├── extensions/          # theme-cycler, splash, context7, deepwiki, composed-footer, coms
│   ├── git/                 # Git-installed packages (runtime, gitignored)
│   ├── npm/                 # npm-installed packages (runtime, gitignored)
│   ├── skills/              # Local skills + symlinks to Matt Pocock skills
│   └── themes/              # 13 theme JSONs
├── README.md
└── justfile
```

## Packages

| Source | Package | Version | Purpose |
|---|---|---|---|
| git | [HazAT/pi-interactive-subagents](https://github.com/HazAT/pi-interactive-subagents) | tracking main | Multiplexer-pane subagent orchestrator |
| git | [DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail) | tracking main | Lazy/lean dev persona mode |
| git | [jonjonrankin/pi-caveman](https://github.com/jonjonrankin/pi-caveman) | v1.0.7 | Ultra-compact comms + animated status bar |
| npm | [pi-observational-memory](https://github.com/elpapi42/pi-observational-memory) | v3.0.2 | Long-session observation + compaction |
| npm | [pi-rtk-optimizer](https://github.com/MasuRii/pi-rtk-optimizer) | latest | Auto-rewrites bash to rtk equivalents |
| npm | pi-mcp-adapter | latest | MCP server integration |
| npm | [pi-web-access](https://github.com/nicobailon/pi-web-access) | latest | web_search, fetch_content, get_search_content |
| local | `extensions/theme-cycler.ts` | tracked | Theme cycling (Ctrl+. / Ctrl+,) |
| local | `extensions/splash.ts` | tracked | ASCII art splash on session start |
| local | `extensions/context7.ts` | tracked | Up-to-date library docs |
| local | `extensions/deepwiki.ts` | tracked | GitHub repo docs + Q&A |
| local | `extensions/composed-footer.ts` | tracked | Claude-style statusline |
| local | `extensions/coms.ts` | tracked | Peer-to-peer messaging between local pi agents |

## Personas

Local personas in `agent/agents/`. Invoked via `subagent({ agent: "<name>", ... })`. Inherit orchestrator model unless overridden.

| Agent | Purpose | Context | Model |
|---|---|---|---|
| scout | Fast codebase recon, entry points, types, data flow, risks | fresh | inherits |
| researcher | Web/docs research, search, fetch, synthesize | fresh | inherits |
| planner | Turn requirements into implementation plans | fork | inherits |
| builder | Implementation with /tdd and /diagnose | fork | inherits |
| reviewer | Code review, correctness, tests, simplicity | fresh | inherits |
| oracle | Advisory, challenges assumptions, no edits | fork | inherits |
| context-builder | Strong handoff pass, gathers context + meta-prompt | fresh | inherits |
| documenter | Documentation and README generation | fork | inherits |
| red-team | Security and adversarial testing | fork | inherits |
| plan-reviewer | Plan critic, reviews and validates plans | fork | inherits |
| bowser | Headless browser automation via Playwright CLI | fork | inherits |

Persona resolution: local `agent/agents/<name>.md` wins over bundled `<name>.md` on name collision. Bundle-only names fall through. Tools, thinking, body from the winner.

### Invocation patterns

```typescript
// Single subagent
subagent({ agent: "scout", task: "Map the auth flow" });

// Parallel reviewers with distinct angles
subagent({
  tasks: [
    { agent: "reviewer", task: "Correctness + regressions", output: false },
    { agent: "reviewer", task: "Tests + validation", output: false },
    { agent: "reviewer", task: "Simplicity + maintainability", output: false },
  ],
  context: "fresh",
});
```

### Orchestration pattern

```
clarify -> scout/research -> planner -> builder -> parallel fresh reviewers -> builder fix -> validate
```

One writer thread. `builder` implements, `reviewer` never silently edits. Fork for advisory threads. Fresh context for adversarial reviewers.

## pi-interactive-subagents

[HazAT/pi-interactive-subagents](https://github.com/HazAT/pi-interactive-subagents) spawns subagents in tmux split panes. Replaces the older `subagent-widget`, `agent-team`, and `agent-chain` extensions.

**Backends:** tmux, cmux, zellij, wezterm. Only tmux installed. Force with `PI_SUBAGENT_MUX=<backend>`.

**Bundled agents (6):** planner, scout, worker, reviewer, visual-tester, claude-code. Hardcoded `anthropic/...` model IDs in the bundled personas resolve to `amazon-bedrock` in this env (no AWS creds); `model:` lines were removed in-place. The local patch is in a gitignored runtime dir.

**Env:**
- `PI_SUBAGENT_MUX=cmux|tmux|zellij|wezterm` - force backend
- `PI_SUBAGENT_SHELL_READY_DELAY_MS` - default 500

### Parallel isolation via worktrunk

`pi-interactive-subagents` does not provide per-subagent worktree isolation. For parallel file-editing subagents, run each in its own worktree via worktrunk:

```bash
brew install worktrunk
wt config shell install    # required for `wt switch` to actually cd

# Single agent
wt switch --create feat/auth -b main
# ... edit, commit, merge, remove ...

# Parallel agents (one worktree per subagent)
wt switch -x pi -c feat/agent-1 -- 'task for agent 1' &
wt switch -x pi -c feat/agent-2 -- 'task for agent 2' &
wt switch -x pi -c feat/agent-3 -- 'task for agent 3' &
wait
```

`-x` runs a command after switching and replaces `wt` with that command. Arguments after `--` become the agent's prompt. The repo must be worktrunk-managed (`wt init` once in the repo root).

## pi-observational-memory

[elpapi42/pi-observational-memory](https://github.com/elpapi42/pi-observational-memory) v3.0.2. Long-session observation + compaction. Auto-observes at token thresholds.

**Install:** `pi install npm:pi-observational-memory`

**Config:** `observational-memory.*` keys in `agent/settings.json`. Key settings: `observeAfterTokens` (10000), `reflectAfterTokens` (20000), `compactAfterTokens` (81000), `observationsPoolMaxTokens` (20000), `agentMaxTurns` (16), `model.{provider,id,thinking}`.

**v2 -> v3:** not backward compatible. Rename `observationThresholdTokens` -> `observeAfterTokens`, `compactionThresholdTokens` -> `compactAfterTokens`, `reflectionThresholdTokens` -> `reflectAfterTokens`, `compactionModel` -> `model`. After upgrade, start a new clean pi session.

**Env:** `PI_OBSERVATIONAL_MEMORY_PASSIVE=1` disable auto-observation. Debug log: `agent/observational-memory/debug/<session-id>.ndjson`.

## ponytail

[DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail). Lazy/lean dev persona mode. Forces shortest working solution, prevents over-engineering, gates explanations behind explicit requests.

Active by default. Levels: `lite`, `full` (default), `ultra`. Disable with "stop ponytail" or "normal mode".

This repo pins ultra: `~/.config/ponytail/config.json` -> `defaultMode: ultra`, or `PONYTAIL_DEFAULT_MODE=ultra` env var.

OpenCode plugin with a small pi-extension adapter that registers a `setStatus("ponytail", ...)` key for the composed footer.

## pi-caveman

[jonjonrankin/pi-caveman](https://github.com/jonjonrankin/pi-caveman) v1.0.7. Ultra-compact communication layer. Drops articles, filler, pleasantries, hedging; keeps technical substance.

Levels: `lite`, `full`, `ultra`, `wenyan-*`, `micro`.

This repo pins ultra: `agent/caveman.json` -> `defaultLevel: "ultra"`, `showStatus: true`.

Registers `setStatus("caveman", ...)` with an animated 8-frame colored campfire in the status bar (100ms tick on ultra). The default is cached at `session_start`; if a milder level shows after editing `caveman.json`, call `/caveman ultra` or restart the session.

Ponytail and caveman both pinned to ultra. Mild overlap (both demand terseness), different layers (ponytail rewrites output, caveman rewrites system prompt). Combined cost is a few hundred input tokens per turn; combined savings are larger.

Both hook `before_agent_start`; pi-observational-memory also does. Order not guaranteed.

Auto-clarity: drops caveman for security warnings, irreversible action confirmations, confused-user moments. Resumes after.

## Composed Footer (`extensions/composed-footer.ts`)

Replaces pi's default footer with a Claude-style single-line statusline:

```
[agent-id] [theme] [mcp] [rtk] [ponytail] [caveman] [om] [team]   ...padded...   <cwd> | <branch> | <model> | <ctx%> | <tokens>
```

Optional second line: per-tool invocation counts and `mcp:N(servers)` when any tool was called.

**Segments:**

| Key | Source | Content |
|---|---|---|
| agent-id | self-registered | `agent:<8hex>` from session id |
| theme | theme-cycler | current theme name |
| mcp | self-registered | `mcp:<N>` unique servers from `__`-prefixed tool names |
| rtk | pi-rtk-optimizer | savings percent, updated in agent_end |
| ponytail | ponytail | current level |
| caveman | pi-caveman | current level + animated campfire on ultra |
| om | pi-observational-memory | state badge |
| team | self-registered | `team:on` or `team:off` from `~/.pi/agent/team.json` (see /team command) |
| cwd | self | abbreviated home (p10k blue 31) |
| branch | self + footerData | git branch (green 76), with tree marker prefix (yellow 178) when cwd is in a non-first block of `git worktree list --porcelain` |
| model | self | model id (dim 244) |
| ctx% | self | `100 - latest AssistantMessage.usage.input / ctx.model.contextWindow * 100`; green >= 40, yellow 20-40, red < 20 |
| tokens | self | cumulative `^input voutput $cost` for current branch |

Worktree marker cached, invalidated on `footerData.onBranchChange`. Toggles: `/composed-footer`, `/team [on|off]`.

### Team mode (subagent spawn policy)

The `team` badge shows whether subagent spawning is allowed. State is persisted in `~/.pi/agent/team.json` (gitignored via `agent/*.json`).

| Command | Effect |
|---|---|
| `/team` | report current state |
| `/team on` | enable subagent spawning; writes `{ "enabled": true }` to `team.json` |
| `/team off` | disable subagent spawning; writes `{ "enabled": false }` to `team.json` |
| `/team foo` | show usage warning |

Default: `on` (file missing or malformed). When `off`, a system-prompt rule is injected on every turn that blocks all `subagent()` calls, including explicit user spawns. The badge update is the visibility half; the system-prompt is the enforcement half.

## Native Extensions

| File | Purpose | Tools / Commands |
|---|---|---|
| `theme-cycler.ts` | Theme cycling | Ctrl+. / Ctrl+,, `/theme`, `/theme <name>` |
| `splash.ts` | ASCII art splash | auto on session start, dismisses on first user message |
| `context7.ts` | Library docs | `context7_resolve_library_id`, `context7_query_docs`, `/context7` |
| `deepwiki.ts` | GitHub repo docs + Q&A | `deepwiki_read_wiki_structure`, `deepwiki_read_wiki_contents`, `deepwiki_ask_question`, `/deepwiki` |
| `composed-footer.ts` | Statusline | `/composed-footer`, `/team [on|off]` |
| `coms.ts` | Peer-to-peer agent messaging | `coms_list`, `coms_send`, `coms_get`, `coms_await`, `/coms` |
| `themeMap.ts` | Helper (imported, not loaded standalone) | theme + title defaults for stacked extensions |
| `mcp-http.ts` | Helper (imported, not loaded standalone) | shared MCP JSON-RPC client for context7/deepwiki |

## MCP Servers

### Playwright

```json
"playwright": {
  "command": "npx",
  "args": ["@playwright/mcp@latest"]
}
```

Tools: `playwright_navigate`, `playwright_screenshot`, `playwright_click`, `playwright_fill`, `playwright_evaluate`.

### Firecrawl (local)

Self-hosted at `http://localhost:3002` via Docker.

```bash
git clone https://github.com/mendableai/firecrawl.git ~/Developer/firecrawl
cd ~/Developer/firecrawl && docker compose up -d
```

Tools: `firecrawl_scrape`, `firecrawl_map`, `firecrawl_search`, `firecrawl_crawl`, `firecrawl_extract`, `firecrawl_agent`.

## Matt Pocock Skills

```bash
npx skills@latest add mattpocock/skills
```

- Primary: `~/.agents/skills/` (48 skills)
- Symlinks: `agent/skills/`
- Local: `agent/skills/local/` (bowser, graphify, supacode-cli)

### Engineering Skills

| Skill | When | Best with |
|---|---|---|
| `/diagnose` | Hard bugs/performance | oracle, builder |
| `/grill-with-docs` | Plan + domain model + ADRs | planner, oracle |
| `/tdd` | New features | builder |
| `/triage` | Incoming bugs/features | researcher |
| `/zoom-out` | High-level context | scout |
| `/extract` | Reusable components/tokens | scout |
| `/improve-codebase-architecture` | Refactoring opportunities | plan-reviewer |
| `/distill` | Strip to essence | oracle, plan-reviewer |
| `/audit` | Comprehensive quality | reviewer, red-team |
| `/polish` | Final pass | reviewer |
| `/optimize` | Performance | reviewer |
| `/onboard` | First-time UX | documenter |
| `/adapt` | Cross-platform | documenter |
| `/humanizer` | Natural writing | documenter |
| `/bolder` | Visual amplification | documenter |
| `/harden` | Resilience, error handling, i18n | red-team |
| `/prototype` | Design exploration | before committing |
| `/to-issues` | Break plan into tickets | planner |
| `/to-prd` | Feature to PRD | after /grill-me |

### Productivity Skills

| Skill | Purpose |
|---|---|
| `/grill-me` | Interviewed on a plan/design |
| `/handoff` | Compact conversation for handoff |
| `/write-a-skill` | Create new skills |

### Skill-Workflow Mapping

| Phase | Skills |
|---|---|
| Clarify | /grill-me, /grill-with-docs |
| Scout | /zoom-out |
| Research | /triage, researcher subagent |
| Plan | /grill-with-docs, /to-issues |
| Implement | /tdd, /diagnose |
| Review | Parallel reviewer subagents |
| Refactor | /improve-codebase-architecture |
| Prototype | /prototype |

## Archon Workflows

[Archon](https://github.com/coleam00/Archon) workflows with pi as provider: archon-assist, archon-fix-github-issue, archon-idea-to-pr, archon-plan-to-pr, archon-refactor-safely, archon-smart-pr-review, maintainer-standup-minimax, repo-triage-minimax.

```bash
brew install coleam00/archon/archon
archon serve
```

## Security (nono)

[nono](https://nono.sh) kernel-level sandbox for pi.

```bash
brew install nono
echo "alias pi='nono run --profile pi --allow-cwd -- pi'" >> ~/.zshrc
source ~/.zshrc
```

Pre-authorized: cwd, ~/.pi, agent skills and extensions, /tmp, localhost:3002 (Firecrawl). Blocked by default: ~/.ssh, ~/.aws, ~/.gcloud, ~/.gnupg, ~/.zshrc, ~/.bashrc, browser data, keychain.

## Prerequisites

| Dependency | Purpose | Install |
|---|---|---|
| nono | Kernel-level sandbox | `brew install nono` |
| pi-coding-agent | The pi coding agent | [earendil-works/pi-coding-agent](https://github.com/earendil-works/pi-coding-agent) |
| pi-mcp-adapter | MCP server integration | `pi install npm:pi-mcp-adapter` |
| rtk | Compact shell commands | `brew install rtk` |
| tmux | Multiplexer for subagents | `brew install tmux` |
| worktrunk | Per-worktree isolation for parallel subagents | `brew install worktrunk && wt config shell install` |
| Matt Pocock Skills | Engineering best practices | `npx skills@latest add mattpocock/skills` |
| Firecrawl (optional) | Web scraping | `docker compose up -d` in firecrawl repo |
| Archon (optional) | Workflow engine | `brew install coleam00/archon/archon` |

### Quick Install

```bash
brew install nono rtk tmux worktrunk
wt config shell install
echo "alias pi='nono run --profile pi --allow-cwd -- pi'" >> ~/.zshrc
source ~/.zshrc

pi install npm:pi-mcp-adapter
pi install npm:pi-rtk-optimizer
pi install npm:pi-web-access
pi install npm:pi-observational-memory
pi install git:github.com/HazAT/pi-interactive-subagents
pi install git:github.com/DietrichGebert/ponytail
pi install git:github.com/jonjonrankin/pi-caveman@v1.0.7

npx skills@latest add mattpocock/skills
```

## Environment Variables

```bash
export CONTEXT7_API_KEY="ctx7sk-..."
# Firecrawl runs locally, no API key needed
export PONYTAIL_DEFAULT_MODE=ultra
export PI_OBSERVATIONAL_MEMORY_PASSIVE=1
export PI_SUBAGENT_MUX=tmux
```

## Quick Reference

| Situation | Action |
|---|---|
| Understand unfamiliar code | subagent scout |
| Need external evidence | subagent researcher |
| Hard decision before acting | subagent oracle |
| Complex work ahead | /grill-with-docs, then subagent planner |
| Implement feature | subagent builder |
| After implementation | Parallel subagent reviewer (fresh context) |
| Bug investigation | /diagnose or subagent oracle |
| New feature idea | /grill-me -> /to-prd |
| Breaking down a plan | /to-issues |
| Periodic codebase health | /improve-codebase-architecture |
| Design exploration | /prototype |
| Ultra-compact comms | /caveman (already on ultra) |
| Lazy/lean output | ponytail (already on ultra) |
| Toggle status line | /composed-footer |
| Toggle subagent spawning | /team [on\|off] (persists to `~/.pi/agent/team.json`) |
| Parallel agents in isolation | `wt switch -x pi -c <branch> -- '<task>'` |

## Credits

nono, just, pi-coding-agent, pi-interactive-subagents, pi-observational-memory, ponytail, pi-caveman, pi-rtk-optimizer, pi-web-access, pi-mcp-adapter, Matt Pocock Skills, Archon, Firecrawl, Context7, DeepWiki, Playwright, Worktrunk, disler/pi-vs-claude-code.
