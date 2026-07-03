/**
 * Composed Footer Extension
 *
 * Replaces pi's default footer with a Claude-style statusline:
 * [plugin badges] [padded right] cwd | git branch | model | ctx% | token totals
 *
 * Optionally renders a second line with per-tool invocation counts
 * (folded from the dormant tool-counter-footer.ts).
 *
 * Plugin badges are pulled via footerData.getExtensionStatuses() and projected
 * through a fixed BADGE_ORDER. Currently rendered (in order):
 *   - agent-id   (self-registered in session_start)
 *   - theme      (theme-cycler)
 *   - mcp        (self-registered in session_start)
 *   - rtk        (pi-rtk-optimizer)
 *   - ponytail   (ponytail)
 *   - caveman    (pi-caveman)
 *   - om         (pi-observational-memory)
 *
 * Color palette mirrors ~/.claude/statusline.sh (p10k-inspired):
 *   cwd=31  branch=76  model=244  sep=238  ctx high=76  ctx mid=178  ctx low=196
 *   worktree=178 (yellow)  tools line=244 (muted)  tool totals=31 (accent)
 *
 * Toggle: /composed-footer
 */

import type { AssistantMessage, ToolCall } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { homedir } from "node:os";

const execAsync = promisify(exec);

// p10k color palette (matches ~/.claude/statusline.sh)
const C = {
	cwd: 31,        // blue
	branch: 76,     // green
	worktree: 178,  // yellow — distinguishes worktree branch from main
	model: 244,     // dim gray
	sep: 238,       // dim separator
	ctxHigh: 76,    // green ≥40%
	ctxMid: 178,    // yellow 20-40%
	ctxLow: 196,    // red <20%
	dim: 244,       // muted text
	accent: 31,     // accent for tool totals
	warn: 208,      // orange for MCP calls
} as const;

function ansi(code: number, text: string): string {
	return `\x1b[38;5;${code}m${text}\x1b[0m`;
}

// ---------------------------------------------------------------------------
// Tool call counting (folded from extensions/tool-counter-footer.ts)
// ---------------------------------------------------------------------------

interface ToolStats {
	totalInvocations: number;
	byTool: Record<string, number>;
	mcpCalls: number;
	mcpServers: Set<string>;
}

const COMMON_TOOLS = ["bash", "read", "write", "edit", "grep", "find", "ls"] as const;
const BUILTIN_TOOL_SET: ReadonlySet<string> = new Set(COMMON_TOOLS);
const SKIP_FIRST_PARTS = new Set(["offset", "limit", "path", "command", "pattern", "options"]);

function detectMcpToolNames(allTools: Array<{ name: string; sourceInfo?: { source: string } }>): Set<string> {
	const mcpNames = new Set<string>();
	for (const tool of allTools) {
		// Source-tagged MCP/extension tools
		if (tool.sourceInfo && tool.sourceInfo.source !== "builtin" && tool.sourceInfo.source !== "sdk") {
			mcpNames.add(tool.name);
			continue;
		}
		// Heuristic: server_tool pattern where first part isn't a builtin-tool option
		if (
			tool.name.includes("_") &&
			!BUILTIN_TOOL_SET.has(tool.name) &&
			!tool.name.includes("__")
		) {
			const firstPart = tool.name.split("_")[0];
			if (!SKIP_FIRST_PARTS.has(firstPart)) {
				mcpNames.add(tool.name);
			}
		}
	}
	return mcpNames;
}

function countTools(entries: unknown[], mcpToolNames: Set<string>): ToolStats {
	const stats: ToolStats = {
		totalInvocations: 0,
		byTool: {},
		mcpCalls: 0,
		mcpServers: new Set(),
	};

	for (const e of entries as Array<{ type: string; message?: { role: string; content?: unknown[] } }>) {
		if (e.type !== "message" || !e.message || e.message.role !== "assistant") continue;
		const m = e.message as AssistantMessage;
		for (const block of m.content) {
			if (block.type !== "toolCall") continue;
			const tc = block as ToolCall;
			stats.totalInvocations++;
			stats.byTool[tc.name] = (stats.byTool[tc.name] || 0) + 1;

			const isMcp = mcpToolNames.has(tc.name) || tc.name.includes("__");
			if (!isMcp) continue;
			stats.mcpCalls++;
			const parts = tc.name.split("__");
			const server = parts[0] === "mcp" ? parts[1] : parts[0];
			stats.mcpServers.add(server);
		}
	}

	return stats;
}

// ---------------------------------------------------------------------------
// Worktree detection
// ---------------------------------------------------------------------------

interface WorktreeInfo {
	inWorktree: boolean;
	branch: string | null;
}

async function detectWorktree(cwd: string): Promise<WorktreeInfo> {
	try {
		const { stdout } = await execAsync(
			`git -C ${JSON.stringify(cwd)} worktree list --porcelain`,
			{ timeout: 2000 },
		);
		const blocks = stdout.split("\n\n").map((b) => b.trim()).filter(Boolean);
		if (blocks.length <= 1) return { inWorktree: false, branch: null };

		for (let i = 0; i < blocks.length; i++) {
			const block = blocks[i];
			const pathLine = block.split("\n").find((l) => l.startsWith("worktree "));
			if (!pathLine) continue;
			const path = pathLine.slice("worktree ".length);
			if (!cwd.startsWith(path)) continue;

			// First block is the main worktree; rest are worktrees
			if (i === 0) return { inWorktree: false, branch: null };

			const branchLine = block.split("\n").find((l) => l.startsWith("branch "));
			const headLine = block.split("\n").find((l) => l.startsWith("HEAD "));
			const branch = branchLine
				? branchLine.slice("branch ".length).replace("refs/heads/", "")
				: headLine?.slice("HEAD ".length, "HEAD ".length + 7) ?? null;
			return { inWorktree: true, branch };
		}
		return { inWorktree: false, branch: null };
	} catch {
		// Not a git repo, git not available, or not a worktree — fail silent
		return { inWorktree: false, branch: null };
	}
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(n: number): string {
	return n < 1000 ? `${n}` : `${(n / 1000).toFixed(1)}k`;
}

function abbreviateHome(cwd: string): string {
	const home = homedir();
	return cwd.startsWith(home) ? "~" + cwd.slice(home.length) : cwd;
}

function colorForCtxPct(remaining: number): number {
	if (remaining >= 40) return C.ctxHigh;
	if (remaining >= 20) return C.ctxMid;
	return C.ctxLow;
}

// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------

export default function composedFooter(pi: ExtensionAPI) {
	let enabled = true;
	let worktreeInfo: WorktreeInfo = { inWorktree: false, branch: null };

	async function refreshWorktree(cwd: string): Promise<void> {
		worktreeInfo = await detectWorktree(cwd);
	}

	pi.on("session_start", async (_event, ctx) => {
		await refreshWorktree(ctx.cwd);

		// Register our own status keys so they appear in the badge bar.
		// agent-id: short session UUID (8 hex chars). mcp: count of MCP servers
		// registered on this session. Both are static for the session lifetime
		// (MCP server set is loaded at boot, not mutated mid-session).
		if (ctx.ui?.setStatus) {
			const sessionId = ctx.sessionManager?.getSessionId?.() ?? "";
			const shortId = sessionId ? sessionId.slice(0, 8) : "no-id";
			ctx.ui.setStatus("agent-id", `agent:${shortId}`);

			const mcpServers = new Set<string>();
			for (const tool of pi.getAllTools()) {
				const name = tool.name;
				if (!name.includes("__")) continue;
				const parts = name.split("__");
				const server = parts[0] === "mcp" ? parts[1] : parts[0];
				if (server) mcpServers.add(server);
			}
			ctx.ui.setStatus(
				"mcp",
				mcpServers.size > 0 ? `mcp:${mcpServers.size}` : "mcp:0",
			);
		}

		if (enabled) enableFooter(pi, ctx);
	});

	function enableFooter(_pi: ExtensionAPI, _ctx: import("@earendil-works/pi-coding-agent").ExtensionContext) {
		_ctx.ui.setFooter((tui, _theme, footerData) => {
			const unsubBranch = footerData.onBranchChange(() => {
				refreshWorktree(_ctx.cwd).then(() => tui.requestRender());
			});

			return {
				dispose: unsubBranch,
				invalidate() {},
				render(width: number): string[] {
					// ---- Token stats (cumulative for current branch) ----
					let input = 0, output = 0, cost = 0;
					let lastInput = 0;
					for (const e of _ctx.sessionManager.getBranch()) {
						if (e.type === "message" && e.message.role === "assistant") {
							const m = e.message as AssistantMessage;
							input += m.usage.input;
							output += m.usage.output;
							cost += m.usage.cost.total;
							lastInput = m.usage.input; // latest turn's input
						}
					}

					// ---- Tool stats ----
					const mcpToolNames = detectMcpToolNames(_pi.getAllTools());
					const toolStats = countTools(_ctx.sessionManager.getBranch(), mcpToolNames);

					// ---- Plugin badges (from setStatus) ----
					// footerData.getExtensionStatuses() returns ReadonlyMap<string, string>;
					// iteration order is insertion order and is NOT stable across extensions.
					// We project through a fixed ordering so the badge bar is predictable.
					// Keys here must match the `name` argument each extension passes to setStatus().
					// agent-id and mcp are registered by this extension itself in session_start.
					const BADGE_ORDER = ["agent-id", "theme", "mcp", "rtk", "ponytail", "caveman", "om"];
					const statuses = footerData.getExtensionStatuses();
					const badges: string[] = [];
					for (const key of BADGE_ORDER) {
						const text = statuses.get(key);
						if (text) badges.push(text);
					}

					// ---- Segment: cwd ----
					const cwdStr = abbreviateHome(_ctx.cwd);
					const cwdSeg = ansi(C.cwd, cwdStr);

					// ---- Segment: git branch (worktree-aware coloring) ----
					const branch = footerData.getGitBranch();
					let branchSeg = "";
					if (branch) {
						if (worktreeInfo.inWorktree) {
							branchSeg = " " + ansi(C.worktree, `🌳 ${branch}`);
						} else {
							branchSeg = " " + ansi(C.branch, branch);
						}
					}

					// ---- Segment: model ----
					const modelId = _ctx.model?.id;
					const modelSeg = modelId ? ansi(C.model, modelId) : "";

					// ---- Segment: ctx% (latest turn's input vs context window) ----
					const contextWindow = _ctx.model?.contextWindow ?? 200000;
					const remaining = contextWindow > 0
						? Math.max(0, 100 - Math.min(100, (lastInput / contextWindow) * 100))
						: 100;
					const ctxSeg = ansi(colorForCtxPct(remaining), `ctx:${Math.round(remaining)}%`);

					// ---- Segment: token totals ----
					const tokenSeg = ansi(C.model, `↑${fmt(input)} ↓${fmt(output)} $${cost.toFixed(3)}`);

					// ---- Assemble line 1 ----
					// Layout: [badges] on the left, [cwd | branch | model | ctx% | tokens] right-aligned.
					const sep = ansi(C.sep, " | ");
					const leftStr = badges.length > 0 ? badges.join(sep) : "";
					const rightParts: string[] = [cwdSeg + branchSeg];
					if (modelSeg) rightParts.push(modelSeg);
					rightParts.push(ctxSeg);
					rightParts.push(tokenSeg);
					const rightStr = rightParts.join(sep);

					// Pad between left and right to push the status to the right edge.
					const leftW = visibleWidth(leftStr);
					const rightW = visibleWidth(rightStr);
					const sepW = visibleWidth(sep);
					const total = leftStr && rightStr ? leftW + sepW + rightW : Math.max(leftW, rightW);
					const pad = total < width ? " ".repeat(width - total) : "";
					const line1 = leftStr && rightStr
						? truncateToWidth(leftStr + pad + sep + rightStr, width)
						: truncateToWidth((leftStr || rightStr) + " ".repeat(Math.max(0, width - Math.max(leftW, rightW))), width);

					// ---- Line 2: tool stats (only if any tool has been called) ----
					if (toolStats.totalInvocations === 0) return [line1];

					const toolParts: string[] = [];
					if (toolStats.mcpCalls > 0) {
						const servers = Array.from(toolStats.mcpServers).join(",");
						toolParts.push(
							ansi(C.warn, `mcp:${toolStats.mcpCalls}`) + ansi(C.sep, `(${servers})`),
						);
					}
					for (const tool of COMMON_TOOLS) {
						const count = toolStats.byTool[tool];
						if (count) toolParts.push(ansi(C.dim, tool) + ansi(C.sep, `:${count}`));
					}

					const totalStr = ansi(C.accent, `${toolStats.totalInvocations} calls`);
					const line2 = toolParts.length > 0
						? totalStr + " " + toolParts.join(ansi(C.sep, " · "))
						: totalStr;

					return [line1, truncateToWidth(line2, width)];
				},
			};
		});
	}

	pi.registerCommand("composed-footer", {
		description: "Toggle composed footer (p10k-style statusline + plugin badges + tool counts)",
		handler: async (_args, ctx: Ctx) => {
			enabled = !enabled;
			if (!enabled) {
				ctx.ui.setFooter(undefined);
				ctx.ui.notify("Composed footer disabled", "info");
			} else {
				enableFooter(pi, ctx);
				ctx.ui.notify("Composed footer enabled", "info");
			}
		},
	});
}
