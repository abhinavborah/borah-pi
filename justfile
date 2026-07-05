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

# launchers

# 1. default pi: docs tools + footer + themes
pi:
    {{PI_NO_EXT}} -e {{PI_PATH}}context7.ts -e {{PI_PATH}}deepwiki.ts -e {{PI_PATH}}composed-footer.ts -e {{PI_PATH}}theme-cycler.ts

# 2. Minimal pi: model name + 10-block context meter
min-pi:
    {{PI_NO_EXT}}

# 3. Theme cycler: Ctrl+. forward, Ctrl+, backward, /theme picker
ext-theme-cycler:
    {{PI_NO_EXT}} -e {{PI_PATH}}theme-cycler.ts

# utils

# Open pi with one or more stacked extensions in a new terminal: just open composed-footer theme-cycler
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

# ------------------------ coms ------------------------

# Coms: peer-to-peer, same machine messaging between Pi agents
# Pass any pi/extension flags through, e.g.: just local-coms --name dev --color "#72F1B8"
local-coms *args:
    {{PI_NO_EXT}} -e {{PI_PATH}}coms.ts -e {{PI_PATH}}theme-cycler.ts {{args}}
