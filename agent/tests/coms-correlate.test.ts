// Self-check for correlateInboundAnswers — run with: bun run agent/tests/coms-correlate.test.ts
// Lives OUTSIDE extensions/ because pi auto-loads every .ts there.
// ponytail: assert-based smoke test, no framework; grow only if coms grows.
import { correlateInboundAnswers } from "../extensions/coms-correlate.ts";
import * as assert from "node:assert";

const inbound = (msg_id: string) => ({
	type: "custom_message",
	customType: "coms-inbound",
	details: { msg_id },
});
const assistant = (text: string) => ({
	type: "message",
	message: { role: "assistant", content: text },
});

// 1. Single inbound answered.
assert.deepStrictEqual(
	correlateInboundAnswers([inbound("a"), assistant("answer-a")], new Set(["a"])),
	[{ msg_id: "a", text: "answer-a" }],
);

// 2. Interleaved inbounds: each gets the LAST assistant text after its own
//    injection — the old "latest unfulfilled" heuristic would misroute this.
const branch = [
	inbound("a"),
	assistant("answer-a"),
	inbound("b"),
	assistant("answer-b"),
];
const got = correlateInboundAnswers(branch, new Set(["a", "b"]));
assert.strictEqual(got.find((m) => m.msg_id === "b")?.text, "answer-b");
// "a" resolves to the last text after it (answer-b) — same as old behavior for
// already-answered older inbounds, but never to a different sender's msg_id.
assert.strictEqual(got.length, 2);

// 3. Inbound not yet answered (no assistant text after it) is skipped.
assert.deepStrictEqual(
	correlateInboundAnswers([assistant("old"), inbound("c")], new Set(["c"])),
	[],
);

// 4. Fulfilled/unknown msg_ids ignored; block content arrays flattened.
assert.deepStrictEqual(
	correlateInboundAnswers(
		[
			inbound("known"),
			inbound("not-tracked"),
			{ type: "message", message: { role: "assistant", content: [{ type: "text", text: "hi" }, { type: "tool_use" }] } },
		],
		new Set(["known"]),
	),
	[{ msg_id: "known", text: "hi" }],
);

console.log("coms.test.ts: all checks passed");
