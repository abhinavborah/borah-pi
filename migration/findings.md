# Findings: theme-cycler + themeMap Migration

## Source Extensions

### themeMap.ts
- **Purpose**: Per-extension default theme assignments + terminal title
- **Key exports**: 
  - `THEME_MAP` — Record<extensionName, themeName>
  - `applyExtensionDefaults()` — sets theme + title on session boot
- **Dependencies**: Node.js `path`, `fileURLToPath`
- **Import pattern**: `import.meta.url` from calling extension
- **Special logic**: `primaryExtensionName()` reads `process.argv` for `-e` flags

### theme-cycler.ts
- **Purpose**: Keyboard shortcuts + command to cycle/switch themes
- **Shortcuts**: Ctrl+X (forward), Ctrl+Q (backward)
- **Commands**: `/theme` (picker), `/theme <name>` (direct switch)
- **Features**: 
  - Status line shows current theme
  - Color swatch widget flashes for 3 seconds after switch
- **Dependencies**: `applyExtensionDefaults` from themeMap.ts
- **API usage**: `ctx.ui.getAllThemes()`, `ctx.ui.setTheme()`, `ctx.ui.select()`

## Source Themes (from disler's .pi/themes/)
```
catppuccin-mocha, cyberpunk, dracula, everforest, gruvbox
midnight-ocean, nord, ocean-breeze, rose-pine, synthwave, tokyo-night
```

## Your Themes (~/.pi/agent/themes/)
```
gruvbox-dark.json, gruvbox-new.json, gruvbox.json
```

## Critical Findings

### Import Path Mismatch
| Repo | Package | Notes |
|------|---------|-------|
| Source (disler) | `@mariozechner/pi-coding-agent` | - |
| Your setup | `@earendil-works/pi-coding-agent` | Different package! |

### ESM Support Confirmed ✅
Your existing `deepwiki.ts` extension uses `import.meta.url` — this pattern is supported.

### Installation Method
Your pi has built-in commands:
```
pi install <source>    # Install extension and add to settings
pi remove <source>      # Remove extension from settings  
pi list                # List installed extensions
```

## Key Differences
1. **Package name**: Source uses `@mariozechner/pi-coding-agent`, your setup uses `@earendil-works/pi-coding-agent`
2. **Theme set**: Your setup has only gruvbox variants; disler's has 11 themes
3. **Import location**: Source uses `./themeMap.ts` (same dir); target will need path adjustment
4. **Directory structure**: Source root `extensions/` vs your `agent/extensions/`
5. **Install method**: Your pi has `pi install` CLI command for extensions

## THEME_MAP Analysis
| Extension | Theme | Status |
|-----------|-------|--------|
| theme-cycler | synthwave | ❌ MISSING |
| minimal | synthwave | ❌ MISSING |
| tool-counter | synthwave | ❌ MISSING |
| tool-counter-widget | synthwave | ❌ MISSING |
| damage-control | gruvbox | ✅ AVAILABLE |
| pure-focus | everforest | ❌ MISSING |
| purpose-gate | tokyo-night | ❌ MISSING |
| (and 8 more) | various | ❌ MISSING |

## Migration Strategy Options
1. **Option A**: Copy files as-is, adapt import paths + package names, create stub themes
2. **Option B**: Use `pi install` command to install from npm (if available)
3. **Option C**: Map all missing themes to gruvbox variants for MVP

## Open Questions
- [ ] Does `pi install` work with local .ts files or only npm?
- [ ] Should we create missing themes or map to gruvbox variants?
- [ ] Is theme-cycler meant to be the PRIMARY extension in the stack?
- [ ] What theme should theme-cycler use in your setup? (default is synthwave, which is missing)

---
*Last updated: 2026-05-22*