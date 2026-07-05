// Shared MCP-over-HTTP JSON-RPC client used by context7.ts and deepwiki.ts.
// Utility module — the noop default export below satisfies pi's auto-loader,
// which scans every .ts in extensions/ and requires a factory function.
// Handles: AbortSignal threading, request timeout, Accept negotiation, and
// SSE-framed responses that streamable-HTTP MCP servers may return.

const REQUEST_TIMEOUT_MS = 60_000;

let nextRequestId = 1;

type JsonRpcResponse = { result?: unknown; error?: { message: string } };

// Extract the JSON-RPC payload from an SSE body: last `data:` line wins.
function parseSseBody(body: string): JsonRpcResponse {
	let last: string | undefined;
	for (const line of body.split("\n")) {
		if (line.startsWith("data:")) last = line.slice(5).trim();
	}
	if (!last) throw new Error("SSE response contained no data lines");
	return JSON.parse(last) as JsonRpcResponse;
}

export function makeMcpRequest(url: string, label: string) {
	return async function mcpRequest(
		method: string,
		params: Record<string, unknown>,
		signal?: AbortSignal,
	): Promise<unknown> {
		const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
		const response = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json, text/event-stream",
			},
			body: JSON.stringify({
				jsonrpc: "2.0",
				id: nextRequestId++,
				method,
				params,
			}),
			signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
		});

		if (!response.ok) {
			throw new Error(`${label} MCP error: ${response.status} ${response.statusText}`);
		}

		const contentType = response.headers.get("content-type") ?? "";
		const result: JsonRpcResponse = contentType.includes("text/event-stream")
			? parseSseBody(await response.text())
			: (await response.json()) as JsonRpcResponse;

		if (result.error) {
			throw new Error(`${label} MCP error: ${result.error.message}`);
		}

		return result.result;
	};
}

// Noop — utility module, consumed via import by context7.ts / deepwiki.ts.
export default function () {}
