import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { makeMcpRequest } from "./mcp-http.ts";

// Context7 MCP Server endpoint
const CONTEXT7_MCP_URL = "https://mcp.context7.com/mcp";

const mcpRequest = makeMcpRequest(CONTEXT7_MCP_URL, "Context7");

// Extension entry point
export default function (pi: ExtensionAPI) {
  // Notify on session start
  pi.on("session_start", async (_event, ctx) => {
    ctx.ui.notify("Context7 extension loaded", "info");
  });

  // Tool 1: resolve_library_id - Resolve library name to Context7 library ID
  pi.registerTool({
    name: "context7_resolve_library_id",
    label: "Context7 Resolve Library ID",
    description: "Resolve a library name into a Context7-compatible library ID. Use this to find the exact library ID before querying documentation.",
    promptSnippet: "Resolve library ID from Context7",
    parameters: Type.Object({
      query: Type.String({
        description: "The user's question or task (used to rank results by relevance)",
      }),
      libraryName: Type.String({
        description: "Name of the library to search for (e.g., 'react', 'next.js', 'supabase')",
      }),
    }),

    async execute(_toolCallId, params, signal, _onUpdate, _ctx) {
      const result = await mcpRequest("tools/call", {
        name: "resolve-library-id",
        arguments: { query: params.query, libraryName: params.libraryName },
      }, signal) as { content?: Array<{ type: string; text?: string }> };

      const text = result?.content?.[0]?.text ?? JSON.stringify(result);
      return {
        content: [{ type: "text", text }],
        details: { libraryName: params.libraryName, query: params.query },
      };
    },
  });

  // Tool 2: query_docs - Retrieve documentation for a library
  pi.registerTool({
    name: "context7_query_docs",
    label: "Context7 Query Docs",
    description: "Retrieve documentation for a library using a Context7-compatible library ID. Use the resolve-library-id tool first to get the library ID.",
    promptSnippet: "Query Context7 documentation",
    parameters: Type.Object({
      libraryId: Type.String({
        description: "Context7-compatible library ID (e.g., '/mongodb/docs', '/vercel/next.js'). Use resolve-library-id to get this first.",
      }),
      query: Type.String({
        description: "The question or task to get relevant documentation for",
      }),
    }),

    async execute(_toolCallId, params, signal, _onUpdate, _ctx) {
      const result = await mcpRequest("tools/call", {
        name: "query-docs",
        arguments: { libraryId: params.libraryId, query: params.query },
      }, signal) as { content?: Array<{ type: string; text?: string }> };

      const text = result?.content?.[0]?.text ?? JSON.stringify(result);
      return {
        content: [{ type: "text", text }],
        details: { libraryId: params.libraryId, query: params.query },
      };
    },
  });

  // Register /context7 command for interactive use
  pi.registerCommand("context7", {
    description: "Query Context7 for library documentation",
    async handler(_args, ctx) {
      const action = await ctx.ui.select("Context7 Action", [
        { value: "search", label: "Search library" },
        { value: "docs", label: "Query documentation" },
      ]);

      if (!action) return;

      const libraryName = await ctx.ui.input("Library Name", "Library name (e.g., react, next.js, supabase)");
      if (!libraryName) return;

      if (action === "search") {
        const query = await ctx.ui.input("Query", "What do you want to do with this library?");
        if (!query) return;

        const result = await mcpRequest("tools/call", {
          name: "resolve-library-id",
          arguments: { query, libraryName },
        }) as { content?: Array<{ type: string; text?: string }> };
        const text = result?.content?.[0]?.text ?? JSON.stringify(result);
        ctx.ui.notify("Done", "success");
        return { result: text };
      }

      if (action === "docs") {
        const libraryId = await ctx.ui.input("Library ID", "Context7 library ID (e.g., /vercel/next.js)", `/vercel/next.js`);
        if (!libraryId) return;

        const query = await ctx.ui.input("Query", "What do you want to know?");
        if (!query) return;

        const result = await mcpRequest("tools/call", {
          name: "query-docs",
          arguments: { libraryId, query },
        }) as { content?: Array<{ type: string; text?: string }> };
        const text = result?.content?.[0]?.text ?? JSON.stringify(result);
        ctx.ui.notify("Done", "success");
        return { result: text };
      }
    },
  });
}