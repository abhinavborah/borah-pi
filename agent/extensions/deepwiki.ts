import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { makeMcpRequest } from "./mcp-http.ts";

// DeepWiki MCP Server endpoint
const DEEPWIKI_MCP_URL = "https://mcp.deepwiki.com/mcp";

const mcpRequest = makeMcpRequest(DEEPWIKI_MCP_URL, "DeepWiki");

// Extension entry point
export default function (pi: ExtensionAPI) {
  // Notify on session start
  pi.on("session_start", async (_event, ctx) => {
    ctx.ui.notify("DeepWiki extension loaded", "info");
  });

  // Tool 1: read_wiki_structure - Get documentation topics for a GitHub repository
  pi.registerTool({
    name: "deepwiki_read_wiki_structure",
    label: "DeepWiki Wiki Structure",
    description: "Get a list of documentation topics for a GitHub repository from DeepWiki. Use this to explore what documentation sections are available for a repository.",
    promptSnippet: "Get documentation structure from DeepWiki",
    parameters: Type.Object({
      repo: Type.String({
        description: "GitHub repository in format 'owner/repo' (e.g., 'facebook/react')",
      }),
    }),

    async execute(_toolCallId, params, signal, _onUpdate, _ctx) {
      const result = await mcpRequest("tools/call", {
        name: "read_wiki_structure",
        arguments: { repo: params.repo },
      }, signal) as { content?: Array<{ type: string; text?: string }> };

      const text = result?.content?.[0]?.text ?? JSON.stringify(result);
      return {
        content: [{ type: "text", text }],
        details: { repo: params.repo },
      };
    },
  });

  // Tool 2: read_wiki_contents - View documentation about a GitHub repository
  pi.registerTool({
    name: "deepwiki_read_wiki_contents",
    label: "DeepWiki Wiki Contents",
    description: "View the contents of documentation for a specific topic in a GitHub repository from DeepWiki. First use read_wiki_structure to see available topics.",
    promptSnippet: "Read DeepWiki documentation contents",
    parameters: Type.Object({
      repo: Type.String({
        description: "GitHub repository in format 'owner/repo' (e.g., 'facebook/react')",
      }),
      topic: Type.String({
        description: "Documentation topic to read (e.g., 'overview', 'api-reference', 'installation'). Get topics from read_wiki_structure first.",
      }),
    }),

    async execute(_toolCallId, params, signal, _onUpdate, _ctx) {
      const result = await mcpRequest("tools/call", {
        name: "read_wiki_contents",
        arguments: { repo: params.repo, topic: params.topic },
      }, signal) as { content?: Array<{ type: string; text?: string }> };

      const text = result?.content?.[0]?.text ?? JSON.stringify(result);
      return {
        content: [{ type: "text", text }],
        details: { repo: params.repo, topic: params.topic },
      };
    },
  });

  // Tool 3: ask_question - Ask questions about a GitHub repository
  pi.registerTool({
    name: "deepwiki_ask_question",
    label: "DeepWiki Ask Question",
    description: "Ask any question about a GitHub repository and get an AI-powered, context-grounded response from DeepWiki. Good for understanding code architecture, usage patterns, and design decisions.",
    promptSnippet: "Ask DeepWiki a question about a repository",
    parameters: Type.Object({
      repo: Type.String({
        description: "GitHub repository in format 'owner/repo' (e.g., 'facebook/react')",
      }),
      question: Type.String({
        description: "Question to ask about the repository (e.g., 'What is the component lifecycle?', 'How does routing work?')",
      }),
    }),

    async execute(_toolCallId, params, signal, _onUpdate, _ctx) {
      const result = await mcpRequest("tools/call", {
        name: "ask_question",
        arguments: { repo: params.repo, question: params.question },
      }, signal) as { content?: Array<{ type: string; text?: string }> };

      const text = result?.content?.[0]?.text ?? JSON.stringify(result);
      return {
        content: [{ type: "text", text }],
        details: { repo: params.repo, question: params.question },
      };
    },
  });

  // Register /deepwiki command for interactive use
  pi.registerCommand("deepwiki", {
    description: "Query DeepWiki for repository documentation and answers",
    async handler(_args, ctx) {
      const action = await ctx.ui.select("DeepWiki Action", [
        { value: "structure", label: "Get wiki structure" },
        { value: "contents", label: "Read wiki contents" },
        { value: "question", label: "Ask a question" },
      ]);

      if (!action) return;

      const repo = await ctx.ui.input("Repository", "GitHub repo (owner/repo)", "facebook/react");
      if (!repo) return;

      if (action === "structure") {
        const result = await mcpRequest("tools/call", {
          name: "read_wiki_structure",
          arguments: { repo },
        }) as { content?: Array<{ type: string; text?: string }> };
        const text = result?.content?.[0]?.text ?? JSON.stringify(result);
        ctx.ui.notify("Done", "success");
        return { result: text };
      }

      if (action === "contents") {
        const topic = await ctx.ui.input("Topic", "Documentation topic");
        if (!topic) return;
        const result = await mcpRequest("tools/call", {
          name: "read_wiki_contents",
          arguments: { repo, topic },
        }) as { content?: Array<{ type: string; text?: string }> };
        const text = result?.content?.[0]?.text ?? JSON.stringify(result);
        ctx.ui.notify("Done", "success");
        return { result: text };
      }

      if (action === "question") {
        const question = await ctx.ui.input("Question", "Your question about the repository");
        if (!question) return;
        const result = await mcpRequest("tools/call", {
          name: "ask_question",
          arguments: { repo, question },
        }) as { content?: Array<{ type: string; text?: string }> };
        const text = result?.content?.[0]?.text ?? JSON.stringify(result);
        ctx.ui.notify("Done", "success");
        return { result: text };
      }
    },
  });
}