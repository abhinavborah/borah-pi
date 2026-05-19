/**
 * rtk-pi.ts — Minimal RTK integration for pi
 *
 * Hooks `tool_call` to rewrite bash commands via `rtk rewrite`.
 * Hooks `tool_result` to compact bash/grep/read output with heuristic filters.
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
    aggregateTestOutput: boolean;
    filterBuildOutput: boolean;
    compactGitOutput: boolean;
    aggregateLinterOutput: boolean;
    groupSearchOutput: boolean;
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
    aggregateTestOutput: true,
    filterBuildOutput: true,
    compactGitOutput: true,
    aggregateLinterOutput: true,
    groupSearchOutput: true,
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

// ── output compaction techniques ─────────────────────────────────────────────

function stripAnsiFast(text: string): string {
  if (!text.includes("\x1b")) return text;
  return text.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "").replace(/\x1b\][0-9;]*(?:\x07|\x1b\\)/g, "");
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  if (maxLength < 3) return "...";
  return `${text.slice(0, maxLength - 3)}...`;
}

// ── read tool compaction ─────────────────────────────────────────────────────

const PRESERVE_EXACT_LINE_THRESHOLD = 80;
const SMART_TRUNCATE_LINE_THRESHOLD = 220;

/**
 * Detect language from file extension. Used for the truncation banner.
 */
function detectLanguage(filePath: string): string {
  const lastDot = filePath.lastIndexOf(".");
  if (lastDot === -1) return "";
  const ext = filePath.slice(lastDot).toLowerCase();
  return ext.replace(/^\.+/, "");
}

/**
 * Check if a path is under a skills directory (should preserve exact reads).
 */
function isSkillPath(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, "/");
  const skillRoots = [".pi/skills", ".agents/skills", "skills"];
  return skillRoots.some(root => normalized.includes(`/${root}/`));
}

/**
 * Compact read tool output: plain line truncation with RTK-style banner.
 * - Files <= 80 lines: pass through unchanged
 * - Files 81-220 lines: pass through unchanged (within threshold)
 * - Files > 220 lines: truncate to 220, show banner
 */
function compactReadOutput(text: string, filePath: string): { text: string; changed: boolean } {
  const lines = text.split("\n");
  const lineCount = lines.length;
  const ext = detectLanguage(filePath);

  // Preserve exact output for short files
  if (lineCount <= PRESERVE_EXACT_LINE_THRESHOLD) {
    return { text, changed: false };
  }

  // Plain truncation to SMART_TRUNCATE_LINE_THRESHOLD — aligns with RTK's --max-lines
  if (lineCount > SMART_TRUNCATE_LINE_THRESHOLD) {
    const truncated = lines.slice(0, SMART_TRUNCATE_LINE_THRESHOLD).join("\n");
    const extPart = ext ? ` .${ext}` : "";
    const banner = `[RTK read${extPart}: ${lineCount}→${SMART_TRUNCATE_LINE_THRESHOLD}]`;
    return { text: `${banner}\n${truncated}`, changed: true };
  }

  // Files 81-220 lines: pass through unchanged
  return { text, changed: false };
}

function normalizeCommand(command: string): string | null {
  const firstLine = command.split(/\r?\n/).map(l => l.trim()).find(l => l.length > 0);
  if (!firstLine) return null;
  return firstLine.replace(/^[A-Za-z_][A-Za-z0-9_]*=(?:"[^"]*"|'[^']*'|[^\s]+)\s+/, "").trim().split(/\s*(?:&&|\|\||;|\|)\s*/)[0] ?? firstLine;
}

function isGitCommand(cmd: string | null): boolean {
  return /^git\s+(diff|status|log|show|stash)\b/.test(cmd ?? "");
}

function isBuildCommand(cmd: string | null): boolean {
  return /^(?:cargo\s+(?:build|check)|bun\s+build|npm\s+run\s+build|yarn\s+build|pnpm\s+build|(?:npx\s+)?tsc|make|cmake|gradle|mvn|go\s+(?:build|install))\b/.test(cmd ?? "");
}

function isTestCommand(cmd: string | null): boolean {
  return /^(?:npm|pnpm|yarn|bun|cargo|go|pytest|python\s+-m\s+pytest|(?:pnpm\s+)?(?:npx\s+)?vitest|(?:npx\s+)?jest|mocha|ava|tap)\s+test\b/.test(cmd ?? "");
}

function isLinterCommand(cmd: string | null): boolean {
  return /^(?:(?:pnpm\s+)?(?:npx\s+)?eslint|ruff|pylint|mypy|flake8|black|cargo\s+clippy|golangci-lint)\b/.test(cmd ?? "");
}

function compactGitOutput(output: string, command: string | null): string | null {
  if (!isGitCommand(command)) return null;

  if (command?.startsWith("git diff")) {
    const lines = output.split("\n");
    const result: string[] = [];
    let currentFile = "";
    let added = 0, removed = 0, inHunk = false, hunkLines = 0;
    const maxLines = 50, maxHunkLines = 8;

    for (const line of lines) {
      if (result.length >= maxLines) { result.push("\n... (more changes truncated)"); break; }
      if (line.startsWith("diff --git")) {
        if (currentFile && (added > 0 || removed > 0)) result.push(`  +${added} -${removed}`);
        const match = line.match(/diff --git a\/(.+) b\/(.+)/);
        currentFile = match?.[2] ?? "unknown";
        result.push(`\n> ${currentFile}`);
        added = removed = 0; inHunk = false; continue;
      }
      if (line.startsWith("@@")) { inHunk = true; hunkLines = 0; result.push(`  ${line.match(/@@ .+ @@/)?.[0] ?? "@@"}`); continue; }
      if (!inHunk) continue;
      if (line.startsWith("+") && !line.startsWith("+++")) { added++; if (hunkLines < maxHunkLines) { result.push(`  ${line}`); hunkLines++; } }
      else if (line.startsWith("-") && !line.startsWith("---")) { removed++; if (hunkLines < maxHunkLines) { result.push(`  ${line}`); hunkLines++; } }
      else if (hunkLines < maxHunkLines && !line.startsWith("\\") && hunkLines > 0) { result.push(`  ${line}`); hunkLines++; }
      if (hunkLines === maxHunkLines) { result.push("  ... (truncated)"); hunkLines++; }
    }
    if (currentFile && (added > 0 || removed > 0)) result.push(`  +${added} -${removed}`);
    return result.length > 0 ? result.join("\n") : null;
  }

  if (command?.startsWith("git status")) {
    const lines = output.split("\n");
    let branch = "";
    let staged = 0, modified = 0, untracked = 0;
    for (const line of lines) {
      if (line.startsWith("##")) { branch = line.match(/## (.+)/)?.[1]?.split("...")[0] ?? ""; }
      else if (line.length >= 3) {
        const s = line.slice(0, 2);
        if (["M","A","D","R","C"].some(c => s[0] === c)) staged++;
        if (["M","D"].some(c => s[1] === c)) modified++;
        if (s === "??") untracked++;
      }
    }
    if (staged === 0 && modified === 0 && untracked === 0) return "Clean working tree";
    let result = `Branch: ${branch}\n`;
    if (staged > 0) result += `Staged: ${staged}\n`;
    if (modified > 0) result += `Modified: ${modified}\n`;
    if (untracked > 0) result += `Untracked: ${untracked}\n`;
    return result.trim();
  }

  return null;
}

function filterBuildOutput(output: string, command: string | null): string | null {
  if (!isBuildCommand(command)) return null;

  const lines = output.split("\n");
  const st = { compiled: 0, errors: [] as string[][], warnings: [] as string[], inError: false, currentError: [] as string[] };

  for (const line of lines) {
    if (/^\s*(Compiling|Checking|Downloading|Building)\s+/.test(line)) { st.compiled++; continue; }
    if (/^\s*(Downloaded|Fetched|Updated|Generated|Creating|Running)\s+/.test(line)) continue;
    if (/^error\[|^error:|^FAIL/.test(line)) {
      if (st.inError && st.currentError.length > 0) st.errors.push([...st.currentError]);
      st.inError = true; st.currentError = [line]; continue;
    }
    if (/^warning:/.test(line)) { st.warnings.push(line); continue; }
    if (!st.inError) continue;
    if (line.trim() === "") {
      if (st.currentError.length > 3) { st.errors.push([...st.currentError]); st.inError = false; st.currentError = []; }
      else st.currentError.push(line);
    } else if (/^\s/.test(line)) { st.currentError.push(line); }
    else { st.errors.push([...st.currentError]); st.inError = false; st.currentError = []; }
  }
  if (st.inError && st.currentError.length > 0) st.errors.push(st.currentError);

  if (st.errors.length === 0 && st.warnings.length === 0) return `[OK] Build successful (${st.compiled} units)`;

  let result = "";
  if (st.errors.length > 0) {
    result += `[ERROR] ${st.errors.length} error(s):\n`;
    for (const err of st.errors.slice(0, 5)) {
      result += err.slice(0, 10).join("\n") + "\n";
      if (err.length > 10) result += "  ...\n";
    }
    if (st.errors.length > 5) result += `... +${st.errors.length - 5} more\n`;
  }
  if (st.warnings.length > 0) result += `\n[WARN] ${st.warnings.length} warning(s)\n`;
  return result.trim() || null;
}

function aggregateTestOutput(output: string, command: string | null): string | null {
  if (!isTestCommand(command)) return null;
  const passedMatch = output.match(/(?:(\d+)\s*passed|tests?:\s*(\d+)\s*passed)/i);
  const failedMatch = output.match(/(?:(\d+)\s*failed|FAIL|FAILED|\s*●\s+|\s*✕\s+)/i);
  const passed = passedMatch ? parseInt(passedMatch[1] || passedMatch[2] || "0", 10) : 0;
  const failed = failedMatch ? 1 : 0;
  if (failed > 0) {
    const failureLines = output.split("\n").filter(l => /FAIL|FAILED|\s*●\s+|\s*✕\s+/.test(l)).slice(0, 5);
    return `Test Results: FAIL: ${failed}, PASS: ${passed}\nFailures:\n` + failureLines.map(l => `  - ${l.trim().slice(0, 80)}`).join("\n");
  }
  return `[OK] Tests passed (${passed})`;
}

function aggregateLinterOutput(output: string, command: string | null): string | null {
  if (!isLinterCommand(command)) return null;
  const errors: { file: string; line: number; msg: string }[] = [];
  for (const line of output.split("\n")) {
    const m = line.match(/^(.+?):(\d+):\d+:\s*(.+)$/);
    if (m) errors.push({ file: m[1], line: parseInt(m[2], 10), msg: m[3] });
  }
  if (errors.length === 0) return "[OK] No issues found";
  const byFile = new Map<string, number>();
  for (const e of errors) byFile.set(e.file, (byFile.get(e.file) ?? 0) + 1);
  return `${errors.length} issue(s) in ${byFile.size} file(s): ` +
    Array.from(byFile.entries()).slice(0, 3).map(([f, c]) => `${f.split("/").pop()} (${c})`).join(", ");
}

function groupSearchOutput(output: string): string | null {
  const results: { file: string; line: string; content: string }[] = [];
  for (const line of output.split("\n")) {
    const m = line.match(/^(.+?):(\d+):(.+)$/);
    if (m) results.push({ file: m[1], line: m[2], content: m[3] });
  }
  if (results.length === 0) return null;
  const byFile = new Map<string, typeof results>();
  for (const r of results) { const existing = byFile.get(r.file) ?? []; existing.push(r); byFile.set(r.file, existing); }
  let result = `${results.length} matches in ${byFile.size} files:\n`;
  for (const [file, matches] of Array.from(byFile.entries()).slice(0, 10)) {
    result += `> ${file.split("/").pop()} (${matches.length}):\n`;
    for (const m of matches.slice(0, 5)) result += `  ${m.line}: ${m.content.trim().slice(0, 60)}\n`;
    if (matches.length > 5) result += `  +${matches.length - 5} more\n`;
  }
  return result;
}

// ── compaction engine ─────────────────────────────────────────────────────────

interface CompactionResult {
  changed: boolean;
  text: string;
  techniques: string[];
}

function compactBashOutput(text: string, command: string | null, config: RtkConfig): CompactionResult {
  let result = text;
  const techniques: string[] = [];

  if (config.outputCompaction.stripAnsi) {
    const stripped = stripAnsiFast(result);
    if (stripped !== result) { result = stripped; techniques.push("ansi"); }
  }

  const compactGit = compactGitOutput(result, command);
  if (compactGit !== null) return { changed: true, text: compactGit, techniques: [...techniques, "git"] };

  const filterBuild = filterBuildOutput(result, command);
  if (filterBuild !== null) return { changed: true, text: filterBuild, techniques: [...techniques, "build"] };

  const testOutput = aggregateTestOutput(result, command);
  if (testOutput !== null) return { changed: true, text: testOutput, techniques: [...techniques, "test"] };

  const linterOutput = aggregateLinterOutput(result, command);
  if (linterOutput !== null) return { changed: true, text: linterOutput, techniques: [...techniques, "linter"] };

  if (config.outputCompaction.truncate.enabled && result.length > config.outputCompaction.truncate.maxChars) {
    result = truncate(result, config.outputCompaction.truncate.maxChars);
    techniques.push("truncate");
  }

  return { changed: techniques.length > 0, text: result, techniques };
}

function compactGrepOutput(text: string, config: RtkConfig): CompactionResult {
  let result = text;
  const techniques: string[] = [];

  if (config.outputCompaction.stripAnsi) {
    const stripped = stripAnsiFast(result);
    if (stripped !== result) { result = stripped; techniques.push("ansi"); }
  }

  if (config.outputCompaction.groupSearchOutput) {
    const grouped = groupSearchOutput(result);
    if (grouped !== null) { result = grouped; techniques.push("search"); }
  }

  if (config.outputCompaction.truncate.enabled && result.length > config.outputCompaction.truncate.maxChars) {
    result = truncate(result, config.outputCompaction.truncate.maxChars);
    techniques.push("truncate");
  }

  return { changed: techniques.length > 0, text: result, techniques };
}

// ── stats tracking (persisted to stats.json) ──────────────────────────────────────

let stats = loadStats();

function incrementStats(patch: Partial<RtkStats>): void {
  stats = { ...stats, ...patch };
  saveStats(stats);
}

// ── main extension ────────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
  const { config } = loadPersisted();

  // ── rtk command helpers (must be inside factory to close over config + stats) ──
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

      // Inject visible message into session (display: true so it's shown in TUI/output)
      pi.sendMessage({ customType: "rtk-pi", content: output, display: true });
      // Note: in print mode, custom messages with display:true are emitted via
      // session.subscribe() but not included in text output. See JSON mode for verification.
      ctx.ui.notify(`RTK / ${cmd || "help"}`, "info");
    },
  });

  // ── session_start ─────────────────────────────────────────────────────────

  pi.on("session_start", async (_event, ctx) => {
    if (config.showRewriteNotifications && ctx.hasUI) {
      ctx.ui.notify("rtk-pi loaded", "info");
    }
  });

  // ── tool_call: rewrite bash commands ──────────────────────────────────────

  pi.on("tool_call", async (event, ctx) => {
    if (!config.enabled || config.mode !== "rewrite") return;
    if (!isToolCallEventType("bash", event)) return;

    const command = event.input.command;
    if (!command?.trim()) return;
    if (/\brm\s+(-[rf][fr]?)\b/.test(command)) return;
    if (command.trim().startsWith("rtk ")) return;

    // Use execSync via shell to invoke rtk rewrite — pi.exec uses shell:false
    // which can't execute JS CLI files relying on shebang resolution.
    const { execSync } = require("child_process");
    let rewritten = "";
    try {
      rewritten = execSync(`rtk rewrite ${JSON.stringify(command)}`, { timeout: 3000 }).toString().trim();
    } catch (e) {
      const err = e as NodeJS.ErrnoException & { stdout: Buffer };
      const code = err.status;
      if (code === 3) {
        // rtk exits code 3 with rewritten command on stdout
        rewritten = err.stdout.toString().trim();
      } else if (code === 1 || !code) {
        return; // No rewrite or silent failure — skip
      } else {
        ctx.ui.notify(`RTK rewrite error (code ${code})`, "warning");
        return;
      }
    }


    if (!rewritten || rewritten === command) return;

    // Apply rewrite
    event.input.command = rewritten;
    incrementStats({ rewrites: stats.rewrites + 1 });

    if (config.showRewriteNotifications && ctx.hasUI) {
      const orig = command.length > 40 ? `${command.slice(0, 37)}...` : command;
      const repl = rewritten.length > 50 ? `${rewritten.slice(0, 47)}...` : rewritten;
      ctx.ui.notify(`RTK: ${orig} → ${repl}`, "info");
    }
  });

  // ── tool_result: compact output ──────────────────────────────────────────

  pi.on("tool_result", async (event) => {
    if (!config.enabled || !config.outputCompaction.enabled) return;

    const content = event.content;
    if (!content || !Array.isArray(content)) return;

    const textBlocks = content.filter((c): c is { type: "text"; text: string } => c.type === "text" && typeof c.text === "string");
    if (textBlocks.length === 0) return;

    const originalText = textBlocks.map(b => b.text).join("\n");
    let compactedText = originalText;
    const techniques: string[] = [];

    if (event.toolName === "bash") {
      const input = event.input as Record<string, unknown>;
      const command = typeof input.command === "string" ? normalizeCommand(input.command) : null;
      const result = compactBashOutput(compactedText, command, config);
      compactedText = result.text;
      techniques.push(...result.techniques);
    } else if (event.toolName === "grep") {
      const result = compactGrepOutput(compactedText, config);
      compactedText = result.text;
      techniques.push(...result.techniques);
    } else if (event.toolName === "read" && config.outputCompaction.readCompaction.enabled) {
      const input = event.input as Record<string, unknown>;
      const filePath = typeof input.path === "string" ? input.path : "";
      if (filePath && isSkillPath(filePath)) return; // preserve skill reads
      const result = compactReadOutput(compactedText, filePath);
      if (result.changed) techniques.push("read");
      compactedText = result.text;
    }

    if (techniques.length === 0) return;

    incrementStats({ compactions: stats.compactions + 1 });
    if (config.outputCompaction.trackSavings && originalText.length > compactedText.length) {
      incrementStats({ charsSaved: stats.charsSaved + (originalText.length - compactedText.length) });
    }

    // Return partial patch — content only (runner merges the rest)
    return { content: [{ type: "text", text: compactedText }] };
  });
}