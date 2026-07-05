/**
 * Correlate unfulfilled inbound coms prompts to the assistant text that
 * answered each one. An inbound is "answered" once at least one assistant
 * message appears after its injected coms-inbound custom_message in the
 * session branch; the LAST such text wins. Pure and dependency-free so
 * coms.test.ts can exercise it without the pi runtime.
 */
export function correlateInboundAnswers(
	branch: any[],
	unfulfilled: Set<string>,
): Array<{ msg_id: string; text: string }> {
	const inboundPositions = new Map<string, number>();
	const assistantTexts: Array<{ idx: number; text: string }> = [];
	branch.forEach((entry: any, idx: number) => {
		if (entry.type === "custom_message" && entry.customType === "coms-inbound") {
			const mid = entry.details?.msg_id;
			if (typeof mid === "string" && unfulfilled.has(mid)) {
				inboundPositions.set(mid, idx);
			}
		} else if (entry.type === "message" && entry.message?.role === "assistant") {
			const m = entry.message as any;
			let text = "";
			if (typeof m.content === "string") {
				text = m.content;
			} else if (Array.isArray(m.content)) {
				text = m.content
					.filter((b: any) => b && b.type === "text")
					.map((b: any) => b.text)
					.join("\n");
			}
			if (text) assistantTexts.push({ idx, text });
		}
	});
	const out: Array<{ msg_id: string; text: string }> = [];
	for (const [msg_id, pos] of inboundPositions) {
		// The answer is the last assistant text after this inbound's injection.
		const answer = assistantTexts.filter((a) => a.idx > pos).at(-1);
		if (!answer) continue; // not answered yet — a later agent_end fulfills it
		out.push({ msg_id, text: answer.text });
	}
	return out;
}

// Noop — utility module, consumed via import by coms.ts. pi's auto-loader
// scans every .ts in extensions/ and requires a factory function.
export default function () {}
