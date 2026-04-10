import type { Ticket } from '../types/ticket.js';

export function build_rag_prompt(question: string, context: Ticket[]): string {
	if (context.length === 0) {
		return question;
	}

	const context_block = context
		.map(
			(t, i) =>
				`[${i + 1}] Category: ${t.category} | Severity: ${t.severity} | Tags: ${t.tags.join(', ')}\nSummary: ${t.summary}\nAnalysis: ${t.analysis}`,
		)
		.join('\n\n');

	return `You are a support assistant. Use the context below (similar past tickets) to answer the user's question. Answer in the same language as the question.

Context:
${context_block}

Question: ${question}`;
}
