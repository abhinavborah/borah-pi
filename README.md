# Pi Config

My personal Pi coding agent setup, configured to work with [Archon](https://github.com/coleam00/Archon) workflows and optimized for AI-assisted development.

## What's Included

```
~/.pi/
├── agent/
│   ├── extensions/
│   │   └── tool-counter-footer.ts  # Tool call counter UI footer
│   └── settings.json              # Configuration
├── mcp.json                        # MCP server configurations
└── README.md
```

## MCP Servers

Configured via `~/.pi/mcp.json` using [pi-mcp-adapter](https://pi.dev/packages/pi-mcp-adapter):

| MCP | Type | Purpose |
|-----|------|---------|
| **context7** | Remote | Up-to-date library/framework documentation |
| **deepwiki** | Remote | GitHub repository docs and AI Q&A |
| **firecrawl** | Local | Web scraping, crawling, URL discovery |
| **playwright** | Local | Browser automation |
| **MCP_DOCKER** | Local | Docker MCP gateway |

### Firecrawl MCP (Self-Hosted)

Firecrawl runs via Docker for web scraping capabilities.

**Setup:**

```bash
# Clone Firecrawl
git clone https://github.com/mendableai/firecrawl.git ~/Developer/firecrawl

# Start via Docker
cd ~/Developer/firecrawl
docker compose build
docker compose up -d

# Firecrawl runs at http://localhost:3002
# MCP server connects automatically via ~/.pi/mcp.json
```

**Tools available:**
| Tool | Description |
|------|-------------|
| `firecrawl_scrape` | Scrape a single URL, return markdown + metadata |
| `firecrawl_map` | Discover all URLs on a website |
| `firecrawl_search` | Search the web |
| `firecrawl_crawl` | Crawl entire website |
| `firecrawl_extract` | Extract structured data |
| `firecrawl_agent` | Autonomous research agent |

---

### pi-subagents

Enables delegation to focused child agents. See `~/.pi/agent/AGENTS.md` for built-in agents: `scout`, `researcher`, `planner`, `worker`, `reviewer`, `context-builder`, `oracle`, `delegate`.

### pi-intercom

Direct messaging between pi sessions on the same machine. Press **Alt+M** or run `/intercom` to send messages between sessions.

### pi-web-access

Provides `code_search` for programming questions, API usage, and library examples. Useful when firecrawl isn't available or for targeted code lookups.

---

## Matt Pocock Skills

Installed via:
```bash
npx skills@latest add mattpocock/skills
```

Then run `/setup-matt-pocock-skills` in your agent to configure per-repo settings.

### Available Skills

**Engineering:**
| Skill | Purpose |
|-------|---------|
| `/diagnose` | Disciplined diagnosis loop for bugs/performance |
| `/grill-with-docs` | Grilling session with domain model alignment |
| `/triage` | Triage issues through a state machine |
| `/improve-codebase-architecture` | Find refactoring opportunities |
| `/tdd` | Test-driven development (red-green-refactor) |
| `/to-issues` | Break plans into GitHub issues |
| `/to-prd` | Convert context to PRD issue |
| `/zoom-out` | High-level code context |
| `/prototype` | Build throwaway prototypes |

**Productivity:**
| Skill | Purpose |
|-------|---------|
| `/caveman` | Ultra-compact communication (~75% token reduction) |
| `/grill-me` | Get interviewed on a plan/design |
| `/handoff` | Compact conversation for agent handoff |
| `/write-a-skill` | Create new skills |

See [github.com/mattpocock/skills](https://github.com/mattpocock/skills) for full documentation.

---

### Tool Counter Footer (`extensions/tool-counter-footer.ts`)

Displays tool and MCP call counts in the UI footer. Toggle on/off via command.

**Features:**

- Shows total tool invocations
- Breaks down MCP calls by server
- Lists built-in tool usage (bash, read, write, edit, grep, find, ls)
- Displays token usage and model info

**Toggle:** Use `/tool-counter` to enable/disable.

---

## Installed Packages

### NPM Packages (via `pi install`)

| Package | Purpose |
|---------|---------|
| `npm:pi-rtk-optimizer` | Auto-rewrites bash commands to compact rtk equivalents |
| `npm:pi-subagents` | Async subagent delegation with truncation, artifacts, and session sharing |
| `npm:pi-intercom` | Direct 1:1 messaging between pi sessions on the same machine |
| `npm:pi-web-access` | Code examples, docs, and API references ([nicobailon/pi-web-access](https://github.com/nicobailon/pi-web-access)) |

**RTK Optimizer:** Rewrites `ls -la` → `rtk ls` (compact output). Requires `rtk` installed (`brew install rubygem-tk`).

### Skills (Matt Pocock)

[Matt Pocock's skills](https://github.com/mattpocock/skills) are high-quality engineering practices for AI coding agents. See the **Matt Pocock Skills** section below.

**RTK Optimizer:**

- Rewrites `ls -la` → `rtk ls` (compact output)
- Tracks savings with `/rtk stats`

**Requires:** `rtk` installed (`brew install rubygem-tk`)

---

## Archon Workflows

Archon is a workflow engine for AI coding agents. These workflows are configured to use **Pi** as the provider.

| Workflow                     | Purpose                                                    |
| ---------------------------- | ---------------------------------------------------------- |
| `archon-assist`              | General Q&A, debugging, exploration                        |
| `archon-fix-github-issue`    | Issue → investigate → implement → validate → PR → review   |
| `archon-idea-to-pr`          | Feature idea → plan → implement → validate → PR → review   |
| `archon-plan-to-pr`          | Execute existing plan → implement → validate → PR → review |
| `archon-refactor-safely`     | Safe refactoring with type-check hooks                     |
| `archon-smart-pr-review`     | Targeted PR review with complexity classification          |
| `maintainer-standup-minimax` | Daily PR/issue triage                                      |
| `repo-triage-minimax`        | Repository triage workflow                                 |

**Setup:**

1. Install Archon:

   ```bash
   brew install coleam00/archon/archon
   # or
   curl -fsSL https://archon.diy/install | bash
   ```

2. Copy workflows to `~/.archon/workflows/`:

   ```bash
   cp -r workflows/* ~/.archon/workflows/
   ```

3. Create `~/.archon/config.yaml`:

   ```yaml
   defaultAssistant: pi
   assistants:
     pi:
       model: minimax/minimax-m2.7 # or your preferred model
   ```

4. Start Archon:
   ```bash
   archon serve
   ```

---

## Prerequisites

| Dependency          | Purpose                    | Install                                                                             |
| ------------------- | -------------------------- | ----------------------------------------------------------------------------------- |
| **pi-coding-agent** | The Pi coding agent        | [earendil-works/pi-coding-agent](https://github.com/earendil-works/pi-coding-agent) |
| **pi-mcp-adapter** | MCP server integration     | [pi.dev/packages/pi-mcp-adapter](https://pi.dev/packages/pi-mcp-adapter)            |
| **rtk**             | Compact shell commands     | `brew install rubygem-tk` or system package                                         |
| **Firecrawl**       | Web scraping (optional)    | Docker: `cd ~/Developer/firecrawl && docker compose up -d`                          |
| **Matt Pocock Skills** | Engineering best practices | `npx skills@latest add mattpocock/skills`                                           |
| **Archon**          | Workflow engine (optional) | `brew install coleam00/archon/archon`                                              |
| **Node.js/npm**     | For pi and rtk             | via nvm or system                                                                   |

### Quick Install

```bash
# 1. Install pi (follow pi-coding-agent docs)

# 2. Install pi-mcp-adapter (included with pi)
# MCP servers configured in ~/.pi/mcp.json

# 3. Install rtk
brew install rubygem-tk

# 4. Install RTK optimizer for pi
pi install npm:pi-rtk-optimizer

# 5. Install Matt Pocock Skills (optional)
npx skills@latest add mattpocock/skills

# 6. Install Archon (optional)
brew install coleam00/archon/archon

# 6. (Optional) Start Firecrawl for web scraping
git clone https://github.com/mendableai/firecrawl.git ~/Developer/firecrawl
cd ~/Developer/firecrawl && docker compose up -d
```

---

## Configuration

### MCP Servers (`mcp.json`)

Configure MCP servers in `~/.pi/mcp.json`. See [pi-mcp-adapter docs](https://pi.dev/packages/pi-mcp-adapter) for details.

### Settings (`settings.json`)

Copy `settings.json.template` to `~/.pi/agent/settings.json` and customize:

```json
{
  "provider": "your-provider",
  "model": "your-model",
  "theme": "dark",
  "packages": ["npm:pi-rtk-optimizer"]
}
```

### Environment Variables

MCP servers may require API keys via `{env:VAR_NAME}` syntax in `mcp.json`. Add these to your shell RC file:

```bash
# ~/.zshrc or ~/.bashrc
export CONTEXT7_API_KEY="fc-your-key-here"
export FIRECRAWL_API_URL="http://localhost:3002"
# Add other API keys as needed
```

Reload your shell:
```bash
source ~/.zshrc
```

### API Credentials (Alternative)

Store credentials in `~/.pi/agent/auth.json` via interactive login:

```bash
pi /login
```

Or use environment variables (see [providers.md](https://github.com/earendil-works/pi-coding-agent/blob/main/docs/providers.md)).

### Global Context (`AGENTS.md`)

Add global instructions that apply to every Pi session. Place in `~/.pi/agent/AGENTS.md`.

---

## Credits

- **[pi-coding-agent](https://github.com/earendil-works/pi-coding-agent)** by @earendil-works
- **[pi-mcp-adapter](https://pi.dev/packages/pi-mcp-adapter)** by @earendil-works
- **[pi-rtk-optimizer](https://github.com/MasuRii/pi-rtk-optimizer)** by @MasuRii
- **[Archon](https://github.com/coleam00/Archon)** by @coleam00
- **[Firecrawl](https://github.com/mendableai/firecrawl)** by @mendableai
- **[Playwright](https://playwright.dev)** by Microsoft
- **[Context7](https://context7.com)** by Context7
- **[DeepWiki](https://deepwiki.com)** by DeepWiki