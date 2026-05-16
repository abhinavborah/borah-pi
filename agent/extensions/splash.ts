/**
 * Splash Screen Extension for Pi
 *
 * Shows an ASCII art splash on session start with:
 * - Two-column layout: logo/tagline left, stats/shortcuts right
 * - Theme-aware colors
 * - Auto-dismisses on first user message
 * - Loads ASCII art from ~/.pi/agent/art/ascii.txt
 *
 * Based on pi-splash by ghoseb
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { Theme } from "@earendil-works/pi-coding-agent";
import type { Component, TUI } from "@earendil-works/pi-tui";
import { visibleWidth } from "@earendil-works/pi-tui";
import * as fs from "fs";
import * as path from "path";

// ═══════════════════════════════════════════════════════════════════════════
// ASCII Art Loading
// ═══════════════════════════════════════════════════════════════════════════

const DEFAULT_ART = [
  "  ███████████████▀      ░▐█████░▌        ████████████████",
  "  ██████████████▌ ▄░      ░▀████░▌      ░████████████████",
  "  █████████████░▀          ░░█████▄    ░▐████████████████",
  "  ███████████▌░    ▌        ░▐█████▄  ▄█▄████████████████",
  "  ███████████▌    ▄█▌      ░███████▌░█░ ▌░███████████████",
  "  ████████████▀░░▄██▀░     ▐▀█████▌ ▐██▄░▐███████████████",
  "  ████████████░▄ ▐▀▀▀▌     ▀▄▀▀▐▀▀   ██░░████████████████",
  "  ████████████▄ ▀░          ▌    ░░  ▐░██████████████████",
  "  █████████████ ▀▌  ▄▄░▀           ░▄ █████ [borah]'s ███",
  "  █████████████░▄███▀░             ▀▀ █████    Pi     ███",
  "  █████████████▄▀▄░                  ▄███████████████████",
  "  ██████████████▄▀░              ░░▄▐████████████████████",
];

function loadArtFile(artPath: string): string[] {
  try {
    if (fs.existsSync(artPath)) {
      const content = fs.readFileSync(artPath, "utf-8");
      const lines = content.split("\n").filter((line) => line.length > 0);
      if (lines.length > 0) {
        return lines;
      }
    }
  } catch (e) {
    // Fall back to default
  }
  return DEFAULT_ART;
}

// ═══════════════════════════════════════════════════════════════════════════
// Utilities
// ═══════════════════════════════════════════════════════════════════════════

const TAGLINES = [
  "Ready to ship.",
  "Always be coding.",
  "The code is strong with this one.",
  "I can only show you the door.",
  "Make it so. Make it ship.",
  "First prize is a working build.",
  "What does the refactor look like?",
  "The leads are weak? Ship it anyway.",
  "Blessed is he who ships to production.",
  "English, do you speak git?",
];

function getRandomTagline(): string {
  return TAGLINES[Math.floor(Math.random() * TAGLINES.length)];
}

function centerText(text: string, width: number): string {
  const visLen = visibleWidth(text);
  if (visLen >= width) return text;
  const leftPad = Math.floor((width - visLen) / 2);
  return " ".repeat(leftPad) + text + " ".repeat(width - visLen - leftPad);
}

function padToWidth(str: string, width: number): string {
  const visLen = visibleWidth(str);
  if (visLen >= width) return str;
  return str + " ".repeat(width - visLen);
}

function shortenHome(pathStr: string): string {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? "";
  if (home && pathStr.startsWith(home)) return "~" + pathStr.slice(home.length);
  return pathStr;
}

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

interface SplashStats {
  cwd: string;
  agentsPath: string | null;
  themeName: string;
  extensions: number;
  skills: number;
  tools: number;
  borderStyle: BorderStyle;
  borderChars: BorderChars;
  showDefaultStats: boolean;
}

type BorderStyle = "solid" | "dashed" | "rounded" | "double";

interface BorderChars {
  v: string;
  tl: string;
  tr: string;
  bl: string;
  br: string;
  h: string;
  tJunction: string;
  bJunction: string;
}

const BORDER_CHARS: Record<BorderStyle, BorderChars> = {
  solid: {
    v: "│",
    tl: "┌",
    tr: "┐",
    bl: "└",
    br: "┘",
    h: "─",
    tJunction: "┬",
    bJunction: "┴",
  },
  dashed: {
    v: "┆",
    tl: "┌",
    tr: "┐",
    bl: "└",
    br: "┘",
    h: "─",
    tJunction: "┬",
    bJunction: "┴",
  },
  rounded: {
    v: "│",
    tl: "╭",
    tr: "╮",
    bl: "╰",
    br: "╯",
    h: "─",
    tJunction: "┬",
    bJunction: "┴",
  },
  double: {
    v: "║",
    tl: "╔",
    tr: "╗",
    bl: "╚",
    br: "╝",
    h: "═",
    tJunction: "╦",
    bJunction: "╩",
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// Splash Component
// ═══════════════════════════════════════════════════════════════════════════

class SplashHeader implements Component {
  private tagline: string;

  constructor(
    private readonly theme: Theme,
    private readonly stats: SplashStats,
    private readonly artLines: string[],
  ) {
    this.tagline = getRandomTagline();
  }

  invalidate(): void {
    // Theme changed, request re-render
  }

  render(termWidth: number): string[] {
    const minWidth = 90;
    if (termWidth < minWidth) return [];

    const boxWidth = Math.max(80, Math.floor(termWidth * 0.85));
    const leftPad = Math.floor((termWidth - boxWidth) / 2);

    const leftCol = Math.floor(boxWidth * 0.55);
    const rightCol = boxWidth - leftCol - 3;

    const border = this.stats.borderChars;

    const v = this.dim(border.v);
    const tl = this.dim(border.tl);
    const tr = this.dim(border.tr);
    const bl = this.dim(border.bl);
    const br = this.dim(border.br);
    const h = this.dim(border.h);

    // Build left column
    const leftLines: string[] = [
      "",
      "",
      ...this.artLines.map((line) => centerText(line, leftCol)),
      "",
      this.dim(this.center(this.tagline, leftCol)),
    ];

    // Build right column
    const rightLines: (string | undefined)[] = [
      this.bold(this.accent(shortenHome(this.stats.cwd))),
    ];

    if (this.stats.agentsPath) {
      rightLines.push(
        this.dim(`AGENT.md path: ${shortenHome(this.stats.agentsPath)}`),
      );
    }

    rightLines.push(
      this.dim(`${this.stats.extensions} extensions loaded`),
      this.dim(`${this.stats.skills} skills loaded`),
      this.dim(`${this.stats.tools} tools available`),
      this.dim(h.repeat(rightCol - 2)),
      this.bold(this.accent("Quick Tips")),
      this.dim("/ for commands"),
      this.dim("! to run bash"),
      this.dim("Esc cancel/abort"),
      this.dim("/quit to exit"),
      this.dim(h.repeat(rightCol - 2)),
      this.bold(this.accent("Navigation")),
      this.dim("Shift+Tab cycle thinking"),
      this.dim("Ctrl+P cycle model"),
      this.dim("Esc Esc open /tree"),
      this.dim(h.repeat(rightCol - 2)),
      this.bold(this.accent("Theme")),
      this.dim(this.stats.themeName),
    );

    const lines: string[] = [];

    // Top border
    lines.push(
      " ".repeat(leftPad) +
        tl +
        h.repeat(leftCol) +
        this.dim(border.tJunction) +
        h.repeat(rightCol) +
        tr,
    );

    // Content rows
    const maxRows = Math.max(leftLines.length, rightLines.length);
    for (let i = 0; i < maxRows; i++) {
      const left = padToWidth(leftLines[i] ?? "", leftCol);
      const right = padToWidth(rightLines[i] ?? "", rightCol);
      lines.push(" ".repeat(leftPad) + v + left + v + right + v);
    }

    // Bottom border
    lines.push(
      " ".repeat(leftPad) +
        bl +
        h.repeat(leftCol) +
        this.dim(border.bJunction) +
        h.repeat(rightCol) +
        br,
    );

    return lines;
  }

  private accent(text: string): string {
    return this.theme.fg("accent", text);
  }

  private bold(text: string): string {
    return this.theme.bold(text);
  }

  private dim(text: string): string {
    return this.theme.fg("dim", text);
  }

  private center(text: string, width: number): string {
    return centerText(text, width);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Extension
// ═══════════════════════════════════════════════════════════════════════════

export default function (pi: ExtensionAPI) {
  let activeHeader: SplashHeader | null = null;

  const artDir = path.join(
    process.env.HOME ?? process.env.USERPROFILE ?? "",
    ".pi",
    "agent",
    "art",
    "ascii.txt",
  );
  const artLines = loadArtFile(artDir);

  function dismiss() {
    if (activeHeader) {
      activeHeader = null;
    }
  }

  pi.on("session_start", async (_event, ctx) => {
    if (!ctx.hasUI) return;

    const isResume = ctx.sessionManager
      .getBranch()
      .some((e) => e.type === "message");

    if (isResume) return;

    const commands = pi.getCommands();

    const agentsPath = path.join(
      process.env.HOME ?? process.env.USERPROFILE ?? "",
      ".pi",
      "agent",
    );
    const agentsMdPath = path.join(agentsPath, "AGENTS.md");
    const agentsPathToShow = fs.existsSync(agentsMdPath) ? agentsMdPath : null;

    // Load border style and chars from splash.json config
    let borderStyle: BorderStyle = "solid";
    let borderChars: BorderChars = BORDER_CHARS.solid;
    let showDefaultStats = true;
    try {
      const splashConfigPath = path.join(agentsPath, "art", "splash.json");
      if (fs.existsSync(splashConfigPath)) {
        const config = JSON.parse(fs.readFileSync(splashConfigPath, "utf-8"));
        if (config.showDefaultStats !== undefined) {
          showDefaultStats = config.showDefaultStats;
        }
        if (
          config.border?.style &&
          BORDER_CHARS[config.border.style as BorderStyle]
        ) {
          borderStyle = config.border.style as BorderStyle;
          borderChars = BORDER_CHARS[borderStyle];
        }
        // Override with custom border chars if provided
        if (config._borderChars) {
          const style = config.border?.style ?? "solid";
          if (config._borderChars[style]) {
            borderChars = { ...borderChars, ...config._borderChars[style] };
          }
        }
      }
    } catch (e) {
      // Use defaults
    }

    let themeName = "dark";
    try {
      const settingsPath = path.join(agentsPath, "settings.json");
      if (fs.existsSync(settingsPath)) {
        const settings = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
        themeName = settings.theme ?? "dark";
      }
    } catch (e) {
      // Use default
    }

    const stats: SplashStats = {
      cwd: ctx.cwd,
      agentsPath: agentsPathToShow,
      themeName: themeName,
      borderStyle: borderStyle,
      borderChars: borderChars,
      showDefaultStats: showDefaultStats,
      extensions: commands.filter((c) => c.source === "extension").length,
      skills: commands.filter((c) => c.source === "skill").length,
      tools: pi.getAllTools().length,
    };

    ctx.ui.setHeader((tui: TUI, theme: Theme) => {
      activeHeader = new SplashHeader(theme, stats, artLines);
      return activeHeader;
    });

    // Hide default footer stats if configured
    if (!showDefaultStats) {
      ctx.ui.setFooter((_tui, _theme, _footerData) => ({
        render: () => [""],
        invalidate: () => {},
        dispose: () => {},
      }));
    }
  });

  pi.on("user_message", async () => {
    dismiss();
  });

  pi.on("session_shutdown", async (_event, ctx) => {
    dismiss();
    ctx.ui.setHeader(undefined);
  });
}
