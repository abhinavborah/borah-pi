# Pi Config

My personal Pi coding agent setup: built on [pi-subagents](https://pi.dev/packages/pi-subagents) with custom agents, Matt Pocock skills, and MCP integrations.

## What's Included

```
~/.pi/
├── agent/
│   ├── agents/              # Custom agents (scout, researcher, planner, etc.)
│   ├── extensions/          # UI extensions
│   ├── skills/              # Matt Pocock skills
│   ├── intercom/            # Inter-session messaging
│   ├── AGENTS.md            # Global orchestration instructions
│   └── settings.json         # Configuration
├── mcp.json                 # MCP server configurations
└── README.md
```

---

## Custom Agents (pi-subagents)

Built on [pi-subagents](https://pi.dev/packages/pi-subagents) with Matt Pocock skills and MCP integrations. Each agent is defined in `~/.pi/agent/agents/` and invoked via `/run`, `/chain`, or `/parallel`.

### Available Agents

| Agent               | Purpose                                                          | Context |
| ------------------- | ---------------------------------------------------------------- | ------- |
| **scout**           | Fast codebase recon — maps entry points, types, data flow, risks | fresh   |
| **researcher**      | Web/docs research — searches, fetches, synthesizes evidence      | fresh   |
| **planner**         | Turns requirements into implementation plans                     | fork    |
| **worker**          | Implementation — edits files, validates, escalates               | fork    |
| **reviewer**        | Code review — correctness, tests, simplicity (fresh context)     | fresh   |
| **oracle**          | Advisory — challenges assumptions, no edits                      | fork    |
| **context-builder** | Strong handoff pass — gathers context + meta-prompt              | fresh   |
| **delegate**        | Lightweight generic delegate with parent-like behavior           | fork    |

### Core Orchestration Pattern

```
clarify → scout/research → planner → worker → parallel reviewers → worker fix → validate
```

### Scout

Fast codebase recon that returns compressed context for handoff.

```typescript
subagent({ agent: "scout", task: "Map the auth flow" });
```

Uses `/zoom-out` skill for system-level context mapping.

### Researcher

Autonomous web researcher with access to MCP tools.

**MCP tools available:**

- `firecrawl_scrape`, `firecrawl_map`, `firecrawl_search`, `firecrawl_crawl`
- `web_search`, `fetch_content`, `get_search_content`
- `code_search`
- `mcp__context7__*`, `mcp__deepwiki__*`

```typescript
subagent({
  agent: "researcher",
  task: "Research React Server Components best practices",
});
```

### Planner

Creates implementation plans from context and requirements.

**Mandatory skill usage:**

- `/grill-with-docs` to challenge plan against domain model
- `/to-issues` to break plan into independently-grabbable tickets

```typescript
subagent({
  chain: [
    { agent: "scout", task: "Map the auth flow" },
    { agent: "planner", task: "Plan from {previous}" },
    { agent: "worker", task: "Implement approved plan" },
  ],
});
```

### Worker

Implementation agent with mandatory Matt Pocock skill usage.

**Mandatory skills:**

- `/tdd` for new features (red-green-refactor loop)
- `/diagnose` for bug fixes (reproduce → minimize → hypothesize → fix → test)

```typescript
subagent({ agent: "worker", task: "Implement the auth middleware" });
```

### Reviewer

Code review with distinct angles from fresh context (no parent history).

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

```typescript
subagent({
  agent: "oracle",
  task: "Advise on the database migration approach",
});
```

Uses `/diagnose` for hard bugs, `/grill-with-docs` for architectural decisions.

---

## MCP Servers

Configured via `~/.pi/mcp.json` using [pi-mcp-adapter](https://pi.dev/packages/pi-mcp-adapter):

| MCP            | Type   | Tools                                                       | Purpose                           |
| -------------- | ------ | ----------------------------------------------------------- | --------------------------------- |
| **context7**   | Remote | `resolve-library-id`, `query-docs`                          | Up-to-date library/framework docs |
| **deepwiki**   | Remote | `read_wiki_structure`, `read_wiki_contents`, `ask_question` | GitHub repo docs + AI Q&A         |
| **firecrawl**  | Local  | `scrape`, `crawl`, `map`, `search`, `extract`, `agent`      | Web scraping                      |
| **playwright** | Local  | Browser automation                                          | Browser automation                |
| **MCP_DOCKER** | Local  | Docker MCP gateway                                          | Docker integration                |

### Context7 MCP

Up-to-date library documentation. API key: `CONTEXT7_API_KEY` in `~/.zshrc`.

**Tools:**

- `resolve-library-id` — Resolve library name to Context7 ID
- `query-docs` — Fetch docs for a library

**Usage:**

```typescript
subagent({ agent: "researcher", task: "How to use Prisma transactions?" });
// researcher uses mcp__context7__* tools automatically
```

### Deepwiki MCP

GitHub repository documentation and AI Q&A.

**Tools:**

- `read_wiki_structure` — List documentation topics
- `read_wiki_contents` — View documentation
- `ask_question` — Ask questions about a repo

### Firecrawl MCP (Local)

Self-hosted web scraping at `http://localhost:3002` via Docker.

**Setup:**

```bash
git clone https://github.com/mendableai/firecrawl.git ~/Developer/firecrawl
cd ~/Developer/firecrawl && docker compose up -d
```

**Tools:**
| Tool | Description |
|------|-------------|
| `firecrawl_scrape` | Single URL → markdown + metadata |
| `firecrawl_map` | Discover all URLs on a site |
| `firecrawl_search` | Web search |
| `firecrawl_crawl` | Crawl entire website |
| `firecrawl_extract` | Structured data extraction |
| `firecrawl_agent` | Autonomous research agent |

---

## Matt Pocock Skills

High-quality engineering practices for AI coding agents. Installed via:

```bash
npx skills@latest add mattpocock/skills
```

Then run `/setup-matt-pocock-skills` to configure per-repo settings.

### Engineering Skills

| Skill                            | When to use                                                             | Best with           |
| -------------------------------- | ----------------------------------------------------------------------- | ------------------- |
| `/diagnose`                      | Hard bugs/performance — reproduce → minimize → hypothesize → fix → test | `oracle`, `worker`  |
| `/grill-with-docs`               | Grilling session + domain model alignment + ADRs                        | `planner`, `oracle` |
| `/tdd`                           | Test-driven development — red-green-refactor loop                       | `worker`            |
| `/triage`                        | Incoming bugs/features — triage through a state machine                 | `researcher`        |
| `/improve-codebase-architecture` | Refactoring opportunities                                               | periodic audits     |
| `/zoom-out`                      | High-level code context in system terms                                 | `scout`             |
| `/prototype`                     | Throwaway prototype for design exploration                              | before committing   |
| `/to-issues`                     | Break plan into independently-grabbable issues                          | `planner`           |
| `/to-prd`                        | Convert feature request into PRD                                        | after `/grill-me`   |

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

## Extensions

### Tool Counter Footer

Displays tool and MCP call counts in the UI footer. Toggle via `/tool-counter`.

**Features:**

- Total tool invocations
- MCP calls breakdown by server
- Built-in tool usage (bash, read, write, edit, grep, find, ls)
- Token usage + model info

---

## Packages

### NPM Packages (via `pi install`)

| Package                | Purpose                                       |
| ---------------------- | --------------------------------------------- |
| `npm:pi-rtk-optimizer` | Auto-rewrites bash to compact rtk equivalents |
| `npm:pi-subagents`     | Async subagent delegation                     |
| `npm:pi-intercom`      | Direct messaging between pi sessions          |
| `npm:pi-web-access`    | Code examples, docs, API references           |
| `npm:pi-mcp-adapter`   | MCP server integration                        |

### pi-intercom

Direct messaging between pi sessions on the same machine. Press **Alt+M** or run `/intercom`.

```typescript
intercom({ action: "send", to: "session-name", message: "..." }); // Fire-and-forget
intercom({ action: "ask", to: "session-name", message: "..." }); // Blocking wait
```

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

## Prerequisites

| Dependency             | Purpose                    | Install                                                                             |
| ---------------------- | -------------------------- | ----------------------------------------------------------------------------------- |
| **pi-coding-agent**    | The Pi coding agent        | [earendil-works/pi-coding-agent](https://github.com/earendil-works/pi-coding-agent) |
| **pi-mcp-adapter**     | MCP server integration     | [pi.dev/packages/pi-mcp-adapter](https://pi.dev/packages/pi-mcp-adapter)            |
| **rtk**                | Compact shell commands     | `brew install rubygem-tk`                                                           |
| **Firecrawl**          | Web scraping (optional)    | `docker compose up -d` in firecrawl repo                                            |
| **Matt Pocock Skills** | Engineering best practices | `npx skills@latest add mattpocock/skills`                                           |
| **Archon**             | Workflow engine (optional) | `brew install coleam00/archon/archon`                                               |

### Quick Install

```bash
# 1. Install pi (follow pi-coding-agent docs)

# 2. Install pi-mcp-adapter
pi install npm:pi-mcp-adapter

# 3. Install rtk
brew install rubygem-tk

# 4. Install RTK optimizer
pi install npm:pi-rtk-optimizer

# 5. Install subagents and intercom
pi install npm:pi-subagents
pi install npm:pi-intercom

# 6. Install Matt Pocock Skills
npx skills@latest add mattpocock/skills

# 7. Install web-access for code lookups
pi install npm:pi-web-access

# 8. (Optional) Start Firecrawl
git clone https://github.com/mendableai/firecrawl.git ~/Developer/firecrawl
cd ~/Developer/firecrawl && docker compose up -d

# 9. (Optional) Install Archon
brew install coleam00/archon/archon
```

---

## Environment Variables

Add API keys to `~/.zshrc`:

```bash
export CONTEXT7_API_KEY="ctx7sk-..."
# Firecrawl runs locally, no API key needed
```

Reload: `source ~/.zshrc`

---

## Quick Reference

| Situation                   | Action                                        |
| --------------------------- | --------------------------------------------- |
| Understand unfamiliar code  | `/run scout "Map X"`                          |
| Need external evidence      | `/run researcher "Research X"`                |
| Hard decision before acting | `/run oracle "Advise on X"`                   |
| Complex work ahead          | `/grill-with-docs` first, then `/run planner` |
| Implement feature           | `/run worker` (after plan approved)           |
| After implementation        | Parallel `/run reviewer` (fresh context)      |
| Bug investigation           | `/diagnose` or `/run oracle`                  |
| New feature idea            | `/grill-me` → `/to-prd`                       |
| Breaking down a plan        | `/to-issues`                                  |
| Periodic codebase health    | `/improve-codebase-architecture`              |
| Design exploration          | `/prototype`                                  |
| Compact mode                | `/caveman`                                    |
| Handoff to another session  | `/intercom` (Alt+M)                           |

---

## Credits

- **[pi-coding-agent](https://github.com/earendil-works/pi-coding-agent)** by @earendil-works
- **[pi-subagents](https://pi.dev/packages/pi-subagents)** by nicopreme
- **[Matt Pocock Skills](https://github.com/mattpocock/skills)** by @mattpocock
- **[pi-mcp-adapter](https://pi.dev/packages/pi-mcp-adapter)** by nicopreme
- **[pi-rtk-optimizer](https://github.com/MasuRii/pi-rtk-optimizer)** by @MasuRii
- **[Archon](https://github.com/coleam00/Archon)** by @coleam00
- **[Firecrawl](https://github.com/mendableai/firecrawl)** by @mendableai
- **[Context7](https://context7.com)** by Context7
- **[DeepWiki](https://deepwiki.com)** by DeepWiki
- **[Playwright](https://playwright.dev)** by Microsoft

