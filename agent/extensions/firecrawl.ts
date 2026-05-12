/**
 * Firecrawl Extension for Pi
 * 
 * Provides tools to scrape, crawl, and map websites using local Firecrawl API.
 * Firecrawl is running locally on Docker at http://localhost:3002
 * 
 * Tools:
 *   - firecrawl_scrape: Scrape a single URL, return markdown + metadata
 *   - firecrawl_crawl: Crawl entire website (async, auto-polls for completion)
 *   - firecrawl_map: Discover URLs on a website
 * 
 * Usage:
 *   1. Copy to ~/.pi/agent/extensions/firecrawl.ts
 *   2. Restart pi or run /reload
 *   3. Use the tools naturally in conversation
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

const FIRECRAWL_BASE_URL = "http://localhost:3002";
const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 60; // 2 minutes max wait

// ============ Types ============

interface FirecrawlResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  warning?: string;
}

interface ScrapeData {
  markdown: string;
  metadata: {
    title?: string;
    description?: string;
    language?: string;
    sourceURL: string;
    statusCode: number;
    scrapeId: string;
    creditsUsed?: number;
  };
}

interface CrawlJobResponse {
  id: string;
  url: string;
  success: boolean;
}

interface CrawlStatusResponse {
  status: "completed" | "failed" | "in_progress" | "queued";
  total?: number;
  completed?: number;
  failed?: number;
  creditsUsed?: number;
  data?: ScrapeData[];
  error?: string;
}

interface MapResponse {
  links: Array<{
    url: string;
    title?: string;
    description?: string;
  }>;
}

// ============ API Client ============

async function firecrawlRequest<T>(
  endpoint: string,
  body: object,
  signal?: AbortSignal
): Promise<FirecrawlResponse<T>> {
  const response = await fetch(`${FIRECRAWL_BASE_URL}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Firecrawl API error ${response.status}: ${errorText}`);
  }

  return response.json();
}

async function pollCrawlStatus(jobId: string, signal?: AbortSignal): Promise<CrawlStatusResponse> {
  const maxAttempts = MAX_POLL_ATTEMPTS;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const response = await fetch(`${FIRECRAWL_BASE_URL}/v1/crawl/${jobId}`, {
      signal,
    });

    if (!response.ok) {
      throw new Error(`Failed to check crawl status: ${response.status}`);
    }

    const status: CrawlStatusResponse = await response.json();
    
    if (status.status === "completed") {
      return status;
    }
    
    if (status.status === "failed") {
      throw new Error(`Crawl failed: ${status.error}`);
    }

    // Still in progress, wait before polling again
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error("Crawl timed out after maximum polling attempts");
}

// ============ Tools ============

const firecrawlScrapeTool = {
  name: "firecrawl_scrape",
  label: "Scrape URL",
  description: "Scrape a single URL and return its content as markdown, along with metadata. Use this when you need content from a specific webpage.",
  parameters: Type.Object({
    url: Type.String({ description: "The URL to scrape (must include protocol, e.g., https://example.com)" }),
    formats: Type.Optional(Type.Array(Type.String({ 
      description: "Output formats: markdown, html, json, screenshot" 
    }))),
    onlyMainContent: Type.Optional(Type.Boolean({ 
      description: "Only return main content, skip headers/footers/navigation" 
    })),
    headers: Type.Optional(Type.Record(Type.String(), Type.String())),
  }),

  async execute(
    _toolCallId: string,
    params: {
      url: string;
      formats?: string[];
      onlyMainContent?: boolean;
      headers?: Record<string, string>;
    },
    _signal: AbortSignal | undefined,
    onUpdate: (content: string) => void,
    _ctx: ExtensionContext
  ) {
    // v1 scrape API uses scrapeOptions for content options
    const scrapeOptions: Record<string, unknown> = {};

    if (params.formats && params.formats.length > 0) {
      scrapeOptions.formats = params.formats;
    }

    if (params.onlyMainContent !== undefined) {
      scrapeOptions.onlyMainContent = params.onlyMainContent;
    }

    if (params.headers) {
      scrapeOptions.headers = params.headers;
    }

    onUpdate({ content: [{ type: "text", text: `🔍 Scraping ${params.url}...` }], details: {} });

    const result = await firecrawlRequest<{ markdown: string; metadata: ScrapeData["metadata"] }>(
      "/v1/scrape",
      { url: params.url, ...scrapeOptions }
    );

    if (!result.success) {
      return {
        content: [{ type: "text", text: `❌ Failed to scrape: ${result.error || "Unknown error"}` }],
        details: {},
      };
    }

    const markdown = result.data?.markdown || "";
    const metadata = result.data?.metadata;

    // Format output
    let output = `## 📄 Scraped: ${params.url}\n\n`;
    
    if (metadata) {
      output += `**Title:** ${metadata.title || "N/A"}\n`;
      output += `**Status:** ${metadata.statusCode}\n`;
      output += `**Scrape ID:** ${metadata.scrapeId}\n\n`;
    }
    
    output += `---\n\n${markdown}`;

    return {
      content: [{ type: "text", text: output }],
      details: { url: params.url, metadata },
    };
  },
};

const firecrawlCrawlTool = {
  name: "firecrawl_crawl",
  label: "Crawl Website",
  description: "Crawl an entire website and return content from all discovered pages. This is async and will poll until completion. Use for small-to-medium sites. For large sites, consider using firecrawl_map first.",
  parameters: Type.Object({
    url: Type.String({ description: "The base URL of the website to crawl" }),
    limit: Type.Optional(Type.Integer({ 
      description: "Maximum number of pages to crawl (default: 50, max: 1000)" 
    })),
    onlyMainContent: Type.Optional(Type.Boolean({ 
      description: "Only return main content, skip headers/footers/navigation" 
    })),
    maxDepth: Type.Optional(Type.Integer({ 
      description: "Maximum crawl depth (default: 3)" 
    })),
  }),

  async execute(
    _toolCallId: string,
    params: {
      url: string;
      limit?: number;
      onlyMainContent?: boolean;
      maxDepth?: number;
    },
    _signal: AbortSignal | undefined,
    onUpdate: (content: string) => void,
    _ctx: ExtensionContext
  ) {
    // v1 crawl API uses scrapeOptions for content options
    const crawlOptions: Record<string, unknown> = {
      limit: params.limit || 50,
      maxDepth: params.maxDepth || 3,
    };

    // Content options go in scrapeOptions for v1 API
    if (params.onlyMainContent !== undefined) {
      crawlOptions.onlyMainContent = params.onlyMainContent;
    }

    onUpdate({ content: [{ type: "text", text: `🕷️ Starting crawl of ${params.url}...\nThis may take a moment. I'll poll for completion.` }], details: {} });

    // Start crawl job
    const jobResult = await firecrawlRequest<CrawlJobResponse>(
      "/v1/crawl",
      { url: params.url, ...crawlOptions }
    );

    if (!jobResult.success) {
      return {
        content: [{ type: "text", text: `❌ Failed to start crawl: ${jobResult.error || "Unknown error"}` }],
        details: {},
      };
    }

    const jobId = (jobResult.data as CrawlJobResponse)?.id || jobResult.url?.split("/").pop();
    
    if (!jobId) {
      return {
        content: [{ type: "text", text: "❌ Failed to get job ID from crawl response" }],
        details: {},
      };
    }

    onUpdate({ content: [{ type: "text", text: `⏳ Crawl job started (ID: ${jobId}), waiting for completion...` }], details: {} });

    // Poll for completion
    const status = await pollCrawlStatus(jobId);

    onUpdate({ content: [{ type: "text", text: `✅ Crawl completed! Found ${status.completed || 0} pages.` }], details: {} });

    // Format results
    let output = `## 🕷️ Crawl Results: ${params.url}\n\n`;
    output += `**Status:** ${status.status}\n`;
    output += `**Total Pages:** ${status.total || 0}\n`;
    output += `**Completed:** ${status.completed || 0}\n`;
    output += `**Failed:** ${status.failed || 0}\n`;
    output += `**Credits Used:** ${status.creditsUsed || 0}\n\n`;
    output += `---\n\n`;

    // Add first few pages as preview (avoid too much output)
    const pages = status.data || [];
    const previewCount = Math.min(pages.length, 5);
    
    if (pages.length > previewCount) {
      output += `*Showing first ${previewCount} of ${pages.length} pages*\n\n`;
    }

    for (let i = 0; i < previewCount; i++) {
      const page = pages[i];
      const title = page.metadata?.title || page.metadata?.sourceURL || `Page ${i + 1}`;
      output += `### ${i + 1}. ${title}\n`;
      output += `**Source:** ${page.metadata?.sourceURL || "N/A"}\n\n`;
      output += `${page.markdown.substring(0, 500)}${page.markdown.length > 500 ? "..." : ""}\n\n`;
      output += `---\n\n`;
    }

    if (pages.length > previewCount) {
      output += `\n*Use /session to access full crawl results in the session history.*`;
    }

    return {
      content: [{ type: "text", text: output }],
      details: { url: params.url, jobId, status },
    };
  },
};

const firecrawlMapTool = {
  name: "firecrawl_map",
  label: "Map Website",
  description: "Discover all URLs on a website quickly. Use this to get a sitemap-like view before deciding to crawl. Much faster than crawling.",
  parameters: Type.Object({
    url: Type.String({ description: "The base URL of the website to map" }),
    search: Type.Optional(Type.String({ 
      description: "Optional search query to filter/focus results" 
    })),
    limit: Type.Optional(Type.Integer({ 
      description: "Maximum number of links to return (default: 100)" 
    })),
  }),

  async execute(
    _toolCallId: string,
    params: {
      url: string;
      search?: string;
      limit?: number;
    },
    _signal: AbortSignal | undefined,
    onUpdate: (content: string) => void,
    _ctx: ExtensionContext
  ) {
    const mapOptions: Record<string, unknown> = {
      search: params.search,
      limit: params.limit || 100,
    };

    onUpdate({ content: [{ type: "text", text: `🗺️ Mapping ${params.url}...` }], details: {} });

    const result = await firecrawlRequest<MapResponse>(
      "/v1/map",
      { url: params.url, ...mapOptions }
    );

    if (!result.success) {
      return {
        content: [{ type: "text", text: `❌ Failed to map: ${result.error || "Unknown error"}` }],
        details: {},
      };
    }

    const links = result.data?.links || [];

    // Format output
    let output = `## 🗺️ Site Map: ${params.url}\n\n`;
    output += `**Total URLs Found:** ${links.length}\n\n`;
    output += `---\n\n`;

    for (const link of links) {
      output += `- [${link.title || link.url}](${link.url})`;
      if (link.description) {
        output += `\n  > ${link.description.substring(0, 100)}${link.description.length > 100 ? "..." : ""}`;
      }
      output += `\n\n`;
    }

    return {
      content: [{ type: "text", text: output }],
      details: { url: params.url, linkCount: links.length },
    };
  },
};

// ============ Extension ============

export default function firecrawlExtension(pi: ExtensionAPI) {
  // Register tools
  pi.registerTool(firecrawlScrapeTool);
  pi.registerTool(firecrawlCrawlTool);
  pi.registerTool(firecrawlMapTool);

  // Register command for interactive use
  pi.registerCommand("firecrawl", {
    description: "Use Firecrawl web scraping tools (scrape, crawl, map)",
    handler: async (args: string | undefined, ctx: ExtensionContext) => {
      if (!args) {
        ctx.ui.notify("🔥 Firecrawl Extension loaded! Available tools:", "info");
        ctx.ui.notify("  - /scrape <url> - Scrape a single URL", "info");
        ctx.ui.notify("  - /crawl <url> - Crawl entire website", "info");
        ctx.ui.notify("  - /map <url> - Discover URLs on site", "info");
        return;
      }

      // Parse simple arguments: tool url
      const parts = args.trim().split(/\s+/);
      const tool = parts[0]?.toLowerCase();
      const url = parts[1];

      if (!url) {
        ctx.ui.notify("Usage: /firecrawl <scrape|crawl|map> <url>", "error");
        return;
      }

      if (!url.startsWith("http://") && !url.startsWith("https://")) {
        ctx.ui.notify("URL must start with http:// or https://", "error");
        return;
      }

      ctx.ui.notify(`🔥 Running ${tool} on ${url}...`, "info");

      // Tools are automatically invoked based on the conversation context
      // The user will see the tool results in the chat
    },
  });

  // Notify on load
  pi.on("session_start", async (_event, ctx) => {
    ctx.ui.notify("🔥 Firecrawl extension loaded!", "info");
  });
}