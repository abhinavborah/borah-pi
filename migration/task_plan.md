# Migration Plan: theme-cycler + themeMap → ~/.pi/agent/extensions/

## Goal
Migrate two extensions from `~/Developer/pi-vs-claude-code/extensions/` to `~/.pi/agent/extensions/` and integrate them into the current pi configuration.

## Extensions
- `theme-cycler.ts` — Keyboard shortcuts (Ctrl+X/Q) + `/theme` command to cycle themes
- `themeMap.ts` — Per-extension theme assignments + terminal title logic (dependency for theme-cycler)

## Directory Structure Comparison

| Path | Source (disler) | Target (~/.pi) |
|------|-----------------|----------------|
| Extensions | `/extensions/` (root) | `/agent/extensions/` |
| Themes | `/.pi/themes/` | `/agent/themes/` |
| Config | `/.pi/settings.json` | `/agent/settings.json` |

## Critical Findings

### Import Path Mismatch
| Repo | Package | Notes |
|------|---------|-------|
| Source (disler) | `@mariozechner/pi-coding-agent` | - |
| Your setup | `@earendil-works/pi-coding-agent` | Different package! |

### Installation Method
Your pi has built-in commands:
```
pi install <source>    # Install extension and add to settings
pi remove <source>      # Remove extension from settings  
pi list                # List installed extensions
```
**Decision needed**: Use `pi install` or manual copy?

### Theme Gap
| Theme | Available? |
|-------|------------|
| gruvbox | ✅ Yes |
| gruvbox-dark | ✅ Yes |
| gruvbox-new | ✅ Yes |
| synthwave | ❌ Missing |
| catppuccin-mocha | ❌ Missing |
| cyberpunk | ❌ Missing |
| dracula | ❌ Missing |
| everforest | ❌ Missing |
| midnight-ocean | ❌ Missing |
| nord | ❌ Missing |
| ocean-breeze | ❌ Missing |
| rose-pine | ❌ Missing |
| tokyo-night | ❌ Missing |

## Phases

### Phase 1: Research & Analysis ✅
- [x] Read source extensions fully
- [x] Understand import dependencies (themeMap.ts → theme-cycler.ts)
- [x] Check if `import.meta.url` pattern is supported in target pi version
- [x] Verify Node.js built-ins usage (path.basename, fileURLToPath)
- [x] Identify any Pi API changes between source and target
- [x] **Discovery**: Package name differs (`@mariozechner` vs `@earendil-works`)
- [x] **Discovery**: Your pi has `pi install` CLI command

### Phase 2: Adaptation Planning ✅
- [x] Source uses `@mariozechner/pi-coding-agent`, your setup uses `@earendil-works/pi-coding-agent`
- [x] Decision: import as-is, adapt package name
- [x] Check if referenced themes exist — 10 of 11 were missing
- [x] Decision: Copy all themes from disler's repo
- [x] Determine if `primaryExtensionName()` logic works — works with process.argv

### Phase 3: Implementation ✅
- [x] Decision: Use manual copy + `pi install` (fastest)
- [x] Copy themes from disler repo to ~/.pi/agent/themes/ (11 themes)
- [x] Copy theme-cycler.ts and themeMap.ts to ~/.pi/agent/extensions/
- [x] Fix import: @mariozechner/pi-coding-agent → @earendil-works/pi-coding-agent
- [x] Fix import: @mariozechner/pi-tui → @earendil-works/pi-tui
- [x] Verify file structure is correct (20 files: 9 extensions + 11 themes)
- [x] Register both extensions via `pi install ./extensions/... --local`

### Phase 4: Integration (IN PROGRESS)
- [x] Extensions registered in pi settings
- [ ] Verify theme-cycler keyboard shortcuts work (needs manual testing)
- [ ] Verify /theme command works
- [ ] Check swatch widget displays

### Phase 5: Validation (PENDING)
- [ ] Run pi with new extension
- [ ] Test Ctrl+. / Ctrl+, (theme cycling)
- [ ] Test /theme without args (picker)
- [ ] Test /theme <name>
- [ ] Verify status line shows theme name
- [ ] Verify gruvbox-new is the default theme

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-05-22 | Migrate as-is, adapt paths | Theme logic is complex; avoid rewriting |
| 2026-05-22 | Found package mismatch | @mariozechner vs @earendil-works |
| 2026-05-22 | Found `pi install` command | May simplify installation |
| 2026-05-22 | Manual copy chosen | Faster for local files |
| 2026-05-22 | Copied all 11 themes | Needed for full THEME_MAP support |
| 2026-05-22 | themeMap.ts invalid factory | Added noop `export default function (pi) {}` |
| 2026-05-22 | Ctrl+T reserved | Changed to Ctrl+. (forward), Ctrl+, (backward) |
| 2026-05-22 | Default theme gruvbox-new | Changed THEME_MAP["theme-cycler"] from "synthwave" |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| themeMap.ts not a factory | 1 | Added default export noop |
| Ctrl+T reserved (toggleThinking) | 1 | Changed to Ctrl+. (forward), Ctrl+, (backward) |
| Default theme synthwave | 1 | Changed THEME_MAP["theme-cycler"] to "gruvbox-new" |

## Fixes Applied

### themeMap.ts — Added default export
Added noop export to satisfy pi's "must export factory function" requirement:
```typescript
export default function (pi: ExtensionAPI) {
  // Noop — utility module.
}
```

### theme-cycler.ts — Changed conflicting shortcuts
- `ctrl+t` → `ctrl+.` (cycle forward)
- `ctrl+shift+t` → `ctrl+,` (cycle backward)

Ctrl+T is reserved by pi for `toggleThinking` and cannot be overridden. Changed to punctuation combos that are not listed in reserved/non-reserved keybindings.