import type { Ticket } from '@/types/ticket.js';

export const CLASSIFY_PROMPT = (message: string, context: Ticket[] = []) => {
	const context_block =
		context.length > 0
			? `\nSimilar past tickets for reference:\n${context
					.map(
						(t, i) =>
							`[${i + 1}] Category: ${t.category} | Severity: ${t.severity} | Tags: ${t.tags.join(', ')}\nSummary: ${t.summary}`,
					)
					.join('\n\n')}\n`
			: '';

	return `
Classify the following support ticket or message.
Respond ONLY with a valid JSON object — no markdown, no explanation.
${context_block}
Message: "${message}"

JSON format:
{
  "category": "bug" | "infra" | "auth" | "feature" | "other",
  "severity": "critical" | "high" | "medium" | "low",
  "summary": "one-line description in the same language as the message",
  "analysis": "detailed explanation of the issue and suggested next steps, in the same language as the message",
  "tags": ["keyword1", "keyword2"]
}

Classification rules:
- category "auth": login, password, authentication, session, access denied
- category "infra": server down, database, deploy, performance, outage, timeout
- category "bug": crashes, errors, unexpected behavior, broken feature
- category "feature": requests for new features or improvements
- category "other": anything that doesn't fit above

- severity "critical": system down, login broken for all users, data loss, security breach
- severity "high": major functionality broken, affects many users
- severity "medium": partial functionality affected, workaround exists
- severity "low": minor issue, cosmetic, single user affected

- tags: 3 to 5 lowercase keywords extracted from the message (e.g. "login", "timeout", "production", "api")
`;
};
