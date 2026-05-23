set dotenv-load := true

default:
    @just --list

# prime

# Launch Pi and run /prime
primepi:
    pi "/prime"

# variables
PI_NO_EXT := "pi --no-extensions"
PI_PATH := "~/.pi/agent/extensions/"

# g1

# 1. default pi
pi:
    {{PI_NO_EXT}} -e {{PI_PATH}}context7.ts -e {{PI_PATH}}deepwiki.ts -e {{PI_PATH}}tool-counter-footer.ts -e {{PI_PATH}}theme-cycler.ts

# 2. Pure focus pi: strip footer and status line entirely
ext-pure-focus:
    {{PI_NO_EXT}} -e {{PI_PATH}}pure-focus.ts

# 3. Minimal pi: model name + 10-block context meter
min-pi:
    {{PI_NO_EXT}}

# 4. Purpose gate pi: declare intent before working, persistent widget, focus the system prompt on the ONE PURPOSE for this agent
ext-purpose-gate:
    {{PI_NO_EXT}} -e ~/.pi/agent/extensions/purpose-gate.ts -e ~/.pi/agent/extensions/minimal.ts

# 5. Subagent widget: /sub <task> with live streaming progress
ext-subagent-widget:
    {{PI_NO_EXT}} -e {{PI_PATH}}subagent-widget.ts -e {{PI_PATH}}theme-cycler.ts

# 6. TillDone: task-driven discipline — define tasks before working
ext-tilldone:
    {{PI_NO_EXT}} -e {{PI_PATH}}tilldone.ts -e {{PI_PATH}}theme-cycler.ts

#g2

# 10. Agent team: dispatcher orchestrator with team select and grid dashboard
ext-agent-team:
    {{PI_NO_EXT}} -e {{PI_PATH}}agent-team.ts -e {{PI_PATH}}theme-cycler.ts

# 11. System select: /system to pick an agent persona as system prompt
ext-system-select:
    {{PI_NO_EXT}} -e ~/.pi/agent/extensions/system-select.ts -e ~/.pi/agent/extensions/minimal.ts -e ~/.pi/agent/extensions/theme-cycler.ts

# 12. Launch with Damage-Control safety auditing
ext-damage-control:
    {{PI_NO_EXT}} -e ~/.pi/agent/extensions/damage-control.ts -e ~/.pi/agent/extensions/minimal.ts -e ~/.pi/agent/extensions/theme-cycler.ts

# 12b. Damage-Control (continue): same rules, but blocked turns keep running with actionable feedback
ext-damage-control-continue:
    {{PI_NO_EXT}} -e ~/.pi/agent/extensions/damage-control-continue.ts -e ~/.pi/agent/extensions/minimal.ts -e ~/.pi/agent/extensions/theme-cycler.ts

# 13. Agent chain: sequential pipeline orchestrator
ext-agent-chain:
    {{PI_NO_EXT}} -e ~/.pi/agent/extensions/agent-chain.ts -e ~/.pi/agent/extensions/theme-cycler.ts

#g3

# 14. Pi Pi: meta-agent that builds Pi agents with parallel expert research
ext-pi-pi:
    {{PI_NO_EXT}} -e ~/.pi/agent/extensions/pi-pi.ts -e ~/.pi/agent/extensions/theme-cycler.ts

# 15. Session Replay: scrollable timeline overlay of session history
ext-session-replay:
    {{PI_NO_EXT}} -e ~/.pi/agent/extensions/session-replay.ts -e ~/.pi/agent/extensions/minimal.ts

# 16. Theme cycler: Ctrl+X forward, Ctrl+Q backward, /theme picker
ext-theme-cycler:
    {{PI_NO_EXT}} -e ~/.pi/agent/extensions/theme-cycler.ts -e ~/.pi/agent/extensions/minimal.ts

# utils

# Open pi with one or more stacked extensions in a new terminal: just open minimal tool-counter
open +exts:
    #!/usr/bin/env bash
    args=""
    for ext in {{exts}}; do
        args="$args -e ~/.pi/agent/extensions/$ext.ts"
    done
    cmd="pi --no-extensions$args"
    escaped="${cmd//\\/\\\\}"
    escaped="${escaped//\"/\\\"}"
    osascript -e "tell application \"Terminal\" to do script \"$escaped\""

# ------------------------ coms + coms-net (HTTP/SSE hub) ------------------------

# Coms: peer-to-peer, same machine messaging between Pi agents
# Pass any pi/extension flags through, e.g.: just ext-coms --name dev --color "#72F1B8"
local-coms *args:
    {{PI_NO_EXT}} -e {{PI_PATH}}coms.ts -e {{PI_PATH}}theme-cycler.ts {{args}}

# Start a local coms-net server (binds 127.0.0.1, OS-claimed port)
# Auto-kills any stale process holding the pinned port first.
coms-net-server:
    -lsof -ti :${PI_COMS_NET_PORT:-52965} | xargs -r kill -TERM 2>/dev/null
    bun scripts/coms-net-server.ts

# Start a LAN-visible coms-net server (binds 0.0.0.0, requires PI_COMS_NET_AUTH_TOKEN)
# Auto-kills any stale process holding the pinned port first.
coms-net-server-lan:
    -lsof -ti :${PI_COMS_NET_PORT:-52965} | xargs -r kill -TERM 2>/dev/null
    PI_COMS_NET_HOST=0.0.0.0 bun scripts/coms-net-server.ts

# Pi with networked coms client (auto-discovers local server.json)
# Pass any flags through, e.g.: just ext-coms-net --name dev --server-url http://… --auth-token …
coms *args:
    {{PI_NO_EXT}} -e ~/.pi/agent/extensions/coms-net.ts -e ~/.pi/agent/extensions/minimal.ts -e ~/.pi/agent/extensions/theme-cycler.ts {{args}}

# coms-net with gpt-5.5 (extra args still pass through, e.g. --name dev)
coms1 *args:
    {{PI_NO_EXT}} -e ~/.pi/agent/extensions/coms-net.ts -e ~/.pi/agent/extensions/minimal.ts -e ~/.pi/agent/extensions/theme-cycler.ts --provider openai --model gpt-5.5 {{args}}

# coms-net with claude-opus-4-7
coms2 *args:
    {{PI_NO_EXT}} -e ~/.pi/agent/extensions/coms-net.ts -e ~/.pi/agent/extensions/minimal.ts -e ~/.pi/agent/extensions/theme-cycler.ts --model claude-opus-4-7 {{args}}

# coms-net with deepseek/deepseek-v4-pro
coms3 *args:
    {{PI_NO_EXT}} -e ~/.pi/agent/extensions/coms-net.ts -e ~/.pi/agent/extensions/minimal.ts -e ~/.pi/agent/extensions/theme-cycler.ts --model deepseek/deepseek-v4-pro {{args}}

# coms-net with z-ai/glm-5.1
coms4 *args:
    {{PI_NO_EXT}} -e ~/.pi/agent/extensions/coms-net.ts -e ~/.pi/agent/extensions/minimal.ts -e ~/.pi/agent/extensions/theme-cycler.ts --model z-ai/glm-5.1 {{args}}
