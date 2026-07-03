# Pi Config

Personal Pi coding agent setup: multiplexer-pane subagent orchestration, long-session memory, custom agents, Matt Pocock skills, and MCP integrations.

![demo](./demo/demo.png)

## What's Included

```
~/.pi/
├── agent/
│   ├── agents/              # Subagent personas (scout, researcher, planner, etc.)
│   ├── art/                 # UI art for splash
│   ├── extensions/          # Local extensions (theme-cycler, context7, deepwiki, splash)
│   ├── skills/              # Agent skills
│   ├── themes/              # UI themes
│   ├── git/                 # Git-installed packages (pi-interactive-subagents, ponytail)
│   ├── npm/                 # npm-installed packages (pi-observational-memory, pi-rtk-optimizer, etc.)
│   ├── AGENTS.md            # Global orchestration instructions
│   └── settings.json        # Configuration
├── README.md
└── justfile
```

## Installed Packages

| Source | Package | Purpose |
|--------|---------|---------|
| git    | [HazAT/pi-interactive-subagents](https://github.com/HazAT/pi-interactive-subagents) | Multiplexer-pane subagent orchestrator |
| git    | [DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail) | Lazy/lean dev persona mode |
| npm    | [pi-observational-memory](https://github.com/elpapi42/pi-observational-memory) v3.0.2 | Long-session observation/compaction memory |
| npm    | [pi-rtk-optimizer](https://github.com/MasuRii/pi-rtk-optimizer) | Auto-rewrites bash to compact rtk equivalents |
| npm    | pi-mcp-adapter | MCP server integration |
| npm    | pi-web-access | Code examples, docs, API references |
| local  | theme-cycler, context7, deepwiki, splash | UI + research utilities |

Run `pi list` for the live view.

---

## Custom Agents

Subagent personas in `~/.pi/agent/agents/`. Invoked via `subagent({ agent: "scout", ... })`.

| Agent               | Purpose                                                                    | Context |
| ------------------- | -------------------------------------------------------------------------- | ------- |
| **scout**           | Fast codebase recon — maps entry points, types, data flow, risks           | fresh   |
| **researcher**      | Web/docs research — searches, fetches, synthesizes evidence                | fresh   |
| **planner**         | Turns requirements into implementation plans                               | fork    |
| **builder**         | Implementation with `/tdd` and `/diagnose` (auto-reads `context.md`, `plan.md`) | fork    |
| **reviewer**        | Code review — correctness, tests, simplicity (fresh context)               | fresh   |
| **oracle**          | Advisory — challenges assumptions, no edits                                | fork    |
| **context-builder** | Strong handoff pass — gathers context + meta-prompt                        | fresh   |
| **delegate**        | Lightweight generic delegate with parent-like behavior                     | fork    |
| **documenter**      | Documentation and README generation                                        | fork    |
| **red-team**        | Security and adversarial testing                                           | fork    |
| **plan-reviewer**   | Plan critic — reviews and validates implementation plans                   | fork    |

### Core Orchestration Pattern

```
clarify → scout/research → planner → builder → parallel reviewers → builder fix → validate
```

### Scout

Fast codebase recon that returns compressed context for handoff.

**Tools:** `read`, `grep`, `find`, `ls`, `bash`, `write`, `intercom`, `context7_query_docs`

**Skills (mandatory):** `/zoom-out` for system-level context mapping

**Optional skills:** `/extract` to identify reusable components and design tokens

```typescript
subagent({ agent: "scout", task: "Map the auth flow" });
```

### Researcher

Autonomous web researcher with access to web scraping and documentation tools.

**Tools:**

- `firecrawl_scrape`, `firecrawl_map`, `firecrawl_search`, `firecrawl_crawl` (via pi-web-access)
- `web_search`, `fetch_content`, `get_search_content`, `code_search` (via pi-web-access)
- `context7_resolve_library_id`, `context7_query_docs` (Context7 extension)
- `deepwiki_read_wiki_structure`, `deepwiki_read_wiki_contents`, `deepwiki_ask_question` (DeepWiki extension)
- `playwright_navigate`, `playwright_screenshot`, `playwright_click`, `playwright_fill`, `playwright_evaluate` (Playwright MCP)

```typescript
subagent({
  agent: "researcher",
  task: "Research React Server Components best practices",
});
```

### Planner

Creates implementation plans from context and requirements.

**Tools:** `read`, `grep`, `find`, `ls`, `write`, `context7_*`, `deepwiki_*`, `firecrawl_scrape`, `firecrawl_search`, `firecrawl_crawl`

**Skills (mandatory):**

- `/grill-with-docs` to challenge plan against domain model
- `/to-issues` to break plan into independently-grabbable tickets

```typescript
subagent({
  chain: [
    { agent: "scout", task: "Map the auth flow" },
    { agent: "planner", task: "Plan from {previous}" },
    { agent: "builder", task: "Implement approved plan" },
  ],
});
```

### Builder

Implementation agent with mandatory Matt Pocock skill usage.

**Tools:** `read`, `write`, `edit`, `bash`, `grep`, `find`, `ls`, `contact_supervisor`, `context7_query_docs`, `context7_search_docs`

**Skills (mandatory):**

- `/tdd` for new features (red-green-refactor loop)
- `/diagnose` for bug fixes (reproduce → minimize → hypothesize → fix → test)

**Context:** Auto-reads `context.md`, `plan.md` on spawn

```typescript
subagent({ agent: "builder", task: "Implement the auth middleware" });
```

### Reviewer

Code review with distinct angles from fresh context (no parent history).

**Tools:** `read`, `bash`, `grep`, `find`, `ls`, `write`, `contact_supervisor`, `playwright_navigate`, `playwright_screenshot`, `playwright_click`, `playwright_fill`, `context7_query_docs`, `context7_search_docs`

**Skills:** `/audit` (comprehensive quality), `/polish` (final pass), `/optimize` (performance)

```typescript
subagent({
  tasks: [
    { agent: "reviewer", task: "Correctness + regressions", output: false },
    { agent: "reviewer", task: "Tests + validation", output: false },
    { agent: "reviewer", task: "Simplicity + maintainability", output: false },
  ],
  context: "fresh",
});
```

### Oracle

Second opinion before acting. Challenges assumptions, no edits.

**Tools:** `read`, `grep`, `find`, `ls`, `bash`, `write`, `intercom`, `firecrawl_scrape`, `firecrawl_search`, `context7_query_docs`, `context7_search_docs`

**Skills (mandatory):** `/diagnose` for hard bugs

**Optional skills:** `/grill-with-docs` for architectural decisions, `/distill` for distilling complex information

```typescript
subagent({
  agent: "oracle",
  task: "Advise on the database migration approach",
});
```

### Context Builder

Strong setup pass - gathers code context and writes handoff material.

**Tools:** `read`, `grep`, `find`, `ls`, `bash`, `write`, `firecrawl_*`, `web_search`, `context7_*`, `deepwiki_*`, `intercom`, `contact_supervisor`, `playwright_navigate`, `playwright_screenshot`

**Output:** `context.md` + `meta-prompt.md`

```typescript
subagent({
  agent: "context-builder",
  task: "Gather context for the auth module",
});
```

### Delegate

Lightweight generic delegate with parent-like behavior.

**Tools:** `read`, `grep`, `find`, `ls`, `bash`, `write`, `edit`, `intercom`, `context7_query_docs`, `context7_search_docs`

```typescript
subagent({
  agent: "delegate",
  task: "Quick task or hot path",
});
```

### Documenter

Documentation and README generation.

**Tools:** `read`, `write`, `edit`, `grep`, `find`, `ls`, `contact_supervisor`, `firecrawl_scrape`, `firecrawl_search`, `firecrawl_crawl`

**Skills:** `/onboard` (first-time UX), `/adapt` (cross-platform), `/humanizer` (natural writing), `/bolder` (visual amplification)

```typescript
subagent({
  agent: "documenter",
  task: "Write README for the new API",
});
```

### Red Team

Security and adversarial testing.

**Tools:** `read`, `bash`, `grep`, `find`, `ls`, `contact_supervisor`, `playwright_navigate`, `playwright_screenshot`, `playwright_click`, `playwright_fill`, `firecrawl_scrape`, `firecrawl_search`

**Skills:** `/audit` (comprehensive security review), `/harden` (resilience improvement)

```typescript
subagent({
  agent: "red-team",
  task: "Security review for the auth module",
});
```

### Plan Reviewer

Plan critic - reviews, challenges, and validates implementation plans.

**Tools:** `read`, `grep`, `find`, `ls`, `write`, `contact_supervisor`, `context7_query_docs`, `context7_search_docs`, `deepwiki_search`, `deepwiki_ask`

**Skills:** `/improve-codebase-architecture` (refactoring opportunities), `/distill` (strip to essence)

```typescript
subagent({
  agent: "plan-reviewer",
  task: "Review the auth implementation plan",
});
```

---

## pi-interactive-subagents

[HazAT](https://github.com/HazAT/pi-interactive-subagents) — multiplexer-pane subagent orchestrator. Replaces the deleted `subagent-widget`, `agent-team`, and `agent-chain` extensions.

**Backends:** `tmux`, `cmux`, `zellij`, `wezterm` (force via `PI_SUBAGENT_MUX`)

**Bundled agents:** planner (Opus), scout (Haiku), worker (Sonnet), reviewer (Opus), visual-tester (Sonnet)

**Reads custom personas** from `~/.pi/agent/agents/<name>.md`

**Install:**
```bash
pi install git:github.com/HazAT/pi-interactive-subagents
```

**Config:** `config.json` in the extension dir (copy from `config.json.example`).

**Env:**
- `PI_SUBAGENT_MUX=cmux|tmux|zellij|wezterm` — force a backend
- `PI_SUBAGENT_SHELL_READY_DELAY_MS` — default 500

## pi-observational-memory

[elpapi42](https://github.com/elpapi42/pi-observational-memory) v3.0.2 — long-session observation/compaction memory. Auto-observes the session at token thresholds and compacts memory to survive handoffs and long sessions.

**Install:**
```bash
pi install npm:pi-observational-memory
```

**Config:** under `observational-memory.*` in `~/.pi/agent/settings.json` (or `<project>/.pi/settings.json`). Key settings: `observeAfterTokens` (10000), `reflectAfterTokens` (20000), `compactAfterTokens` (81000), `observationsPoolMaxTokens` (20000), `agentMaxTurns` (16), `model.{provider,id,thinking}`.

**V2 → V3:** NOT backward compatible. Rename your settings: `observationThresholdTokens` → `observeAfterTokens`, `compactionThresholdTokens` → `compactAfterTokens`, `reflectionThresholdTokens` → `reflectAfterTokens`, `compactionModel` → `model`, etc. After upgrading, start a new clean pi session.

**Env:** `PI_OBSERVATIONAL_MEMORY_PASSIVE=1` (disable automatic observation)

**Debug log:** `~/.pi/agent/observational-memory/debug/<session-id>.ndjson`

## ponytail

[DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail) — lazy/lean dev persona mode. Forces the shortest working solution, prevents over-engineering, and gates explanations behind explicit requests.

Active by default. Intensity levels: `lite`, `full` (default), `ultra`. Disable with "stop ponytail" / "normal mode".

```
pi install git:github.com/DietrichGebert/ponytail
```

---

## Native Extensions

### theme-cycler.ts

Theme cycling with keyboard shortcuts and command. Migrated from [disler/pi-vs-claude-code](https://github.com/disler/pi-vs-claude-code).

**Shortcuts:**
- `Ctrl+.` — cycle to next theme
- `Ctrl+,` — cycle to previous theme

**Commands:**
- `/theme` — open theme picker
- `/theme <name>` — switch directly (e.g. `/theme synthwave`)

**Features:**
- Status line shows current theme name with 🎨 icon
- Color swatch widget briefly appears after switching
- Default theme: `gruvbox-new`

### themeMap.ts

Per-extension theme assignments. Utility module imported by `theme-cycler.ts`.

### splash.ts

ASCII art splash on session start.

**Features:**
- Two-column layout: logo/tagline (left), stats/shortcuts (right)
- Theme-aware colors with configurable border styles
- Displays: CWD, extensions loaded, skills loaded, tools available
- Auto-dismisses on first user message
- Configurable via `~/.pi/agent/art/splash.json`

### Context7 Extension

Up-to-date library documentation. Interactive command: `/context7`

**Tools:** `context7_resolve_library_id`, `context7_query_docs`, `context7_search_docs`

**Used by:** scout, planner, builder, reviewer, oracle, delegate, plan-reviewer

### DeepWiki Extension

GitHub repository documentation and AI Q&A. Interactive command: `/deepwiki`

**Tools:** `deepwiki_read_wiki_structure`, `deepwiki_read_wiki_contents`, `deepwiki_ask_question`

**Used by:** planner, plan-reviewer

### Playwright MCP

Browser automation for web testing, screenshots, and scraping.

```json
"playwright": {
  "command": "npx",
  "args": ["@playwright/mcp@latest"]
}
```

**Tools:** `playwright_navigate`, `playwright_screenshot`, `playwright_click`, `playwright_fill`, `playwright_evaluate`

**Used by:** reviewer, researcher, red-team, context-builder

### Firecrawl MCP (Local)

Self-hosted web scraping at `http://localhost:3002` via Docker.

**Setup:**

```bash
git clone https://github.com/mendableai/firecrawl.git ~/Developer/firecrawl
cd ~/Developer/firecrawl && docker compose up -d
```

**Tools:** `firecrawl_scrape`, `firecrawl_map`, `firecrawl_search`, `firecrawl_crawl`, `firecrawl_extract`, `firecrawl_agent`

**Used by:** planner, oracle, documenter, red-team

---

## Matt Pocock Skills

High-quality engineering practices for AI coding agents. Installed via:

```bash
npx skills@latest add mattpocock/skills
```

**Skill locations:**

- **Primary source:** `~/.agents/skills/` (40 skills installed via Matt Pocock's installer)
- **Symlinks:** `~/.pi/agent/skills/` (automatically synced from primary)
- **Local skills:** `~/.pi/agent/skills/local/` (custom skills: `bowser`, `graphify`, `supacode-cli`)

Then run `/setup-matt-pocock-skills` to configure per-repo settings.

### Engineering Skills

| Skill                            | When to use                                                             | Best with                 |
| -------------------------------- | ----------------------------------------------------------------------- | ------------------------- |
| `/diagnose`                      | Hard bugs/performance - reproduce → minimize → hypothesize → fix → test | `oracle`, `builder`       |
| `/grill-with-docs`               | Grilling session + domain model alignment + ADRs                        | `planner`, `oracle`       |
| `/tdd`                           | Test-driven development - red-green-refactor loop                       | `builder`                 |
| `/triage`                        | Incoming bugs/features - triage through a state machine                 | `researcher`              |
| `/zoom-out`                      | High-level code context in system terms                                 | `scout`                   |
| `/extract`                       | Identify reusable components, design tokens, patterns                   | `scout`                   |
| `/improve-codebase-architecture` | Refactoring opportunities - consolidation, decoupling, testability      | `plan-reviewer`           |
| `/distill`                       | Strip to essence - distill complex information into essence             | `oracle`, `plan-reviewer` |
| `/audit`                         | Comprehensive quality review - accessibility, performance, security     | `reviewer`, `red-team`    |
| `/polish`                        | Final quality pass - alignment, spacing, consistency, detail            | `reviewer`                |
| `/optimize`                      | Performance improvements - loading speed, rendering, animations         | `reviewer`                |
| `/onboard`                       | Design onboarding flows and first-time user experiences                 | `documenter`              |
| `/adapt`                         | Adapt designs across different screen sizes and contexts                | `documenter`              |
| `/humanizer`                     | Remove AI writing patterns and make text natural                        | `documenter`              |
| `/bolder`                        | Amplify safe designs to make them more visually interesting             | `documenter`              |
| `/harden`                        | Improve interface resilience - error handling, i18n, edge cases         | `red-team`                |
| `/prototype`                     | Throwaway prototype for design exploration                              | before committing         |
| `/to-issues`                     | Break plan into independently-grabbable issues                          | `planner`                 |
| `/to-prd`                        | Convert feature request into PRD                                        | after `/grill-me`         |

### Productivity Skills

| Skill            | Purpose                                            |
| ---------------- | -------------------------------------------------- |
| `/caveman`       | Ultra-compact communication (~75% token reduction) |
| `/grill-me`      | Get interviewed on a plan/design                   |
| `/handoff`       | Compact conversation for agent handoff             |
| `/write-a-skill` | Create new skills                                  |

### Skill-Workflow Mapping

| Phase         | Skills to invoke                                             |
| ------------- | ------------------------------------------------------------ |
| **Clarify**   | `/grill-me` or `/grill-with-docs` → shared language, ADRs    |
| **Scout**     | `/zoom-out` for system-level context                         |
| **Research**  | `/triage` for issues; `researcher` subagent for evidence     |
| **Plan**      | `/grill-with-docs` check; `/to-issues` to break into tickets |
| **Implement** | `/tdd` for features; `/diagnose` for bugs                    |
| **Review**    | Parallel fresh-context `reviewer` subagents                  |
| **Refactor**  | `/improve-codebase-architecture` periodic audits             |
| **Prototype** | `/prototype` for design exploration                          |

---

## Packages

### NPM Packages (via `pi install`)

| Package | Purpose |
| --- | --- |
| `npm:pi-observational-memory` | Long-session observation/compaction memory |
| `npm:pi-rtk-optimizer` | Auto-rewrites bash to compact rtk equivalents |
| `npm:pi-web-access` | Code examples, docs, API references |
| `npm:pi-mcp-adapter` | MCP server integration |

### Git Packages (via `pi install`)

| Package | Purpose |
| --- | --- |
| `git:github.com/HazAT/pi-interactive-subagents` | Subagent orchestrator |
| `git:github.com/DietrichGebert/ponytail` | Lazy dev persona mode |

---

## Archon Workflows

[Archon](https://github.com/coleam00/Archon) workflows configured to use **Pi** as provider.

| Workflow                     | Purpose                                           |
| ---------------------------- | ------------------------------------------------- |
| `archon-assist`              | General Q&A, debugging, exploration               |
| `archon-fix-github-issue`    | Issue → implement → validate → PR → review        |
| `archon-idea-to-pr`          | Feature → plan → implement → validate → PR        |
| `archon-plan-to-pr`          | Execute existing plan → implement → validate → PR |
| `archon-refactor-safely`     | Safe refactoring with type-check hooks            |
| `archon-smart-pr-review`     | Targeted PR review                                |
| `maintainer-standup-minimax` | Daily PR/issue triage                             |
| `repo-triage-minimax`        | Repository triage                                 |

**Setup:**

```bash
brew install coleam00/archon/archon
# Create ~/.archon/config.yaml with defaultAssistant: pi
archon serve
```

---

## Security (Recommended)

### [nono](https://nono.sh) - Kernel-level sandbox for pi

nono wraps pi in an OS-level sandbox, restricting filesystem and network access to only what the agent needs. This prevents accidental or malicious access to sensitive paths like `~/.ssh`, `~/.aws`, and shell configs.

**What it protects against:**

- Credential exfiltration via compromised prompts or dependencies
- Unintended writes to system or config files
- Runaway agents modifying files outside the working directory

**Setup:**

```bash
# Install
brew install nono

# Add to ~/.zshrc - run pi sandboxed by default
alias pi='nono run --profile pi --allow-cwd -- pi'

# Reload
source ~/.zshrc
```

**On first run** in a new directory, nono will ask if you want to share that directory with the sandbox. Accept once and it remembers the decision.

**Pre-authorized access:**

- Current working directory (read+write)
- `~/.pi` and subdirectories
- Agent skills and extensions
- `/tmp` (temp files)
- `localhost:3002` (Firecrawl MCP)

**Blocked by default (no config needed):**

- `~/.ssh`, `~/.aws`, `~/.gcloud`, `~/.gnupg`
- `~/.zshrc`, `~/.bashrc`, `~/.profile`
- Browser data, keychain databases

If pi needs access to an additional directory, nono will prompt you during the session with an option to add it to the profile permanently.

---

## Prerequisites

| Dependency | Purpose | Install |
| --- | --- | --- |
| **nono** | Kernel-level sandbox | `brew install nono` |
| **pi-coding-agent** | The Pi coding agent | [earendil-works/pi-coding-agent](https://github.com/earendil-works/pi-coding-agent) |
| **pi-mcp-adapter** | MCP server integration | `pi install npm:pi-mcp-adapter` |
| **rtk** | Compact shell commands | `brew install rubygem-tk` |
| **tmux** (or cmux/zellij/wezterm) | Multiplexer for pi-interactive-subagents | `brew install tmux` |
| **Matt Pocock Skills** | Engineering best practices | `npx skills@latest add mattpocock/skills` |
| **Firecrawl** (optional) | Web scraping | `docker compose up -d` in firecrawl repo |
| **Archon** (optional) | Workflow engine | `brew install coleam00/archon/archon` |

### Quick Install

```bash
# 1. Install nono (recommended)
brew install nono

# 2. Add sandbox alias to ~/.zshrc
echo "alias pi='nono run --profile pi --allow-cwd -- pi'" >> ~/.zshrc
source ~/.zshrc

# 3. Install pi (follow pi-coding-agent docs)

# 4. Install core packages
pi install npm:pi-mcp-adapter
pi install npm:pi-rtk-optimizer
pi install npm:pi-web-access
pi install npm:pi-observational-memory
pi install git:github.com/HazAT/pi-interactive-subagents
pi install git:github.com/DietrichGebert/ponytail

# 5. Install rtk
brew install rubygem-tk

# 6. Install tmux (for pi-interactive-subagents)
brew install tmux

# 7. Install Matt Pocock Skills
npx skills@latest add mattpocock/skills

# 8. (Optional) Start Firecrawl
git clone https://github.com/mendableai/firecrawl.git ~/Developer/firecrawl
cd ~/Developer/firecrawl && docker compose up -d

# 9. (Optional) Install Archon
brew install coleam00/archon/archon
```

---

## Environment Variables

```bash
export CONTEXT7_API_KEY="ctx7sk-..."
# Firecrawl runs locally, no API key needed
```

Reload: `source ~/.zshrc`

---

## Quick Reference

| Situation | Action |
| --- | --- |
| Understand unfamiliar code | `/run scout "Map X"` |
| Need external evidence | `/run researcher "Research X"` |
| Hard decision before acting | `/run oracle "Advise on X"` |
| Complex work ahead | `/grill-with-docs` first, then `/run planner` |
| Implement feature | `/run builder` (after plan approved) |
| After implementation | Parallel `/run reviewer` (fresh context) |
| Bug investigation | `/diagnose` or `/run oracle` |
| New feature idea | `/grill-me` → `/to-prd` |
| Breaking down a plan | `/to-issues` |
| Periodic codebase health | `/improve-codebase-architecture` |
| Design exploration | `/prototype` |
| Compact mode | `/caveman` |

---

## Credits

- **[nono](https://nono.sh)** by always-further
- [just](https://github.com/casey/just) by @casey
- **[pi-coding-agent](https://github.com/earendil-works/pi-coding-agent)** by @earendil-works
- **[pi-interactive-subagents](https://github.com/HazAT/pi-interactive-subagents)** by HazAT
- **[pi-observational-memory](https://github.com/elpapi42/pi-observational-memory)** by elpapi42
- **[ponytail](https://github.com/DietrichGebert/ponytail)** by DietrichGebert
- **[pi-web-access](https://github.com/nicobailon/pi-web-access)** by nicopreme
- **[Matt Pocock Skills](https://github.com/mattpocock/skills)** by @mattpocock
- **[pi-mcp-adapter](https://pi.dev/packages/pi-mcp-adapter)** by nicopreme
- **[pi-rtk-optimizer](https://github.com/MasuRii/pi-rtk-optimizer)** by @MasuRii
- **[Archon](https://github.com/coleam00/Archon)** by @coleam00
- **[Firecrawl](https://github.com/mendableai/firecrawl)** by @mendableai
- **[Context7](https://context7.com)** by Context7
- **[DeepWiki](https://deepwiki.com)** by DeepWiki
- **[Playwright](https://playwright.dev)** by Microsoft
- [disler/pi-vs-claude-code](https://github.com/disler/pi-vs-claude-code) — Source for theme-cycler, themeMap
