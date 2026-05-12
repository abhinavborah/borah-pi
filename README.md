# Pi Config

My personal Pi coding agent setup, configured to work with [Archon](https://github.com/coleam00/Archon) workflows and optimized for AI-assisted development.

## What's Included

```
~/.pi/
├── agent/
│   ├── extensions/
│   │   ├── firecrawl.ts           # Web scraping/crawling tools
│   │   └── tool-counter-footer.ts  # Tool call counter UI footer
│   └── settings.json              # Configuration
└── README.md
```

**NPM packages** (installed via `pi install`):

- `npm:pi-rtk-optimizer` — Auto-rewrites bash commands to compact rtk equivalents

**Archon workflows** (in `~/.archon/workflows/`, not tracked here):

- archon-assist, archon-fix-github-issue, archon-idea-to-pr, archon-plan-to-pr, archon-refactor-safely, archon-smart-pr-review, maintainer-standup-minimax, repo-triage-minimax

## Extensions

### Firecrawl (`extensions/firecrawl.ts`)

Provides web scraping, crawling, and URL discovery tools via the [Firecrawl](https://github.com/mendableai/firecrawl) API.

**Tools:**
| Tool | Description |
|------|-------------|
| `firecrawl_scrape` | Scrape a single URL, return markdown + metadata |
| `firecrawl_crawl` | Crawl entire website (async, auto-polls for completion) |
| `firecrawl_map` | Discover all URLs on a website quickly |

**Requires:** [Firecrawl running locally](https://github.com/mendableai/firecrawl) via Docker at `http://localhost:3002`.

**Setup:**

```bash
# Clone Firecrawl
git clone https://github.com/mendableai/firecrawl.git ~/Developer/firecrawl

# Start via Docker
cd ~/Developer/firecrawl
docker compose build
docker compose up -d

# Install extension (already in this repo)
# Just copy firecrawl.ts to ~/.pi/agent/extensions/

# Reload pi
pi /reload
```

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

### RTK Optimizer (npm package)

Auto-rewrites bash commands to compact `rtk` equivalents, reducing token usage.

**Package:** `npm:pi-rtk-optimizer`  
**Source:** [github.com/MasuRii/pi-rtk-optimizer](https://github.com/MasuRii/pi-rtk-optimizer)  
**Requires:** `rtk` installed (available via Homebrew: `brew install rubygem-tk` or system package manager)

**What it does:**

- Rewrites `ls -la` → `rtk ls` (compact output)
- Rewrites `git status` → `rtk g s` equivalents
- Tracks savings with `/rtk stats`

**Install:**

```bash
pi install npm:pi-rtk-optimizer
```

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
| **rtk**             | Compact shell commands     | `brew install rubygem-tk` or system package                                         |
| **Firecrawl**       | Web scraping (optional)    | Docker: `docker compose up -d`                                                      |
| **Archon**          | Workflow engine (optional) | `brew install coleam00/archon/archon`                                               |
| **Node.js/npm**     | For pi and rtk             | via nvm or system                                                                   |

### Quick Install

```bash
# 1. Install pi (follow pi-coding-agent docs)

# 2. Install rtk
brew install rubygem-tk

# 3. Install RTK optimizer for pi
pi install npm:pi-rtk-optimizer

# 4. Install Archon (optional)
brew install coleam00/archon/archon

# 5. (Optional) Start Firecrawl for web scraping
git clone https://github.com/mendableai/firecrawl.git ~/Developer/firecrawl
cd ~/Developer/firecrawl && docker compose up -d
```

---

## Configuration

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

### API Credentials

Store credentials in `~/.pi/agent/auth.json` via interactive login:

```bash
pi /login
```

Or use environment variables (see [providers.md](https://github.com/earendil-works/pi-coding-agent/blob/main/docs/providers.md)).

### Global Context (`AGENTS.md`)

Add global instructions that apply to every Pi session. Place in `~/.pi/agent/AGENTS.md`.

---

## Quick Start

```bash
# 1. Clone this config
git clone https://github.com/YOUR_USERNAME/pi.git ~/.pi-backup

# 2. Copy extensions to pi agent directory
cp -r agent/extensions/ ~/.pi/agent/extensions/

# 3. Copy settings template and edit with your provider/model
cp settings.json.template ~/.pi/agent/settings.json
# Edit ~/.pi/agent/settings.json with your provider/model

# 4. Install npm packages
pi install npm:pi-rtk-optimizer

# 5. Reload pi
pi /reload
```

**Archon workflows:** These are tracked separately in `~/.archon/workflows/` and not included in this repo.

---

## Credits

- **[pi-coding-agent](https://github.com/earendil-works/pi-coding-agent)** by @earendil-works
- **[pi-rtk-optimizer](https://github.com/MasuRii/pi-rtk-optimizer)** by @MasuRii
- **[Archon](https://github.com/coleam00/Archon)** by @coleam00
- **[Firecrawl](https://github.com/mendableai/firecrawl)** by @mendableai
