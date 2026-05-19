/**
 * rtk-pi.ts — Minimal RTK integration for pi (v2)
 *
 * Hooks `tool_call` to call RTK subcommands directly for token savings.
 * Hooks `tool_result` to compact read tool output.
 * 
 * RTK provides 60-90% token savings on: git ops, file reads, build/test/lint output.
 * pi's built-in summarization is more aggressive than heuristics — so we bypass it
 * with direct RTK calls for maximum token savings.
 *
 * /rtk subcommands: show | verify | stats | clear-stats | reset | help
 *
 * Run with:
 *   pi --no-extensions -e ~/.pi/agent/extensions/rtk-pi.ts
 *
 * Requires: rtk binary installed (https://github.com/rtk-ai/rtk)
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { isToolCallEventType, type ExtensionAPI } from "@earendil-works/pi-coding-agent";

// ── config / persistence ─────────────────────────────────────────────────────

const CONFIG_DIR = resolve(getAgentDir(), "extensions", "rtk-pi");
const CONFIG_PATH = resolve(CONFIG_DIR, "config.json");
const STATS_PATH = resolve(CONFIG_DIR, "stats.json");

interface RtkConfig {
  enabled: boolean;
  mode: "rewrite" | "suggest";
  guardWhenRtkMissing: boolean;
  showRewriteNotifications: boolean;
  outputCompaction: {
    enabled: boolean;
    stripAnsi: boolean;
    readCompaction: {
      enabled: boolean;
    };
    truncate: {
      enabled: boolean;
      maxChars: number;
    };
    trackSavings: boolean;
  };
}

interface RtkStats {
  rewrites: number;
  compactions: number;
  charsSaved: number;
}

interface PersistedData {
  config: RtkConfig;
}

const DEFAULT_CONFIG: RtkConfig = {
  enabled: true,
  mode: "rewrite",
  guardWhenRtkMissing: true,
  showRewriteNotifications: false,
  outputCompaction: {
    enabled: true,
    stripAnsi: true,
    readCompaction: {
      enabled: true,
    },
    truncate: {
      enabled: true,
      maxChars: 12000,
    },
    trackSavings: true,
  },
};

const DEFAULT_STATS: RtkStats = {
  rewrites: 0,
  compactions: 0,
  charsSaved: 0,
};

function ensureConfigExists(): void {
  if (existsSync(CONFIG_PATH)) return;
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_PATH, `${JSON.stringify(DEFAULT_CONFIG, null, 2)}\n`, "utf-8");
}

function loadPersisted(): PersistedData {
  ensureConfigExists();
  if (!existsSync(CONFIG_PATH)) {
    return { config: DEFAULT_CONFIG };
  }
  try {
    const raw = readFileSync(CONFIG_PATH, "utf-8");
    const parsed = JSON.parse(raw) as Partial<PersistedData>;
    return { config: { ...DEFAULT_CONFIG, ...parsed.config } };
  } catch {
    return { config: DEFAULT_CONFIG };
  }
}

function loadStats(): RtkStats {
  if (!existsSync(STATS_PATH)) return { ...DEFAULT_STATS };
  try {
    const raw = readFileSync(STATS_PATH, "utf-8");
    const parsed = JSON.parse(raw) as Partial<RtkStats>;
    return { ...DEFAULT_STATS, ...parsed };
  } catch {
    return { ...DEFAULT_STATS };
  }
}

function saveStats(s: RtkStats): void {
  mkdirSync(CONFIG_DIR, { recursive: true });
  try {
    writeFileSync(STATS_PATH, `${JSON.stringify(s, null, 2)}\n`, "utf-8");
  } catch {
    // ignore write errors
  }
}

function savePersisted(data: PersistedData): void {
  ensureConfigExists();
  try {
    writeFileSync(CONFIG_PATH, `${JSON.stringify(data, null, 2)}\n`, "utf-8");
  } catch {
    // ignore write errors
  }
}

// ── utility functions ─────────────────────────────────────────────────────────

function stripAnsiFast(text: string): string {
  if (!text.includes("\x1b")) return text;
  return text.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "").replace(/\x1b\][0-9;]*(?:\x07|\x1b\\)/g, "");
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  if (maxLength < 3) return "...";
  return `${text.slice(0, maxLength - 3)}...`;
}

function normalizeCommand(command: string): string | null {
  const firstLine = command.split(/\r?\n/).map(l => l.trim()).find(l => l.length > 0);
  if (!firstLine) return null;
  return firstLine.replace(/^[A-Za-z_][A-Za-z0-9_]*=(?:"[^"]*"|'[^']*'|[^\s]+)\s+/, "").trim().split(/\s*(?:&&|\|\||;|\|)\s*/)[0] ?? firstLine;
}

// ── read tool compaction ─────────────────────────────────────────────────────

const PRESERVE_EXACT_LINE_THRESHOLD = 80;
const SMART_TRUNCATE_LINE_THRESHOLD = 220;

function detectLanguage(filePath: string): string {
  const lastDot = filePath.lastIndexOf(".");
  if (lastDot === -1) return "";
  const ext = filePath.slice(lastDot).toLowerCase();
  return ext.replace(/^\.+/, "");
}

function isSkillPath(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, "/");
  const skillRoots = [".pi/skills", ".agents/skills", "skills"];
  return skillRoots.some(root => normalized.includes(`/${root}/`));
}

function compactReadOutput(text: string, filePath: string): { text: string; changed: boolean } {
  const lines = text.split("\n");
  const lineCount = lines.length;
  const ext = detectLanguage(filePath);

  if (lineCount <= PRESERVE_EXACT_LINE_THRESHOLD) {
    return { text, changed: false };
  }

  if (lineCount > SMART_TRUNCATE_LINE_THRESHOLD) {
    const truncated = lines.slice(0, SMART_TRUNCATE_LINE_THRESHOLD).join("\n");
    const extPart = ext ? ` .${ext}` : "";
    const banner = `[RTK read${extPart}: ${lineCount}→${SMART_TRUNCATE_LINE_THRESHOLD}]`;
    return { text: `${banner}\n${truncated}`, changed: true };
  }

  return { text, changed: false };
}

// ── RTK direct call patterns ──────────────────────────────────────────────────

interface RtkPattern {
  match: (cmd: string) => string | null;  // returns RTK args if matched, null if not
  category: string;
}

const RTK_PATTERNS: RtkPattern[] = [
  // git operations — ultra compact (e.g., "ok main")
  {
    category: "git",
    match: (cmd) => {
      if (/^git\s+(push|commit|pull|add|stage)\b/.test(cmd)) {
        const sub = cmd.replace(/^git\s+/, "").trim();
        return `git ${sub}`;
      }
      return null;
    },
  },
  // git status/diff/log — compact but readable
  {
    category: "git",
    match: (cmd) => {
      if (/^git\s+(status|diff|log|stash|branch|fetch)\b/.test(cmd)) {
        const sub = cmd.replace(/^git\s+/, "").trim();
        return `git ${sub}`;
      }
      return null;
    },
  },
  // JSON files — keys only
  {
    category: "json",
    match: (cmd) => {
      const m = cmd.match(/^cat\s+(\S+\.json)\s*$/);
      if (m) return `json ${m[1]} --keys-only`;
      return null;
    },
  },
  // ls commands — compact tree
  {
    category: "ls",
    match: (cmd) => {
      if (/^ls\s*(-\w+\s*)*$/.test(cmd.trim())) {
        return "ls";
      }
      return null;
    },
  },
  // find — compact tree output
  {
    category: "find",
    match: (cmd) => {
      if (/^find\s+/.test(cmd)) {
        return cmd.replace(/^find\s+/, "find ");
      }
      return null;
    },
  },
  // build commands — errors only
  {
    category: "build",
    match: (cmd) => {
      if (/^(?:npm|pnpm|yarn|bun)\s+run\s+(?:build|dev|start|preview)\b/.test(cmd)) {
        return `err ${cmd}`;
      }
      if (/^cargo\s+(?:build|check)\b/.test(cmd)) {
        return `err ${cmd}`;
      }
      return null;
    },
  },
  // test commands — failures only
  {
    category: "test",
    match: (cmd) => {
      if (/^(?:npm|pnpm|yarn|bun)\s+test\b/.test(cmd)) return `test ${cmd}`;
      if (/^cargo\s+test\b/.test(cmd)) return `test ${cmd}`;
      if (/^pytest\b/.test(cmd)) return `test ${cmd}`;
      if (/^go\s+test\b/.test(cmd)) return `test ${cmd}`;
      return null;
    },
  },
  // lint commands — grouped errors
  {
    category: "lint",
    match: (cmd) => {
      if (/^(?:npm|pnpm|yarn|bun)\s+run\s+lint\b/.test(cmd)) return "lint";
      if (/^ruff\s+check\b/.test(cmd)) return "lint";
      if (/^eslint\b/.test(cmd)) return "lint";
      if (/^mypy\b/.test(cmd)) return "lint";
      return null;
    },
  },
  // npm/pnpm/yarn/cargo general — use rtk wrapper
  {
    category: "npm",
    match: (cmd) => {
      if (/^(?:npm|pnpm|yarn|bun)\s+(?!run\s+(?:build|dev|start|preview|test|lint))/i.test(cmd)) {
        return cmd;  // pass through to rtk for npm/pnpm/yarn
      }
      return null;
    },
  },
  // cat (non-json) — rtk read
  {
    category: "read",
    match: (cmd) => {
      const m = cmd.match(/^cat\s+(\S+)\s*$/);
      if (m && !m[1].endsWith(".json")) return `read ${m[1]}`;
      return null;
    },
  },
];

function matchRtkPattern(command: string): { rtkArgs: string; category: string } | null {
  for (const pattern of RTK_PATTERNS) {
    const rtkArgs = pattern.match(command);
    if (rtkArgs !== null) {
      return { rtkArgs, category: pattern.category };
    }
  }
  return null;
}

// ── stats tracking (persisted to stats.json) ─────────────────────────────────

let stats = loadStats();

function incrementStats(patch: Partial<RtkStats>): void {
  stats = { ...stats, ...patch };
  saveStats(stats);
}

// ── main extension ────────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
  const { config } = loadPersisted();

  function rtkStatusLine(): string {
    return `**RTK Status:** ${config.enabled ? "enabled" : "disabled"} | mode: ${config.mode} | rewrites: ${stats.rewrites} | compactions: ${stats.compactions} | chars saved: ${stats.charsSaved}`;
  }

  function rtkVerifyOutput(): string {
    const { execSync } = require("child_process");
    try {
      const v = execSync("rtk --version", { timeout: 5000 }).toString().trim();
      return `**RTK:** ${v} — available at PATH`;
    } catch {
      return `**RTK:** not found in PATH`;
    }
  }

  // ── /rtk command ─────────────────────────────────────────────────────────

  pi.registerCommand("rtk", {
    description: "RTK integration: show | verify | stats | clear-stats | reset | help",
    getArgumentCompletions: () => [
      { value: "show", label: "show" },
      { value: "verify", label: "verify" },
      { value: "stats", label: "stats" },
      { value: "clear-stats", label: "clear-stats" },
      { value: "reset", label: "reset" },
      { value: "help", label: "help" },
    ],
    handler: async (args, ctx) => {
      const cmd = args.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
      let output = "";

      switch (cmd) {
        case "show": { output = rtkStatusLine(); break; }
        case "verify": { output = rtkVerifyOutput(); break; }
        case "stats": {
          output = `**RTK Stats:**\n- rewrites: ${stats.rewrites}\n- compactions: ${stats.compactions}\n- chars saved: ${stats.charsSaved}`;
          break;
        }
        case "clear-stats": {
          stats = { ...DEFAULT_STATS };
          saveStats(stats);
          output = "**RTK Stats:** cleared to zero";
          break;
        }
        case "reset": {
          const data = loadPersisted();
          data.config = { ...DEFAULT_CONFIG };
          savePersisted(data);
          output = "**RTK:** config reset to defaults";
          break;
        }
        case "help":
        default: {
          output = "**RTK Commands:**\n`/rtk show` — status & mode\n`/rtk verify` — check rtk binary\n`/rtk stats` — lifetime stats\n`/rtk clear-stats` — reset counters\n`/rtk reset` — reset config\n`/rtk help` — this help";
          break;
        }
      }

      pi.sendMessage({ customType: "rtk-pi", content: output, display: true });
      ctx.ui.notify(`RTK / ${cmd || "help"}`, "info");
    },
  });

  // ── session_start ─────────────────────────────────────────────────────────

  pi.on("session_start", async (_event, ctx) => {
    if (config.showRewriteNotifications && ctx.hasUI) {
      ctx.ui.notify("rtk-pi v2 loaded", "info");
    }
  });

  // ── tool_call: direct RTK calls for token savings ─────────────────────────

  pi.on("tool_call", async (event, ctx) => {
    if (!config.enabled || config.mode !== "rewrite") return;
    if (!isToolCallEventType("bash", event)) return;

    const command = event.input.command;
    if (!command?.trim()) return;
    if (command.trim().startsWith("rtk ")) return;  // skip if already RTK
    if (/\brm\s+(-[rf][fr]?)\b/.test(command)) return;  // safety guard

    const match = matchRtkPattern(command);
    if (!match) return;  // no RTK pattern — let bash execute normally

    const { rtkArgs, category } = match;

    // Mutate the bash command to use RTK directly
    // RTK's output is already compact (60-90% token savings vs raw)
    // pi's summarization will then summarize this compact output
    event.input.command = `rtk ${rtkArgs}`;
    incrementStats({ rewrites: stats.rewrites + 1 });

    if (config.showRewriteNotifications && ctx.hasUI) {
      const orig = command.length > 40 ? `${command.slice(0, 37)}...` : command;
      const rtk = `rtk ${rtkArgs}`.length > 50 ? `rtk ${rtkArgs}`.slice(0, 47) + "..." : `rtk ${rtkArgs}`;
      ctx.ui.notify(`RTK: ${orig} → ${rtk}`, "info");
    }
  });

  // ── tool_result: read tool compaction only ─────────────────────────────────

  pi.on("tool_result", async (event) => {
    if (!config.enabled || !config.outputCompaction.enabled) return;
    if (event.toolName !== "read") return;
    if (!config.outputCompaction.readCompaction.enabled) return;

    const content = event.content;
    if (!content || !Array.isArray(content)) return;

    const textBlocks = content.filter((c): c is { type: "text"; text: string } => c.type === "text" && typeof c.text === "string");
    if (textBlocks.length === 0) return;

    const originalText = textBlocks.map(b => b.text).join("\n");
    const input = event.input as Record<string, unknown>;
    const filePath = typeof input.path === "string" ? input.path : "";

    // Preserve skill reads
    if (filePath && isSkillPath(filePath)) return;

    const result = compactReadOutput(originalText, filePath);
    if (!result.changed) return;

    incrementStats({ compactions: stats.compactions + 1 });
    if (config.outputCompaction.trackSavings) {
      incrementStats({ charsSaved: stats.charsSaved + (originalText.length - result.text.length) });
    }

    return { content: [{ type: "text", text: result.text }] };
  });
}