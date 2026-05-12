/**
 * Tool Counter Footer Extension
 *
 * Adds tool invocation and call counters on a new line below the token usage indicator.
 * Shows:
 * - Total tool invocations
 * - MCP calls breakdown (detected via pi.getAllTools() sourceInfo)
 * - Built-in tool breakdown (bash, read, write, edit, grep, find, ls)
 */

import type { AssistantMessage, ToolCall } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";

interface ToolStats {
	totalInvocations: number;
	byTool: Record<string, number>;
	mcpCalls: number;
	mcpServers: Set<string>;
}

function countTools(entries: any[], mcpToolNames: Set<string>): ToolStats {
	const stats: ToolStats = {
		totalInvocations: 0,
		byTool: {},
		mcpCalls: 0,
		mcpServers: new Set(),
	};

	for (const e of entries) {
		if (e.type === "message" && e.message.role === "assistant") {
			const m = e.message as AssistantMessage;
			for (const block of m.content) {
				if (block.type === "toolCall") {
					const tc = block as ToolCall;
					stats.totalInvocations++;
					stats.byTool[tc.name] = (stats.byTool[tc.name] || 0) + 1;

					// Detect MCP calls:
					// 1. Check if tool name is in our known MCP set (from pi.getAllTools)
					// 2. Also check naming convention: server__tool or mcp__server__tool
					const isMcpByConvention = tc.name.includes("__");
					const isMcpByName = mcpToolNames.has(tc.name);

					if (isMcpByName || isMcpByConvention) {
						stats.mcpCalls++;
						let server: string;
						if (isMcpByConvention) {
							const parts = tc.name.split("__");
							server = parts[0] === "mcp" ? parts[1] : parts[0];
						} else {
							// Extract server from known MCP tool name (e.g., firecrawl_scrape -> firecrawl)
							server = tc.name.split("_")[0];
						}
						stats.mcpServers.add(server);
					}
				}
			}
		}
	}

	return stats;
}

export default function (pi: ExtensionAPI) {
	let enabled = false;

	pi.registerCommand("tool-counter", {
		description: "Toggle tool counter footer",
		handler: async (_args, ctx) => {
			enabled = !enabled;

			if (!enabled) {
				ctx.ui.setFooter(undefined);
				ctx.ui.notify("Tool counter footer disabled", "info");
			} else {
				ctx.ui.setFooter((tui, theme, footerData) => {
					const unsub = footerData.onBranchChange(() => tui.requestRender());

					return {
						dispose: unsub,
						invalidate() {},
						render(width: number): string[] {
							// Count tokens
							let input = 0,
								output = 0,
								cost = 0;
							for (const e of ctx.sessionManager.getBranch()) {
								if (e.type === "message" && e.message.role === "assistant") {
									const m = e.message as AssistantMessage;
									input += m.usage.input;
									output += m.usage.output;
									cost += m.usage.cost.total;
								}
							}

							// Build MCP tool names set from pi.getAllTools()
							const mcpToolNames = new Set<string>();
							const allTools = pi.getAllTools();
							for (const tool of allTools) {
								// Tools from non-builtin, non-sdk sources are likely MCP/extension
								if (tool.sourceInfo && tool.sourceInfo.source !== "builtin" && tool.sourceInfo.source !== "sdk") {
									mcpToolNames.add(tool.name);
								}
							}

							// Also add known MCP tool patterns (underscore-separated: server_tool)
							// This catches tools like firecrawl_scrape, context7_query etc.
							const builtinTools = new Set(["bash", "read", "write", "edit", "grep", "find", "ls"]);
							for (const tool of allTools) {
								// If tool name has underscore pattern (server_tool) and first part isn't builtin, add it
								if (tool.name.includes("_") && !builtinTools.has(tool.name) && !tool.name.includes("__")) {
									const firstPart = tool.name.split("_")[0];
									// Skip if it looks like a built-in tool with options (e.g., read_offset)
									if (!["offset", "limit", "path", "command", "pattern", "options"].includes(firstPart)) {
										mcpToolNames.add(tool.name);
									}
								}
							}

							// Count tools
							const toolStats = countTools(ctx.sessionManager.getBranch(), mcpToolNames);

							// Format numbers
							const fmt = (n: number) => (n < 1000 ? `${n}` : `${(n / 1000).toFixed(1)}k`);

							// Line 1: Token stats + model
							const left1 = theme.fg("dim", `↑${fmt(input)} ↓${fmt(output)} $${cost.toFixed(3)}`);
							const right1 = theme.fg("dim", ctx.model?.id || "no-model");
							const pad1 = " ".repeat(Math.max(1, width - visibleWidth(left1) - visibleWidth(right1)));
							const line1 = truncateToWidth(left1 + pad1 + right1, width);

							// Line 2: Tool and MCP stats
							const parts: string[] = [];

							// MCP calls
							if (toolStats.mcpCalls > 0) {
								const servers = Array.from(toolStats.mcpServers).join(",");
								parts.push(theme.fg("warning", `mcp:${toolStats.mcpCalls}`) + theme.fg("dim", `(${servers})`));
							}

							// Built-in tools breakdown
							const commonTools = ["bash", "read", "write", "edit", "grep", "find", "ls"];
							for (const tool of commonTools) {
								if (toolStats.byTool[tool]) {
									parts.push(theme.fg("muted", tool) + theme.fg("dim", `:${toolStats.byTool[tool]}`));
								}
							}

							let line2: string;
							if (parts.length > 0) {
								const totalStr = theme.fg("accent", `${toolStats.totalInvocations} calls`);
								line2 = truncateToWidth(totalStr + " " + parts.join(theme.fg("dim", " · ")), width);
							} else {
								line2 = truncateToWidth(theme.fg("accent", "0 calls"), width);
							}

							return [line1, line2];
						},
					};
				});
				ctx.ui.notify("Tool counter footer enabled", "info");
			}
		},
	});
}
